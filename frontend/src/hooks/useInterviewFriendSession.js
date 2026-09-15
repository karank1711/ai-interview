import { useCallback, useEffect, useRef, useState } from 'react';
import { unlockInterviewerAudioElement, stopInterviewerAudio, playInterviewerAudioBlob, isInterviewerAudioPlaying } from '../utils/interviewerPlayback';
import { normalizeFriendDisplayAnswer } from '../utils/friendAnswer';
import {
  sendInterviewFriendMessage,
  fetchInterviewFriendSpeech,
  friendApiErrorMessage,
  listFriendConversations,
  getFriendConversation,
  createFriendConversation,
  updateFriendConversation,
} from '../services/interviewFriendService';

export const MODE_STARTERS = {
  explain: {
    message: 'Explain a useful interview topic in simple language and give one example.',
    includeReportContext: false,
  },
  practice: {
    message: 'Start a practice interview. Ask me one question at a time.',
    includeReportContext: false,
  },
  analyze: {
    message: 'Analyze my last interview and coach me on what to improve.',
    includeReportContext: true,
  },
  communication: {
    message: 'Help me improve my interview communication: structure, clarity, conciseness, and STAR answers.',
    includeReportContext: false,
  },
};

function speechEngine() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function isAbortError(error) {
  return (
    error?.code === 'ERR_CANCELED'
    || error?.name === 'CanceledError'
    || error?.name === 'AbortError'
    || /aborted|canceled|cancelled/i.test(String(error?.message || ''))
  );
}

function isMeaningfulUserMessage(content) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  if (text.length < 2) return false;
  const t = text.toLowerCase().replace(/[!.?,-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(thank you|thanks|thankyou|thx|ty|hello|hi|hey|ok|okay|bye|goodbye)$/.test(t)) return false;
  return true;
}

function titleFromMessages(messages) {
  const first = (messages || []).find((item) => item.role === 'user' && isMeaningfulUserMessage(item.content));
  if (!first) return 'New conversation';
  return String(first.content).replace(/\s+/g, ' ').trim().slice(0, 64);
}

function looksLikeResourceRequest(text) {
  return /\b(youtube|yt\b|videos?|play\s*lists?|channels?|tutorials?|courses?|resources?|dikhao|dikhaao|chahiye|chahie)\b/i.test(
    String(text || '')
  );
}

function revealByProgress(text, progress) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const ratio = Math.max(0, Math.min(1, Number(progress) || 0));
  const count = Math.max(1, Math.min(words.length, Math.ceil(ratio * words.length) || 1));
  return words.slice(0, count).join(' ');
}

function growTranscript(previous, next) {
  const a = String(previous || '');
  const b = String(next || '');
  if (!b) return a;
  if (!a) return b;
  if (b.startsWith(a) || b.length >= a.length) return b;
  return a;
}

function firstNameFromUser(user) {
  const raw = String(user?.name || '').trim();
  if (raw) return raw.split(/\s+/)[0];
  const email = String(user?.email || '');
  return email.includes('@') ? email.split('@')[0] : 'there';
}

function isLikelyEcho(heard, spoken) {
  const a = String(heard || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const b = String(spoken || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!a || !b) return false;
  if (b.includes(a) || a.includes(b)) return true;
  const spokenHead = b.slice(0, Math.min(b.length, 48));
  if (spokenHead && a.includes(spokenHead)) return true;
  const heardWords = a.split(' ').filter(Boolean);
  const spokenWords = new Set(b.split(' ').filter(Boolean));
  if (heardWords.length < 2) return spokenWords.has(heardWords[0]) && heardWords[0].length > 2;
  const overlap = heardWords.filter((word) => spokenWords.has(word)).length;
  return overlap / heardWords.length >= 0.7;
}

export function useInterviewFriendSession(user) {
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState('general');
  const [status, setStatus] = useState('ready');
  const [messages, setMessages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [videosExhausted, setVideosExhausted] = useState(false);
  const [videosLoading, setVideosLoading] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState('');
  const [error, setError] = useState('');
  const [voiceHint, setVoiceHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [listenBlocked, setListenBlocked] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [playbackId, setPlaybackId] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const abortRef = useRef(null);
  const recognitionRef = useRef(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const contextRef = useRef([]);
  const lastVideoRef = useRef(null);
  const excludeIdsRef = useRef([]);
  const videoQueryRef = useRef('');
  const micEnabledRef = useRef(true);
  const listenAfterSpeechRef = useRef(true);
  const statusRef = useRef('ready');
  const startListeningRef = useRef(async () => {});
  const conversationIdRef = useRef('');
  const videosRef = useRef([]);
  const persistTimerRef = useRef(null);
  const greetingPlayedRef = useRef(false);
  const greetingGenRef = useRef(0);
  const lastSpeechRef = useRef('');
  const submitLockRef = useRef(false);
  const listenGenRef = useRef(0);
  const isAiSpeakingRef = useRef(false);
  const resumeListenTimerRef = useRef(null);
  const echoGuardUntilRef = useRef(0);
  const pendingVoiceRef = useRef('');
  const displayedTranscriptRef = useRef('');

  const setFriendStatus = useCallback((next) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const stopRecognition = useCallback(() => {
    listenGenRef.current += 1;
    pendingVoiceRef.current = '';
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    try {
      rec?.abort?.();
      rec?.stop?.();
    } catch {
      /* ignore */
    }
  }, []);

  const pauseRecognitionForAi = useCallback(() => {
    window.clearTimeout(resumeListenTimerRef.current);
    isAiSpeakingRef.current = true;
    pendingVoiceRef.current = '';
    stopRecognition();
  }, [stopRecognition]);

  const resumeRecognitionAfterAi = useCallback(() => {
    isAiSpeakingRef.current = false;
    pendingVoiceRef.current = '';
    echoGuardUntilRef.current = Date.now() + 900;
    window.clearTimeout(resumeListenTimerRef.current);
    if (!micEnabledRef.current || !listenAfterSpeechRef.current || !mountedRef.current) {
      if (!micEnabledRef.current) setFriendStatus('ready');
      return;
    }
    setFriendStatus('listening');
    resumeListenTimerRef.current = window.setTimeout(() => {
      if (
        !mountedRef.current
        || !micEnabledRef.current
        || isAiSpeakingRef.current
        || submitLockRef.current
        || isInterviewerAudioPlaying()
      ) return;
      startListeningRef.current?.({ afterSpeech: true });
    }, 400);
  }, [setFriendStatus]);

  const interruptSpeech = useCallback(() => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    stopInterviewerAudio();
    setIsVideoPlaying(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      interruptSpeech();
      stopRecognition();
      window.clearTimeout(persistTimerRef.current);
      window.clearTimeout(resumeListenTimerRef.current);
      isAiSpeakingRef.current = false;
    };
  }, [interruptSpeech, stopRecognition]);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const rows = await listFriendConversations();
      if (!mountedRef.current) return;
      setHistory(Array.isArray(rows) ? rows : []);
      setHistoryError('');
    } catch (err) {
      if (!mountedRef.current) return;
      setHistory([]);
      setHistoryError(friendApiErrorMessage(err) || 'Could not load conversation history.');
    } finally {
      if (mountedRef.current) setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const persistNow = useCallback(async (nextMessages, nextVideos, extras = {}) => {
    const payload = {
      title: titleFromMessages(nextMessages),
      mode,
      messages: nextMessages,
      videos: nextVideos,
      excludeVideoIds: excludeIdsRef.current,
      videoQuery: extras.videoQuery ?? videoQueryRef.current,
    };
    try {
      if (!conversationIdRef.current) {
        const created = await createFriendConversation(payload);
        if (!mountedRef.current || !created?.id) return;
        conversationIdRef.current = created.id;
        setConversationId(created.id);
      } else {
        await updateFriendConversation(conversationIdRef.current, payload);
      }
      if (mountedRef.current) setHistoryError('');
      refreshHistory();
    } catch (err) {
      if (mountedRef.current) {
        setHistoryError(friendApiErrorMessage(err) || 'Could not save this conversation.');
      }
    }
  }, [mode, refreshHistory]);

  const playAnswerSpeech = useCallback(async (speechText, speechChunks, requestId, onComplete) => {
    const chunks = Array.isArray(speechChunks) && speechChunks.length
      ? speechChunks.filter((item) => String(item || '').trim())
      : String(speechText || '').trim()
        ? [String(speechText).trim()]
        : [];
    if (!chunks.length || requestId !== requestIdRef.current) {
      onComplete?.({ ttsFailed: !chunks.length });
      return;
    }
    displayedTranscriptRef.current = '';
    pauseRecognitionForAi();
    setIsVideoPlaying(false);
    setPlaybackId(requestId);
    setFriendStatus('preparing');
    const controller = new AbortController();
    abortRef.current = controller;
    let startedAny = false;

    const showTranscript = (next) => {
      if (requestId !== requestIdRef.current || !mountedRef.current) return;
      const grown = growTranscript(displayedTranscriptRef.current, next);
      if (grown === displayedTranscriptRef.current) return;
      displayedTranscriptRef.current = grown;
      setCurrentAnswer(grown);
    };

    try {
      let pendingBlob = fetchInterviewFriendSpeech(chunks[0], { signal: controller.signal });
      for (let index = 0; index < chunks.length; index += 1) {
        if (requestId !== requestIdRef.current || !mountedRef.current) {
          onComplete?.({ interrupted: true });
          return;
        }
        const blob = await pendingBlob;
        if (index + 1 < chunks.length) {
          pendingBlob = fetchInterviewFriendSpeech(chunks[index + 1], { signal: controller.signal });
        }
        if (requestId !== requestIdRef.current || !mountedRef.current) {
          onComplete?.({ interrupted: true });
          return;
        }
        const prefix = chunks.slice(0, index).join(' ').trim();
        const chunkText = chunks[index];
        await playInterviewerAudioBlob(blob, {
          onStart: () => {
            if (requestId !== requestIdRef.current || !mountedRef.current) return;
            startedAny = true;
            pauseRecognitionForAi();
            setIsVideoPlaying(true);
            setFriendStatus('speaking');
            showTranscript([prefix, revealByProgress(chunkText, 0.08)].filter(Boolean).join(' '));
          },
          onTimeUpdate: ({ currentTime, duration }) => {
            if (requestId !== requestIdRef.current || !mountedRef.current) return;
            const progress = duration > 0 ? currentTime / duration : 0;
            showTranscript([prefix, revealByProgress(chunkText, progress)].filter(Boolean).join(' '));
          },
          onEnded: () => {
            if (requestId !== requestIdRef.current || !mountedRef.current) return;
            showTranscript([prefix, chunkText].filter(Boolean).join(' '));
            if (index === chunks.length - 1) setIsVideoPlaying(false);
          },
        });
      }
      if (requestId === requestIdRef.current && mountedRef.current) {
        if (!startedAny) {
          setAudioError(true);
          setIsVideoPlaying(false);
        } else {
          showTranscript(chunks.join(' '));
        }
        onComplete?.({ ttsFailed: !startedAny });
      }
    } catch (err) {
      if (isAbortError(err) || requestId !== requestIdRef.current) return;
      setVoiceHint(err?.message || 'Audio is temporarily unavailable. You can still read the response.');
      setAudioError(true);
      setIsVideoPlaying(false);
      onComplete?.({ ttsFailed: true });
    }
  }, [pauseRecognitionForAi, setFriendStatus]);

  const submitMessage = useCallback(async (rawText, { fromVoice = false, nextMode } = {}) => {
    const text = String(rawText || '').trim();
    if (!text) {
      setError('Please enter a question or message.');
      return;
    }
    if (fromVoice && (isAiSpeakingRef.current || isInterviewerAudioPlaying())) return;
    if (fromVoice && Date.now() < echoGuardUntilRef.current && isLikelyEcho(text, lastSpeechRef.current)) return;

    interruptSpeech();
    stopRecognition();
    submitLockRef.current = true;
    unlockInterviewerAudioElement();
    const requestId = requestIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const activeMode = nextMode || mode;
    listenAfterSpeechRef.current = micEnabledRef.current;
    setBusy(true);
    setError('');
    setVoiceHint('');
    setAudioError(false);
    setDraft('');
    setVideosLoading(looksLikeResourceRequest(text));
    setFriendStatus('thinking');
    setCurrentQuestion(text);
    setCurrentAnswer('');

    const userMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    const assistantId = `a-${Date.now()}`;
    setMessages((current) => [...current, userMessage, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      const payload = {
        message: text.slice(0, 2000),
        conversationContext: contextRef.current.map((turn) => ({ role: turn.role, content: turn.content })),
        mode: activeMode,
        includeReportContext: activeMode === 'analyze' || nextMode === 'analyze',
        lastVideo: lastVideoRef.current || undefined,
        excludeVideoIds: excludeIdsRef.current,
        videoQuery: videoQueryRef.current,
      };
      const data = await sendInterviewFriendMessage(payload, { signal: controller.signal });
      if (requestId !== requestIdRef.current || !mountedRef.current) return;
      const displayAnswer = normalizeFriendDisplayAnswer(data?.answer || '')
        || normalizeFriendDisplayAnswer(data?.speechText || '');
      const spoken = String(data?.speechText || displayAnswer || '').trim();
      const nextTopic = String(data?.topic || '').replace(/\s+/g, ' ').trim();
      if (nextTopic && !/^(programming|this topic|topic|latest tech videos?)$/i.test(nextTopic)) {
        videoQueryRef.current = nextTopic.slice(0, 180);
      } else if (!looksLikeResourceRequest(text) && !videoQueryRef.current) {
        const stripped = text
          .replace(/^(please\s+)?((can|could|would)\s+you\s+)?/i, '')
          .replace(/^(explain|describe|teach me|teach|define|what are|what is|what's|whats|tell me about)\s+/i, '')
          .replace(/[?.!]+$/g, '')
          .trim();
        if (stripped && stripped.length <= 80) videoQueryRef.current = stripped.slice(0, 180);
      }
      lastSpeechRef.current = spoken;
      displayedTranscriptRef.current = '';
      setCurrentAnswer('');
      setPlaybackId(requestId);
      setIsVideoPlaying(false);
      const nextVideos = Array.isArray(data?.videos) ? data.videos.slice(0, 3) : [];
      if (nextVideos.length) {
        videosRef.current = nextVideos;
        setVideos(nextVideos);
        setVideosExhausted(false);
        lastVideoRef.current = nextVideos[0];
        const playable = nextVideos.find((item) => item.embedUrl) || nextVideos[0];
        setActiveVideoId(playable.videoId || '');
        excludeIdsRef.current = [...excludeIdsRef.current, ...nextVideos.map((item) => item.videoId).filter(Boolean)].slice(-40);
      } else if (data?.videosExhausted) {
        videosRef.current = [];
        setVideos([]);
        setVideosExhausted(true);
      }
      const videosToSave = nextVideos.length ? nextVideos : videosRef.current;
      setMessages((current) => {
        const next = current.map((item) => (
          item.id === assistantId ? { ...item, content: '' } : item
        ));
        persistNow(next, videosToSave);
        return next;
      });
      setVideosLoading(false);
      pauseRecognitionForAi();
      setFriendStatus('preparing');

      const finishReady = () => {
        if (requestId !== requestIdRef.current || !mountedRef.current) return;
        resumeRecognitionAfterAi();
      };

      const finalizeAnswer = (textToShow) => {
        const finalText = String(textToShow || displayAnswer || spoken || '').trim();
        setCurrentAnswer(finalText);
        setMessages((current) => {
          const next = current.map((item) => (
            item.id === assistantId ? { ...item, content: finalText } : item
          ));
          persistNow(next, videosToSave);
          return next;
        });
      };

      await playAnswerSpeech(
        spoken,
        data?.speechChunks,
        requestId,
        ({ ttsFailed } = {}) => {
          if (ttsFailed) {
            setAudioError(true);
            setIsVideoPlaying(false);
          }
          finalizeAnswer(displayAnswer || spoken);
          finishReady();
        }
      );
      contextRef.current = [
        ...contextRef.current,
        { role: 'user', content: text.slice(0, 600) },
        { role: 'assistant', content: (displayAnswer || spoken).slice(0, 600) },
      ].slice(-16);
      if (requestId === requestIdRef.current && statusRef.current === 'thinking') {
        setFriendStatus('ready');
      }
    } catch (err) {
      if (isAbortError(err) || requestId !== requestIdRef.current) return;
      setError(friendApiErrorMessage(err));
      setFriendStatus('ready');
      setMessages((current) => current.filter((item) => item.id !== assistantId || item.content));
    } finally {
      if (requestId === requestIdRef.current) {
        submitLockRef.current = false;
        if (mountedRef.current) {
          setBusy(false);
          setVideosLoading(false);
        }
      }
    }
  }, [interruptSpeech, mode, pauseRecognitionForAi, persistNow, playAnswerSpeech, resumeRecognitionAfterAi, setFriendStatus, stopRecognition]);

  const startListening = useCallback(async ({ afterSpeech = false } = {}) => {
    if (!micEnabledRef.current || !listenAfterSpeechRef.current) return;
    if (isAiSpeakingRef.current || isInterviewerAudioPlaying()) return;
    if (statusRef.current === 'speaking' || statusRef.current === 'thinking' || statusRef.current === 'preparing') return;
    if (recognitionRef.current) return;
    const Ctor = speechEngine();
    if (!Ctor) {
      setVoiceHint('Voice input is not available in this browser. Use Start listening after granting access, or type your question.');
      setMicEnabled(false);
      micEnabledRef.current = false;
      setListenBlocked(true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceHint('Microphone access is not available. Type your question instead.');
      setMicEnabled(false);
      micEnabledRef.current = false;
      setListenBlocked(true);
      return;
    }

    stopRecognition();
    unlockInterviewerAudioElement();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setListenBlocked(false);
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setVoiceHint(
        denied
          ? 'Microphone permission was denied. Click Start listening to try again, or type your question.'
          : 'Could not access the microphone. Click Start listening, or type your question.'
      );
      setMicEnabled(false);
      micEnabledRef.current = false;
      setListenBlocked(true);
      return;
    }

    if (isAiSpeakingRef.current || !micEnabledRef.current) return;

    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    const gen = ++listenGenRef.current;
    recognitionRef.current = rec;
    pendingVoiceRef.current = '';
    setError('');
    setVoiceHint(afterSpeech ? '' : '');
    setFriendStatus('listening');

    const ignoreAiSpeech = () => (
      isAiSpeakingRef.current
      || isInterviewerAudioPlaying()
      || statusRef.current === 'speaking'
      || statusRef.current === 'thinking'
      || statusRef.current === 'preparing'
    );

    rec.onresult = (event) => {
      if (gen !== listenGenRef.current) return;
      if (ignoreAiSpeech()) {
        pendingVoiceRef.current = '';
        return;
      }
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0]?.transcript || '';
      }
      const next = transcript.trim();
      if (!next) return;
      if (Date.now() < echoGuardUntilRef.current && isLikelyEcho(next, lastSpeechRef.current)) {
        pendingVoiceRef.current = '';
        return;
      }
      const last = event.results[event.results.length - 1];
      pendingVoiceRef.current = next;
      if (next) setDraft(next);
      if (last?.isFinal && next && !submitLockRef.current && !ignoreAiSpeech()) {
        pendingVoiceRef.current = '';
        stopRecognition();
        submitMessage(next, { fromVoice: true });
      }
    };
    rec.onerror = (event) => {
      if (gen !== listenGenRef.current) return;
      pendingVoiceRef.current = '';
      stopRecognition();
      if (event?.error === 'not-allowed') {
        setVoiceHint('Microphone permission was denied. Click Start listening, or type your question.');
        setMicEnabled(false);
        micEnabledRef.current = false;
        setListenBlocked(true);
      } else if (event?.error === 'no-speech') {
        if (micEnabledRef.current && statusRef.current === 'listening' && !ignoreAiSpeech()) {
          startListeningRef.current?.({ afterSpeech: true });
        }
        return;
      } else if (event?.error !== 'aborted') {
        setVoiceHint('Speech recognition failed. Click Start listening, or type your question.');
        setListenBlocked(true);
      }
      if (statusRef.current === 'listening' && !ignoreAiSpeech()) setFriendStatus('ready');
    };
    rec.onend = () => {
      if (gen !== listenGenRef.current) return;
      if (recognitionRef.current === rec) recognitionRef.current = null;
      pendingVoiceRef.current = '';
      if (ignoreAiSpeech()) return;
      if (
        micEnabledRef.current
        && listenAfterSpeechRef.current
        && !submitLockRef.current
        && statusRef.current === 'listening'
        && mountedRef.current
      ) {
        window.setTimeout(() => {
          if (
            micEnabledRef.current
            && statusRef.current === 'listening'
            && !recognitionRef.current
            && !isAiSpeakingRef.current
            && !isInterviewerAudioPlaying()
          ) {
            startListeningRef.current?.({ afterSpeech: true });
          }
        }, 200);
      }
    };
    try {
      rec.start();
    } catch {
      setVoiceHint('Could not start listening. Click Start listening, or type your question.');
      setListenBlocked(true);
      if (statusRef.current === 'listening') setFriendStatus('ready');
    }
  }, [setFriendStatus, stopRecognition, submitMessage]);

  startListeningRef.current = startListening;

  useEffect(() => {
    const gen = ++greetingGenRef.current;
    const name = firstNameFromUser(user);
    const line = `Welcome, ${name}. How can I help you?`;
    lastSpeechRef.current = line;
    displayedTranscriptRef.current = '';
    let started = false;

    (async () => {
      unlockInterviewerAudioElement();
      try {
        const stream = await navigator.mediaDevices?.getUserMedia?.({ audio: true });
        stream?.getTracks?.().forEach((track) => track.stop());
        if (gen === greetingGenRef.current) setListenBlocked(false);
      } catch (err) {
        if (gen !== greetingGenRef.current) return;
        const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
        setVoiceHint(
          denied
            ? 'Microphone permission was denied. Click Start listening, or type your question.'
            : 'Could not start the microphone. Click Start listening, or type your question.'
        );
        setMicEnabled(false);
        micEnabledRef.current = false;
        setListenBlocked(true);
      }
      if (gen !== greetingGenRef.current || !mountedRef.current || greetingPlayedRef.current) return;
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = requestIdRef.current;
      pauseRecognitionForAi();
      setPlaybackId(requestId);
      setIsVideoPlaying(false);
      setFriendStatus('preparing');
      try {
        const blob = await fetchInterviewFriendSpeech(line, { signal: controller.signal });
        if (gen !== greetingGenRef.current || requestId !== requestIdRef.current || !mountedRef.current) return;
        await playInterviewerAudioBlob(blob, {
          onStart: () => {
            if (gen !== greetingGenRef.current || !mountedRef.current) return;
            started = true;
            greetingPlayedRef.current = true;
            pauseRecognitionForAi();
            setIsVideoPlaying(true);
            setFriendStatus('speaking');
          },
          onEnded: () => {
            if (gen !== greetingGenRef.current || !mountedRef.current) return;
            setIsVideoPlaying(false);
          },
        });
        greetingPlayedRef.current = true;
      } catch (err) {
        if (!isAbortError(err) && gen === greetingGenRef.current) {
          setVoiceHint('I could not play the welcome greeting. You can still speak or type.');
        }
      }
      if (gen !== greetingGenRef.current || requestId !== requestIdRef.current || !mountedRef.current) return;
      resumeRecognitionAfterAi();
    })();

    return () => {
      if (greetingGenRef.current === gen) greetingGenRef.current += 1;
      if (!started) greetingPlayedRef.current = false;
    };
  }, [pauseRecognitionForAi, resumeRecognitionAfterAi, setFriendStatus]);

  const handleVoicePress = useCallback(() => {
    if (micEnabledRef.current && !listenBlocked) {
      micEnabledRef.current = false;
      listenAfterSpeechRef.current = false;
      setMicEnabled(false);
      stopRecognition();
      if (statusRef.current === 'listening') setFriendStatus('ready');
      return;
    }
    micEnabledRef.current = true;
    listenAfterSpeechRef.current = true;
    setMicEnabled(true);
    setListenBlocked(false);
    setVoiceHint('');
    if (isAiSpeakingRef.current || statusRef.current === 'speaking' || statusRef.current === 'thinking' || statusRef.current === 'preparing') return;
    startListening();
  }, [listenBlocked, setFriendStatus, startListening, stopRecognition]);

  const sendDraft = useCallback(() => {
    submitMessage(draft, { fromVoice: false });
  }, [draft, submitMessage]);

  const applyQuickAction = useCallback((actionId) => {
    const starter = MODE_STARTERS[actionId];
    if (!starter) return;
    setMode(actionId);
    submitMessage(starter.message, { fromVoice: false, nextMode: actionId });
  }, [submitMessage]);

  const stopSpeaking = useCallback(() => {
    interruptSpeech();
    setIsVideoPlaying(false);
    setBusy(false);
    resumeRecognitionAfterAi();
  }, [interruptSpeech, resumeRecognitionAfterAi]);

  const replayLastSpeech = useCallback(async () => {
    const spoken = lastSpeechRef.current;
    if (!spoken) return;
    interruptSpeech();
    pauseRecognitionForAi();
    const requestId = requestIdRef.current;
    await playAnswerSpeech(spoken, null, requestId, () => {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setIsVideoPlaying(false);
      resumeRecognitionAfterAi();
    });
  }, [interruptSpeech, pauseRecognitionForAi, playAnswerSpeech, resumeRecognitionAfterAi, setFriendStatus]);

  const resetConversation = useCallback(async () => {
    listenAfterSpeechRef.current = micEnabledRef.current;
    interruptSpeech();
    isAiSpeakingRef.current = false;
    stopRecognition();
    contextRef.current = [];
    lastVideoRef.current = null;
    excludeIdsRef.current = [];
    videoQueryRef.current = '';
    videosRef.current = [];
    conversationIdRef.current = '';
    setConversationId('');
    setDraft('');
    setCurrentQuestion('');
    setCurrentAnswer('');
    setMessages([]);
    setVideos([]);
    setVideosExhausted(false);
    setActiveVideoId('');
    setIsVideoPlaying(false);
    setError('');
    setVoiceHint('');
    setBusy(false);
    setMode('general');
    setFriendStatus('ready');
    try {
      const created = await createFriendConversation({
        title: 'New conversation',
        mode: 'general',
        messages: [],
        videos: [],
      });
      if (mountedRef.current && created?.id) {
        conversationIdRef.current = created.id;
        setConversationId(created.id);
        setHistoryError('');
        refreshHistory();
      }
    } catch (err) {
      if (mountedRef.current) {
        setHistoryError(friendApiErrorMessage(err) || 'Could not start a new conversation.');
      }
    }
    if (micEnabledRef.current) {
      window.setTimeout(() => startListeningRef.current?.(), 200);
    }
  }, [interruptSpeech, refreshHistory, setFriendStatus, stopRecognition]);

  const clearChat = useCallback(() => {
    interruptSpeech();
    isAiSpeakingRef.current = false;
    contextRef.current = [];
    lastVideoRef.current = null;
    excludeIdsRef.current = [];
    videoQueryRef.current = '';
    videosRef.current = [];
    displayedTranscriptRef.current = '';
    setDraft('');
    setCurrentQuestion('');
    setCurrentAnswer('');
    setMessages([]);
    setVideos([]);
    setVideosExhausted(false);
    setActiveVideoId('');
    setError('');
    setVoiceHint('');
    setAudioError(false);
    setFriendStatus('ready');
    persistNow([], []);
  }, [interruptSpeech, persistNow, setFriendStatus]);

  const loadConversation = useCallback(async (id) => {
    if (!id) return;
    try {
      const row = await getFriendConversation(id);
      if (!row) return;
      interruptSpeech();
      isAiSpeakingRef.current = false;
      stopRecognition();
      conversationIdRef.current = row.id;
      setConversationId(row.id);
      setMessages(Array.isArray(row.messages) ? row.messages : []);
      const rows = Array.isArray(row.messages) ? row.messages : [];
      const lastUser = [...rows].reverse().find((item) => item.role === 'user');
      const lastAi = [...rows].reverse().find((item) => item.role === 'assistant');
      setCurrentQuestion(lastUser?.content || '');
      setCurrentAnswer(lastAi?.content || '');
      setVideos(Array.isArray(row.videos) ? row.videos.slice(0, 3) : []);
      videosRef.current = Array.isArray(row.videos) ? row.videos.slice(0, 3) : [];
      setVideosExhausted(false);
      setMode(row.mode || 'general');
      contextRef.current = (row.messages || []).slice(-16).map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: String(item.content || '').slice(0, 600),
      }));
      excludeIdsRef.current = Array.isArray(row.excludeVideoIds) ? row.excludeVideoIds : [];
      videoQueryRef.current = row.videoQuery || '';
      lastVideoRef.current = row.videos?.[0] || null;
      setActiveVideoId(row.videos?.[0]?.videoId || '');
      setDraft('');
      setError('');
      setFriendStatus('ready');
      setHistoryOpen(false);
      if (micEnabledRef.current) {
        window.setTimeout(() => startListeningRef.current?.(), 200);
      }
    } catch (err) {
      setError(friendApiErrorMessage(err));
    }
  }, [interruptSpeech, setFriendStatus, stopRecognition]);

  return {
    draft,
    setDraft,
    mode,
    status,
    messages,
    videos,
    videosExhausted,
    videosLoading,
    activeVideoId,
    setActiveVideoId,
    currentQuestion,
    currentAnswer,
    playbackId,
    isVideoPlaying,
    listenBlocked,
    audioError,
    error,
    voiceHint,
    busy,
    micEnabled,
    history,
    historyLoading,
    historyError,
    conversationId,
    historyOpen,
    setHistoryOpen,
    applyQuickAction,
    sendDraft,
    handleVoicePress,
    stopSpeaking,
    replayLastSpeech,
    resetConversation,
    clearChat,
    loadConversation,
  };
}
