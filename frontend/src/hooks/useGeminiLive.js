import { useCallback, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { resumeCaptureContext, unlockInterviewAudioContexts } from '../utils/interviewAudio';
import {
  playInterviewerAudioBlob,
  stopInterviewerAudio,
  unlockInterviewerAudioElement,
} from '../utils/interviewerPlayback';
import { mediaLog } from '../utils/mediaLog';
import api from '../services/authService';

export const TRANSCRIBE_LIVE_CONFIG = {
  responseModalities: ['TEXT'],
  inputAudioTranscription: { mode: 'smart' },
};

function floatTo16BitPCM(float32) {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function downsampleBuffer(buffer, inputRate, outputRate) {
  if (inputRate === outputRate) return buffer;
  const ratio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
      accum += buffer[i];
      count += 1;
    }
    result[offsetResult] = count ? accum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const liveRuntime = {
  transcribeSession: null,
  connectPromise: null,
  interviewId: '',
};

function getCaptureAudioTrack(stream) {
  if (!stream || typeof stream.getAudioTracks !== 'function') return null;
  return stream.getAudioTracks().find((track) => track.readyState === 'live' && track.enabled !== false) || null;
}

function waitForTrackUnmute(track, timeoutMs = 1200) {
  if (!track || !track.muted) return Promise.resolve(track);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      track.removeEventListener('unmute', finish);
      resolve(track);
    };
    track.addEventListener('unmute', finish);
    window.setTimeout(finish, timeoutMs);
  });
}

function createAiTurn(id, kind, text) {
  return {
    id,
    kind,
    text: String(text || ''),
    generationComplete: false,
    turnComplete: false,
    started: false,
    finished: false,
  };
}

export function useGeminiLive({
  onSpeakingChange,
  onInputTranscript,
  onOutputTranscript,
  onError,
  onVoiceActivity,
  onVoiceUnavailable,
} = {}) {
  const transcribeSessionRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const muteRef = useRef(null);
  const speakingRef = useRef(false);
  const interviewerSpeakingRef = useRef(false);
  const captureTrackIdRef = useRef(null);
  const micAttachGenRef = useRef(0);
  const listeningActiveRef = useRef(false);
  const transcribeConnectedRef = useRef(false);
  const outputKindRef = useRef('none');
  const pendingQuestionRef = useRef('');
  const currentInterimRef = useRef('');
  const finalizedSegmentsRef = useRef([]);
  const transcribeMessageRef = useRef(() => {});
  const aiTurnRef = useRef(createAiTurn(0, 'none', ''));
  const interviewIdRef = useRef('');
  const lastQuestionTextRef = useRef('');
  const lastQuestionAudioRef = useRef({ text: '', blob: null });
  const lastPromptKindRef = useRef('');
  const promptChainRef = useRef(Promise.resolve());
  const connectArgsRef = useRef(null);
  const disconnectingRef = useRef(false);
  const wantListeningRef = useRef(false);
  const inputClosedRef = useRef(false);
  const lastStreamRef = useRef(null);
  const listenGenRef = useRef(0);
  const transcribeEpochRef = useRef(0);
  const transcribeOpenRef = useRef(Promise.resolve());
  const recoverInFlightRef = useRef(false);
  const recoverFnRef = useRef(async () => {});
  const endedHandlerRef = useRef(null);
  const ttsAbortRef = useRef(null);
  const audioStateRef = useRef('idle');
  const callbacksRef = useRef({ onSpeakingChange, onInputTranscript, onOutputTranscript, onError, onVoiceActivity, onVoiceUnavailable });
  callbacksRef.current = { onSpeakingChange, onInputTranscript, onOutputTranscript, onError, onVoiceActivity, onVoiceUnavailable };

  const publishCandidateTranscript = useCallback(() => {
    const finalized = finalizedSegmentsRef.current.join(' ').trim();
    const interim = String(currentInterimRef.current || '').trim();
    const display = [finalized, interim].filter(Boolean).join(' ').trim();
    callbacksRef.current.onInputTranscript?.({
      display,
      finalized,
      interim,
      replace: true,
    });
  }, []);

  const stopMicNodes = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (muteRef.current) {
      muteRef.current.disconnect();
      muteRef.current = null;
    }
    captureTrackIdRef.current = null;
    if (endedHandlerRef.current?.track && endedHandlerRef.current?.handler) {
      try {
        endedHandlerRef.current.track.removeEventListener('ended', endedHandlerRef.current.handler);
      } catch {
        /* already ended */
      }
    }
    endedHandlerRef.current = null;
  }, []);

  const notifySpeaking = useCallback((value, extra = {}) => {
    speakingRef.current = value;
    callbacksRef.current.onSpeakingChange?.(value, {
      ...extra,
      kind: extra.kind || outputKindRef.current,
    });
  }, []);

  const revealAiTranscript = useCallback((turn) => {
    if (turn.kind !== 'question') return;
    const text = String(pendingQuestionRef.current || turn.text || '').trim();
    if (!text) return;
    callbacksRef.current.onOutputTranscript?.(text, {
      replace: true,
      kind: 'question',
      audioStarted: true,
      turnId: turn.id,
    });
  }, []);

  const beginAiTurn = useCallback((kind, questionText = '') => {
    const nextId = aiTurnRef.current.id + 1;
    const turn = createAiTurn(nextId, kind, kind === 'question' ? questionText : '');
    aiTurnRef.current = turn;
    outputKindRef.current = kind;
    pendingQuestionRef.current = kind === 'question' ? String(questionText || '') : '';
    mediaLog('GEMINI-LIVE', 'question started', { turnId: nextId, kind });
    return nextId;
  }, []);

  const finishAiTurnIfIdle = useCallback(() => {
    const turn = aiTurnRef.current;
    if (turn.finished) return;
    if (!turn.turnComplete) return;
    if (interviewerSpeakingRef.current) return;
    turn.finished = true;
    mediaLog('AUDIO', 'interviewer playback stopped', { turnId: turn.id });
    notifySpeaking(false, { turnComplete: true, kind: turn.kind, turnId: turn.id });
  }, [notifySpeaking]);

  const markPlaybackStarted = useCallback(() => {
    const turn = aiTurnRef.current;
    interviewerSpeakingRef.current = true;
    if (!turn.started) {
      turn.started = true;
      mediaLog('AUDIO', 'interviewer playback started', { turnId: turn.id, kind: turn.kind });
      revealAiTranscript(turn);
      notifySpeaking(true, { kind: turn.kind, audioStarted: true, turnId: turn.id });
    }
  }, [notifySpeaking, revealAiTranscript]);

  const markPlaybackStopped = useCallback(() => {
    interviewerSpeakingRef.current = false;
    finishAiTurnIfIdle();
  }, [finishAiTurnIfIdle]);

  const handleControl = useCallback((payload) => {
    const type = payload?.type;
    const turn = aiTurnRef.current;
    if (type === 'turn-begin' && payload.kind) {
      outputKindRef.current = payload.kind;
    }
    if (type === 'generation-complete') {
      turn.generationComplete = true;
      mediaLog('GEMINI-LIVE', 'generation completed', { turnId: payload.turnId || turn.id });
    }
    if (type === 'turn-complete') {
      turn.turnComplete = true;
      mediaLog('GEMINI-LIVE', 'turn complete', { turnId: payload.turnId || turn.id, hadAudio: payload.hadAudio });
      if (payload.hadAudio === false && !turn.started) {
        turn.finished = true;
        turn.hadNoAudio = true;
        notifySpeaking(false, { turnComplete: true, kind: turn.kind, turnId: turn.id });
        return;
      }
      finishAiTurnIfIdle();
    }
    if (type === 'interrupted') {
      interviewerSpeakingRef.current = false;
      turn.finished = false;
      turn.started = false;
      notifySpeaking(false, { kind: turn.kind, interrupted: true, turnId: turn.id });
    }
  }, [finishAiTurnIfIdle, notifySpeaking]);

  const handleTranscribeMessage = useCallback(
    (message) => {
      const content = message?.serverContent;
      if (!content) {
        if (message?.error) console.error('[TRANSCRIBE] Server error', message.error);
        return;
      }

      const interim = content.interimInputTranscription?.text;
      if (typeof interim === 'string') {
        currentInterimRef.current = interim;
        mediaLog('TRANSCRIBE', 'onresult/interim', { chars: interim.length });
        publishCandidateTranscript();
        if (interim.trim()) callbacksRef.current.onVoiceActivity?.();
      }

      const input = content.inputTranscription;
      const finalText = typeof input?.text === 'string' ? input.text.trim() : '';
      if (finalText) {
        const segments = finalizedSegmentsRef.current;
        const last = segments[segments.length - 1];
        if (!last) {
          segments.push(finalText);
        } else if (last === finalText || last.startsWith(finalText)) {
          /* duplicate or stale shorter final */
        } else if (finalText.startsWith(last)) {
          segments[segments.length - 1] = finalText;
        } else {
          segments.push(finalText);
        }
        currentInterimRef.current = '';
        mediaLog('TRANSCRIBE', 'onresult/final', { chars: finalText.length });
        publishCandidateTranscript();
        callbacksRef.current.onVoiceActivity?.();
      }
    },
    [publishCandidateTranscript]
  );
  transcribeMessageRef.current = handleTranscribeMessage;

  const openTranscribeSession = useCallback(async (transcribe, { force = false } = {}) => {
    if (
      !force &&
      transcribeSessionRef.current &&
      transcribeConnectedRef.current &&
      !inputClosedRef.current
    ) {
      return transcribeSessionRef.current;
    }
    if (!transcribe?.token) throw new Error('Transcribe Live token was empty.');

    let release = () => {};
    const previous = transcribeOpenRef.current;
    transcribeOpenRef.current = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      if (
        !force &&
        transcribeSessionRef.current &&
        transcribeConnectedRef.current &&
        !inputClosedRef.current
      ) {
        return transcribeSessionRef.current;
      }
      if (disconnectingRef.current) return null;

      const epoch = transcribeEpochRef.current + 1;
      transcribeEpochRef.current = epoch;
      const stale = liveRuntime.transcribeSession || transcribeSessionRef.current;
      transcribeSessionRef.current = null;
      liveRuntime.transcribeSession = null;
      transcribeConnectedRef.current = false;
      try {
        stale?.close?.();
      } catch (error) {
        mediaLog('TRANSCRIBE', 'close previous failed', error.message);
      }

      const ai = new GoogleGenAI({
        apiKey: transcribe.token,
        httpOptions: { apiVersion: 'v1alpha' },
      });
      mediaLog('TRANSCRIBE', 'connecting', { model: transcribe.model, epoch });
      const session = await ai.live.connect({
        model: transcribe.model,
        config: TRANSCRIBE_LIVE_CONFIG,
        callbacks: {
            onopen: () => {
            if (epoch !== transcribeEpochRef.current) return;
            transcribeConnectedRef.current = true;
            mediaLog('TRANSCRIBE', 'onstart/connected', { epoch });
          },
          onmessage: (message) => transcribeMessageRef.current(message),
          onerror: (event) => {
            if (epoch !== transcribeEpochRef.current) return;
            const error = new Error(event?.message || 'Transcription connection failed.');
            mediaLog('TRANSCRIBE', 'onerror', error.message);
            callbacksRef.current.onError?.(error);
          },
          onclose: () => {
            if (epoch !== transcribeEpochRef.current) return;
            transcribeConnectedRef.current = false;
            inputClosedRef.current = true;
            if (liveRuntime.transcribeSession === session) liveRuntime.transcribeSession = null;
            if (transcribeSessionRef.current === session) transcribeSessionRef.current = null;
            mediaLog('TRANSCRIBE', 'onend/closed', {
              wantListening: wantListeningRef.current,
              listeningActive: listeningActiveRef.current,
            });
            if (!disconnectingRef.current && wantListeningRef.current && listeningActiveRef.current) {
              recoverFnRef.current();
            }
          },
        },
      });
      if (epoch !== transcribeEpochRef.current) {
        try {
          session.close?.();
        } catch {
          /* superseded */
        }
        return transcribeSessionRef.current;
      }
      inputClosedRef.current = false;
      liveRuntime.transcribeSession = session;
      transcribeSessionRef.current = session;
      transcribeConnectedRef.current = true;
      return session;
    } finally {
      release();
    }
  }, []);

  const disconnect = useCallback(async () => {
    disconnectingRef.current = true;
    wantListeningRef.current = false;
    listeningActiveRef.current = false;
    recoverInFlightRef.current = false;
    transcribeEpochRef.current += 1;
    listenGenRef.current += 1;
    stopMicNodes();
    currentInterimRef.current = '';
    finalizedSegmentsRef.current = [];
    notifySpeaking(false);
    transcribeConnectedRef.current = false;
    try {
      liveRuntime.transcribeSession?.close?.();
    } catch (error) {
      mediaLog('TRANSCRIBE', 'close failed', error.message);
    }
    liveRuntime.transcribeSession = null;
    liveRuntime.connectPromise = null;
    transcribeSessionRef.current = null;
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    stopInterviewerAudio();
    audioStateRef.current = 'idle';
    mediaLog('TRANSCRIBE', 'disconnected');
  }, [notifySpeaking, stopMicNodes]);

  const connect = useCallback(
    async ({ transcribe, interviewId } = {}) => {
      if (!transcribe?.token) throw new Error('Transcribe Live token was empty.');
      interviewIdRef.current = interviewId || '';
      liveRuntime.interviewId = interviewIdRef.current;
      connectArgsRef.current = { transcribe, interviewId: interviewIdRef.current };
      disconnectingRef.current = false;

      if (
        liveRuntime.transcribeSession &&
        liveRuntime.interviewId === interviewIdRef.current &&
        transcribeConnectedRef.current
      ) {
        mediaLog('TRANSCRIBE', 'reusing existing transcribe session');
        transcribeSessionRef.current = liveRuntime.transcribeSession;
        return { transcribe: liveRuntime.transcribeSession };
      }
      if (liveRuntime.connectPromise) {
        return liveRuntime.connectPromise;
      }

      liveRuntime.connectPromise = (async () => {
        await unlockInterviewAudioContexts();
        unlockInterviewerAudioElement();
        await openTranscribeSession(transcribe);
        return { transcribe: liveRuntime.transcribeSession };
      })();

      try {
        return await liveRuntime.connectPromise;
      } catch (error) {
        await disconnect();
        throw error;
      } finally {
        liveRuntime.connectPromise = null;
      }
    },
    [disconnect, openTranscribeSession]
  );

  const sendInterviewerText = useCallback(async (text, options = {}) => {
    const interviewId = interviewIdRef.current;
    if (!interviewId) throw new Error('Live interviewer is not connected.');
    const kind = options.kind || 'other';
    const questionText = String(options.questionText || '').trim();
    const spokenText = String(text || '').trim();
    if (!options.force && kind === 'question' && questionText && questionText === lastQuestionTextRef.current) {
      mediaLog('GEMINI-LIVE', 'skip duplicate question');
      return;
    }
    if (kind === 'warning' && lastPromptKindRef.current === 'warning') {
      mediaLog('GEMINI-LIVE', 'skip duplicate warning');
      return;
    }
    listeningActiveRef.current = false;
    const previous = promptChainRef.current;
    let release = () => {};
    promptChainRef.current = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      ttsAbortRef.current?.abort();
      const controller = new AbortController();
      ttsAbortRef.current = controller;
      stopInterviewerAudio();
      beginAiTurn(kind, questionText);
      if (kind === 'question') lastQuestionTextRef.current = questionText;
      lastPromptKindRef.current = kind;
      const cachedQuestion = lastQuestionAudioRef.current;
      if (
        kind === 'question'
        && options.force
        && questionText
        && cachedQuestion.text === questionText
        && cachedQuestion.blob instanceof Blob
      ) {
      audioStateRef.current = 'playing';
      await playInterviewerAudioBlob(cachedQuestion.blob, {
          onStart: markPlaybackStarted,
          onEnded: () => {
            const turn = aiTurnRef.current;
            turn.turnComplete = true;
            turn.generationComplete = true;
            audioStateRef.current = 'ended';
            markPlaybackStopped();
          },
          onError: () => {
            audioStateRef.current = 'error';
          },
        });
        return;
      }
      audioStateRef.current = 'loading';
      const payload = kind === 'closing' && options.recap
        ? { kind, recap: options.recap }
        : { text: spokenText, kind };
      const response = await api.post(`/interviews/${interviewId}/interviewer/tts`, payload, {
        responseType: 'blob',
        timeout: 180000,
        signal: controller.signal,
      });
      const contentType = String(response.headers?.['content-type'] || '').split(';')[0];
      const provider = response.headers?.['x-tts-provider'] || '';
      const blob = response.data;
      console.log('[AI-VOICE] tts response', {
        status: response.status,
        contentType,
        provider,
        bytes: blob?.size,
      });
      if (!(blob instanceof Blob) || blob.size < 40 || contentType.includes('json')) {
        throw new Error('Audio is temporarily unavailable. You can still read the response.');
      }
      if (kind === 'question' && questionText) {
        lastQuestionAudioRef.current = { text: questionText, blob };
      }
      console.log('[AI-VOICE] audio buffer created', { kind, bytes: blob.size, type: blob.type || 'unknown', provider });
      audioStateRef.current = 'playing';
      await playInterviewerAudioBlob(blob, {
        onStart: markPlaybackStarted,
        onEnded: () => {
          const turn = aiTurnRef.current;
          turn.turnComplete = true;
          turn.generationComplete = true;
          audioStateRef.current = 'ended';
          markPlaybackStopped();
        },
        onError: () => {
          audioStateRef.current = 'error';
        },
      });
    } catch (error) {
      if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError' || error?.name === 'AbortError') {
        return;
      }
      const status = Number(error?.response?.status || 0);
      const payload = error?.response?.data;
      let message = '';
      try {
        if (payload instanceof Blob) {
          message = await payload.text();
        } else {
          message = String(payload?.message || error.message || '');
        }
      } catch {
        message = String(error.message || '');
      }
      const quota = status === 429
        || /rate.?limit|tpd|quota/i.test(message);
      console.error('[AI-VOICE] skipped voice playback', {
        status: status || 'unknown',
        quota,
        textOnly: true,
        message: String(message).slice(0, 180),
      });
      audioStateRef.current = 'error';
      const turn = aiTurnRef.current;
      turn.turnComplete = true;
      turn.hadNoAudio = true;
      turn.finished = true;
      notifySpeaking(false, { turnComplete: true, kind: turn.kind, turnId: turn.id });
      callbacksRef.current.onVoiceUnavailable?.();
    } finally {
      release();
    }
  }, [beginAiTurn, markPlaybackStarted, markPlaybackStopped, notifySpeaking, revealAiTranscript]);

  const sendLine = useCallback(async (text, options = {}) => {
    await sendInterviewerText(text, options);
  }, [sendInterviewerText]);

  const sendQuestion = useCallback(async (questionText, { repeat = false } = {}) => {
    await sendInterviewerText(questionText, { kind: 'question', questionText, force: repeat });
  }, [sendInterviewerText]);

  const sendWarningPrompt = useCallback(async (warningText) => {
    await sendInterviewerText(warningText, { kind: 'warning' });
  }, [sendInterviewerText]);

  const sendFeedback = useCallback(async (feedbackText) => {
    await sendInterviewerText(feedbackText, { kind: 'feedback' });
  }, [sendInterviewerText]);

  const sendClosingRemarks = useCallback(async (items = []) => {
    await sendInterviewerText('', { kind: 'closing', recap: items });
  }, [sendInterviewerText]);

  const waitForPlaybackEnd = useCallback(async () => {
    const turnId = aiTurnRef.current.id;
    const startedAt = Date.now();
    while (Date.now() - startedAt < 180000) {
      const turn = aiTurnRef.current;
      if (turn.id !== turnId) return;
      if (turn.finished || turn.turnComplete || turn.hadNoAudio) return;
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }, []);

  const commitCandidateAnswer = useCallback(async (transcript, nextQuestionText) => {
    mediaLog('INTERVIEW', 'answer finalized');
    const next = String(nextQuestionText || '').trim();
    if (next) {
      mediaLog('INTERVIEW', 'next question');
      await sendInterviewerText(next, { kind: 'question', questionText: next });
    }
  }, [sendInterviewerText]);

  const attachMicPipeline = useCallback(
    async (mediaStream) => {
      const liveTrack = getCaptureAudioTrack(mediaStream);
      if (!liveTrack) throw new Error('Microphone is not active.');
      lastStreamRef.current = mediaStream;
      await waitForTrackUnmute(liveTrack);
      const trackId = liveTrack.id;
      if (processorRef.current && captureTrackIdRef.current === trackId && liveTrack.readyState === 'live') {
        mediaLog('TRANSCRIBE', 'microphone pipeline already attached', { trackId });
        return;
      }
      const gen = micAttachGenRef.current + 1;
      micAttachGenRef.current = gen;
      stopMicNodes();
      const ctx = await resumeCaptureContext();
      if (gen !== micAttachGenRef.current) return;
      if (liveTrack.readyState !== 'live') throw new Error('Microphone is not active.');
      const source = ctx.createMediaStreamSource(new MediaStream([liveTrack]));
      sourceRef.current = source;
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;
      const mute = ctx.createGain();
      mute.gain.value = 0;
      muteRef.current = mute;
      captureTrackIdRef.current = trackId;
      const onEnded = () => {
        mediaLog('MIC-PIPE', 'track ended', {
          readyState: liveTrack.readyState,
          enabled: liveTrack.enabled,
          id: trackId,
        });
        if (captureTrackIdRef.current === trackId) {
          captureTrackIdRef.current = null;
        }
      };
      liveTrack.addEventListener('ended', onEnded);
      endedHandlerRef.current = { track: liveTrack, handler: onEnded };
      let lastPipeLog = 0;
      processor.onaudioprocess = (event) => {
        const listening = listeningActiveRef.current;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const input = event.inputBuffer.getChannelData(0);
        let energy = 0;
        for (let i = 0; i < input.length; i += 1) energy += input[i] * input[i];
        const rms = Math.sqrt(energy / input.length);
        const canSend =
          listening && Boolean(transcribeSessionRef.current) && !inputClosedRef.current;
        const now = Date.now();
        if (now - lastPipeLog > 2000) {
          lastPipeLog = now;
          mediaLog('MIC-PIPE', 'audio frame', {
            listening,
            sent: canSend,
            rms: Number(rms.toFixed(4)),
            ctx: ctx.state,
            trackReadyState: liveTrack.readyState,
            trackEnabled: liveTrack.enabled,
            trackMuted: liveTrack.muted,
            transcribeConnected: transcribeConnectedRef.current,
            interviewerSpeakingStuck: interviewerSpeakingRef.current,
          });
        }
        if (!listening) return;
        if (rms > 0.012) callbacksRef.current.onVoiceActivity?.();
        if (!canSend) return;
        const downsampled = downsampleBuffer(input, ctx.sampleRate, 16000);
        const pcm = floatTo16BitPCM(downsampled);
        transcribeSessionRef.current.sendRealtimeInput({
          audio: {
            data: arrayBufferToBase64(pcm),
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      };
      source.connect(processor);
      processor.connect(mute);
      mute.connect(ctx.destination);
      mediaLog('MIC-PIPE', 'pipeline attached', {
        trackId,
        readyState: liveTrack.readyState,
        enabled: liveTrack.enabled,
        muted: liveTrack.muted,
        streamTracks: mediaStream?.getAudioTracks?.().map((track) => ({
          id: track.id,
          readyState: track.readyState,
          enabled: track.enabled,
          muted: track.muted,
        })),
      });
    },
    [stopMicNodes]
  );

  const refreshTranscribeToken = useCallback(async () => {
    try {
      const response = await api.post('/interviews/gemini-token');
      const next = response?.data?.data?.transcribe || response?.data?.transcribe;
      if (next?.token && connectArgsRef.current) {
        connectArgsRef.current.transcribe = next;
        return next;
      }
    } catch (error) {
      mediaLog('TRANSCRIBE', 'token refresh failed', error.message);
    }
    return connectArgsRef.current?.transcribe || null;
  }, []);

  const startListening = useCallback(
    async (mediaStream) => {
      if (disconnectingRef.current) return;
      const gen = listenGenRef.current + 1;
      listenGenRef.current = gen;
      wantListeningRef.current = true;
      const stream = mediaStream || lastStreamRef.current;
      const liveTrack = getCaptureAudioTrack(stream);
      mediaLog('MIC-PIPE', 'startListening', {
        transport: 'local-gemini-transcribe',
        candidatePublish: false,
        hasStream: Boolean(stream),
        trackReadyState: liveTrack?.readyState,
        trackEnabled: liveTrack?.enabled,
        trackMuted: liveTrack?.muted,
        transcribeConnected: transcribeConnectedRef.current,
      });
      if (!liveTrack) throw new Error('Microphone is not active.');
      lastStreamRef.current = stream;
      if (gen !== listenGenRef.current) return;
      const needsSession =
        !transcribeSessionRef.current || !transcribeConnectedRef.current || inputClosedRef.current;
      if (needsSession) {
        const transcribe = inputClosedRef.current
          ? (await refreshTranscribeToken()) || connectArgsRef.current?.transcribe
          : connectArgsRef.current?.transcribe;
        await openTranscribeSession(transcribe, { force: Boolean(inputClosedRef.current) });
      }
      if (gen !== listenGenRef.current) return;
      await attachMicPipeline(stream);
      if (gen !== listenGenRef.current) return;
      listeningActiveRef.current = true;
      mediaLog('MIC-PIPE', 'listening active', {
        trackId: liveTrack.id,
        readyState: liveTrack.readyState,
        enabled: liveTrack.enabled,
      });
    },
    [attachMicPipeline, openTranscribeSession, refreshTranscribeToken]
  );

  recoverFnRef.current = async () => {
    if (disconnectingRef.current || recoverInFlightRef.current) return;
    if (!wantListeningRef.current || !listeningActiveRef.current) return;
    recoverInFlightRef.current = true;
    try {
      mediaLog('TRANSCRIBE', 'session ended; reopening the same capture pipeline');
      const transcribe = (await refreshTranscribeToken()) || connectArgsRef.current?.transcribe;
      await openTranscribeSession(transcribe, { force: true });
    } catch (error) {
      mediaLog('TRANSCRIBE', 'reopen failed', error.message);
    } finally {
      recoverInFlightRef.current = false;
    }
  };

  const stopListening = useCallback((options = {}) => {
    listenGenRef.current += 1;
    wantListeningRef.current = false;
    listeningActiveRef.current = false;
    mediaLog('MIC-PIPE', 'stopListening', { detach: Boolean(options.detach) });
    if (options.detach) {
      stopMicNodes();
      lastStreamRef.current = null;
    }
  }, [stopMicNodes]);

  const prepareRepeatQuestion = useCallback(() => {
    lastQuestionTextRef.current = '';
  }, []);

  const clearInterviewerSpeaking = useCallback(() => {
    speakingRef.current = false;
    interviewerSpeakingRef.current = false;
    if (lastPromptKindRef.current === 'warning') lastPromptKindRef.current = '';
  }, []);

  const resetCandidateTranscript = useCallback(() => {
    currentInterimRef.current = '';
    finalizedSegmentsRef.current = [];
    publishCandidateTranscript();
  }, [publishCandidateTranscript]);

  return {
    connect,
    disconnect,
    sendQuestion,
    sendLine,
    sendSpokenMessage: sendWarningPrompt,
    sendFeedback,
    commitCandidateAnswer,
    sendClosingRemarks,
    waitForPlaybackEnd,
    attachMicrophone: attachMicPipeline,
    startListening,
    stopListening,
    prepareRepeatQuestion,
    clearInterviewerSpeaking,
    resetCandidateTranscript,
    unlockAudio: unlockInterviewAudioContexts,
    isConnected: () => transcribeConnectedRef.current,
    isListening: () => listeningActiveRef.current,
  };
}

export default useGeminiLive;
