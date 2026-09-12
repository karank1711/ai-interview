import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  VideoCameraIcon,
  MicrophoneIcon,
  CheckCircleIcon,
  PhoneXMarkIcon,
} from '@heroicons/react/24/outline';
import { interviewService } from '../services/interviewService';
import { useGeminiLive } from '../hooks/useGeminiLive';
import {
  cacheInterviewMedia,
  getCachedInterviewMedia,
  hasLiveTrack,
  MIC_AUDIO_CONSTRAINTS,
  stopAndClearInterviewMedia,
} from '../utils/interviewMediaStore';
import { unlockInterviewAudioContexts } from '../utils/interviewAudio';
import { stopInterviewerAudio, unlockInterviewerAudioElement } from '../utils/interviewerPlayback';
import { usePopup } from '../components/AppPopup';
import InterviewTranscriptBox from '../components/InterviewTranscriptBox';
import { useFacialAnalysis } from '../hooks/useFacialAnalysis';
import { expressionLabel } from '../utils/facialSignals';

const INTERVIEWER_VIDEO = '/video/ai-interview.mp4';
const SILENCE_MS = 3000;
const TALKING_PHASES = ['AI_SPEAKING', 'HOLD', 'CLOSING', 'FEEDBACK'];
const INTRO_QUESTION_ID = 'intro-self';
const INTRO_QUESTION = {
  id: INTRO_QUESTION_ID,
  questionText: 'Please introduce yourself.',
};

const END_MESSAGES = {
  COMPLETED: 'Interview completed normally.',
  ENDED_EARLY: 'Interview was ended early by the candidate.',
};

function getHoldKind(videoStream, audioStream, facePresent) {
  const cameraOk = hasLiveTrack(videoStream, 'video');
  const micOk = hasLiveTrack(audioStream, 'audio');
  if (!cameraOk && !micOk) return 'CAMERA_AND_MIC_OFF';
  if (!micOk) return 'MIC_OFF';
  if (!cameraOk) return 'CAMERA_OFF';
  if (!facePresent) return 'FACE_MISSING';
  return null;
}

function holdWarningText(kind) {
  if (kind === 'CAMERA_AND_MIC_OFF') return 'Please turn on your camera and microphone.';
  if (kind === 'MIC_OFF') return 'Please turn on your microphone.';
  if (kind === 'CAMERA_OFF') return 'Please turn on your camera.';
  return 'Your face is not visible. Please come back in front of the camera.';
}

function normalizeSpokenIntent(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRepeatQuestionIntent(text) {
  const normalized = normalizeSpokenIntent(text);
  if (!normalized) return false;
  const words = normalized.split(' ').filter(Boolean);
  if (words.length === 0 || words.length > 16) return false;
  return (
    /repeat( the)?( current)?( interview)?( question)?/.test(normalized) ||
    /can you (please )?repeat/.test(normalized) ||
    /could you (please )?repeat/.test(normalized) ||
    /please repeat/.test(normalized) ||
    /say (that|it|the question) again/.test(normalized) ||
    /can you (say|ask) (that|it|the question) again/.test(normalized) ||
    /what (was|is) the question/.test(normalized) ||
    /one more time/.test(normalized) ||
    /come again/.test(normalized)
  );
}

function isDontKnowIntent(text) {
  const normalized = normalizeSpokenIntent(text);
  if (!normalized) return false;
  const words = normalized.split(' ').filter(Boolean);
  if (words.length === 0 || words.length > 18) return false;
  return (
    /i don t know/.test(normalized) ||
    /i do not know/.test(normalized) ||
    /i have no idea/.test(normalized) ||
    /no idea/.test(normalized) ||
    /not sure( about)?( this| the)?( answer| question)?/.test(normalized) ||
    /skip( this)?( question)?/.test(normalized) ||
    /pass( on)?( this)?( one| question)?/.test(normalized) ||
    /don t know (this|the|that)( answer| question)?/.test(normalized)
  );
}

function candidateFirstName(user) {
  const raw = String(user?.name || user?.fullName || '').trim();
  if (!raw) return 'there';
  return raw.split(/\s+/)[0];
}

function attachIntroQuestion(list) {
  const domain = (Array.isArray(list) ? list : []).filter((item) => item?.id !== INTRO_QUESTION_ID);
  return [INTRO_QUESTION, ...domain];
}

function domainQuestionCount(list) {
  return (Array.isArray(list) ? list : []).filter((item) => item?.id !== INTRO_QUESTION_ID).length;
}

function spokenWordCount(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function canReusePrepared(preparedText, finalText) {
  const a = String(preparedText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const b = String(finalText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (!b.startsWith(a)) return false;
  const extra = b.slice(a.length).trim();
  return extra.split(/\s+/).filter(Boolean).length <= 8;
}

function spokenFeedbackLine(evaluation, graderFeedback) {
  const key = String(evaluation || '').toLowerCase();
  const extra = String(graderFeedback || '')
    .replace(/^(correct|partially_correct|incorrect|unanswered|ungraded):\s*/i, '')
    .trim();
  if (key === 'correct') {
    return extra
      ? `Good answer. ${extra}`.slice(0, 280)
      : 'Good answer. You covered the key points clearly.';
  }
  if (key === 'partially_correct') {
    return extra
      ? `You're on the right track, but some points are missing. ${extra}`.slice(0, 280)
      : "You're on the right track, but a stronger answer would cover the missing points more clearly.";
  }
  if (key === 'incorrect') {
    return extra
      ? `That's not quite correct. ${extra}`.slice(0, 280)
      : "That's not quite correct. Focus on the core concept the question asked for.";
  }
  return extra || 'Thanks for your answer. Let us continue.';
}

const InterviewRoom = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showPopup } = usePopup();
  const isSessionRoute = location.pathname.endsWith('/session');

  const [interview, setInterview] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [plannedQuestionCount, setPlannedQuestionCount] = useState(5);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [answer, setAnswer] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [videoStream, setVideoStream] = useState(null);
  const [audioStream, setAudioStream] = useState(null);
  const [avatarRatio, setAvatarRatio] = useState(16 / 9);

  const [sessionsReady, setSessionsReady] = useState(false);
  const videoRef = useRef(null);
  const interviewerVideoRef = useRef(null);
  const videoStreamRef = useRef(null);
  const audioStreamRef = useRef(null);
  const questionsRef = useRef([]);
  const plannedCountRef = useRef(5);
  const nextQuestionPromiseRef = useRef(null);
  const requestNextQuestionRef = useRef(async () => null);
  const indexRef = useRef(0);
  const phaseRef = useRef('idle');
  const speakingRef = useRef(false);
  const liveReadyRef = useRef(false);
  const connectingRef = useRef(false);
  const endingRef = useRef(false);
  const advancingRef = useRef(false);
  const facePresentRef = useRef(false);
  const questionAskedRef = useRef(false);
  const askedCountRef = useRef(0);
  const pausedPhaseRef = useRef(null);
  const lastWarningKindRef = useRef(null);
  const warningSpokenRef = useRef(false);
  const questionPromptSentRef = useRef(false);
  const submittedIndexRef = useRef({});
  const lastSpeechAtRef = useRef(0);
  const listenStartedAtRef = useRef(0);
  const transcriptRef = useRef('');
  const committedTranscriptRef = useRef('');
  const answersByIndexRef = useRef([]);
  const hadSpeechRef = useRef(false);
  const holdFnRef = useRef(() => {});
  const resumeFnRef = useRef(() => {});
  const greetingDoneRef = useRef(false);
  const handleRepeatRef = useRef(async () => {});
  const handleDontKnowRef = useRef(async () => {});
  const repeatInFlightRef = useRef(false);
  const dontKnowInFlightRef = useRef(false);
  const askFnRef = useRef(() => {});
  const micToggleGenRef = useRef(0);
  const evalPrepRef = useRef({
    gen: 0,
    questionIndex: -1,
    transcript: '',
    abort: null,
    promise: null,
    result: null,
    timer: null,
  });
  const scheduleDraftEvalRef = useRef(() => {});

  const setPhaseSafe = (next) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const bumpEvalPrep = useCallback(() => {
    const state = evalPrepRef.current;
    state.gen += 1;
    if (state.timer) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
    try {
      state.abort?.abort();
    } catch {
      /* ignore */
    }
    state.abort = null;
    state.promise = null;
    state.result = null;
    state.transcript = '';
    state.questionIndex = -1;
  }, []);

  const { live: facialLive, getReport: getFacialReport } = useFacialAnalysis({
    videoRef,
    enabled: isSessionRoute,
    onFacePresenceChange: (visible) => {
      facePresentRef.current = visible;
      console.log('[FACE]', visible ? 'present' : 'missing');
      if (!liveReadyRef.current || endingRef.current) return;
      if (!visible) holdFnRef.current();
    },
  });

  const muteInterviewerVideo = useCallback((node = interviewerVideoRef.current) => {
    if (!node) return;
    if (!node.muted) node.muted = true;
    if (!node.defaultMuted) node.defaultMuted = true;
    if (node.volume !== 0) node.volume = 0;
    node.playsInline = true;
  }, []);

  const pauseInterviewerVideo = useCallback(() => {
    const node = interviewerVideoRef.current;
    if (!node) return;
    muteInterviewerVideo(node);
    try {
      node.pause();
    } catch {
      /* ignore */
    }
  }, [muteInterviewerVideo]);

  const resetInterviewerVideo = useCallback(() => {
    const node = interviewerVideoRef.current;
    if (!node) return;
    muteInterviewerVideo(node);
    try {
      node.pause();
    } catch {
      /* ignore */
    }
    try {
      node.currentTime = 0;
    } catch {
      /* ignore */
    }
  }, [muteInterviewerVideo]);

  const canPlayInterviewerAvatar = useCallback((kind) => {
    if (kind === 'warning' || kind === 'greeting' || kind === 'feedback' || kind === 'closing' || kind === 'question') {
      return TALKING_PHASES.includes(phaseRef.current) || kind === 'warning';
    }
    return TALKING_PHASES.includes(phaseRef.current);
  }, []);

  const playInterviewerVideo = useCallback((reset = false, kind) => {
    if (!canPlayInterviewerAvatar(kind)) {
      pauseInterviewerVideo();
      return;
    }
    const node = interviewerVideoRef.current;
    if (!node) return;
    muteInterviewerVideo(node);
    if (reset) {
      try {
        node.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    node.play()?.catch?.(() => {});
  }, [canPlayInterviewerAvatar, muteInterviewerVideo, pauseInterviewerVideo]);

  const gemini = useGeminiLive({
    onSpeakingChange: (speaking, extra = {}) => {
      speakingRef.current = speaking;
      if (speaking) {
        if (extra.kind === 'question') {
          askedCountRef.current = Math.max(askedCountRef.current, indexRef.current + 1);
          questionAskedRef.current = true;
        }
        if (TALKING_PHASES.includes(phaseRef.current) || extra.kind === 'warning') {
          playInterviewerVideo(extra.kind === 'question' || extra.kind === 'greeting', extra.kind);
        }
        return;
      }
      pauseInterviewerVideo();
      if (phaseRef.current === 'CLOSING') return;
      if (!extra.turnComplete) return;
      if (phaseRef.current === 'HOLD' || getHoldKind(videoStreamRef.current, audioStreamRef.current, facePresentRef.current)) {
        holdFnRef.current();
        return;
      }
      if (phaseRef.current === 'AI_SPEAKING' && extra.kind === 'question') {
        geminiRef.current.resetCandidateTranscript?.();
        setAnswer('');
        transcriptRef.current = '';
        committedTranscriptRef.current = '';
        hadSpeechRef.current = false;
        lastSpeechAtRef.current = 0;
        repeatInFlightRef.current = false;
        dontKnowInFlightRef.current = false;
        setPhaseSafe('LISTENING');
        setStatusMessage('Listening to your answer');
      }
    },
    onInputTranscript: ({ display, finalized, interim } = {}) => {
      if (phaseRef.current !== 'LISTENING') return;
      const shown = String(display || '').trim();
      const committed = String(finalized || '').trim();
      if (committed || String(interim || '').trim()) {
        lastSpeechAtRef.current = Date.now();
        hadSpeechRef.current = true;
      }
      transcriptRef.current = shown;
      committedTranscriptRef.current = committed;
      setAnswer(shown);
      if (shown) scheduleDraftEvalRef.current(shown);
      if (phaseRef.current !== 'LISTENING') return;
      if (advancingRef.current || endingRef.current) return;
      if (repeatInFlightRef.current || dontKnowInFlightRef.current) return;
      const intentText = committed;
      if (!intentText) return;
      if (isDontKnowIntent(intentText)) {
        handleDontKnowRef.current();
        return;
      }
      if (isRepeatQuestionIntent(intentText)) {
        handleRepeatRef.current();
      }
    },
    onOutputTranscript: (text, extra = {}) => {
      if (extra.kind !== 'question' || !extra.audioStarted) return;
      const next = String(text || '').trim();
      if (!next) return;
      askedCountRef.current = Math.max(askedCountRef.current, indexRef.current + 1);
      questionAskedRef.current = true;
      setAiTranscript(next);
    },
    onVoiceActivity: () => {
      if (phaseRef.current === 'LISTENING') {
        lastSpeechAtRef.current = Date.now();
        hadSpeechRef.current = true;
      }
    },
    onError: (error) => {
      setStatusMessage(error.message || 'Live interviewer connection failed.');
      pauseInterviewerVideo();
    },
  });

  const geminiRef = useRef(gemini);
  geminiRef.current = gemini;

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    videoStreamRef.current = videoStream;
  }, [videoStream]);

  useEffect(() => {
    audioStreamRef.current = audioStream;
  }, [audioStream]);

  const applyMediaStreams = useCallback((video, audio) => {
    if (hasLiveTrack(video, 'video')) {
      videoStreamRef.current = video;
      setVideoStream(video);
      setIsVideoEnabled(true);
      if (videoRef.current) {
        videoRef.current.srcObject = video;
        videoRef.current.play?.().catch?.(() => {});
      }
    }
    if (hasLiveTrack(audio, 'audio')) {
      audioStreamRef.current = audio;
      setAudioStream(audio);
      setIsAudioEnabled(true);
    }
    cacheInterviewMedia(id, videoStreamRef.current, audioStreamRef.current);
  }, [id]);

  const stopMedia = useCallback(() => {
    stopAndClearInterviewMedia(id);
    videoStreamRef.current = null;
    audioStreamRef.current = null;
    setVideoStream(null);
    setAudioStream(null);
    setIsVideoEnabled(false);
    setIsAudioEnabled(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [id]);

  const ensureLiveMedia = useCallback(async () => {
    let video = videoStreamRef.current;
    let audio = audioStreamRef.current;
    const cached = getCachedInterviewMedia(id);
    if (!hasLiveTrack(video, 'video') && cached.video) video = cached.video;
    if (!hasLiveTrack(audio, 'audio') && cached.audio) audio = cached.audio;
    if (!hasLiveTrack(video, 'video')) {
      video = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
    }
    if (!hasLiveTrack(audio, 'audio')) {
      audio = await navigator.mediaDevices.getUserMedia({ audio: MIC_AUDIO_CONSTRAINTS });
    }
    applyMediaStreams(video, audio);
    return {
      cameraOk: hasLiveTrack(videoStreamRef.current, 'video'),
      micOk: hasLiveTrack(audioStreamRef.current, 'audio'),
    };
  }, [applyMediaStreams, id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const interviewResponse = await interviewService.getInterviewById(id);
        if (cancelled) return;
        const data = interviewResponse.data;
        setInterview(data);
        const stored = attachIntroQuestion(Array.isArray(data?.questions) ? data.questions : []);
        setQuestions(stored);
        questionsRef.current = stored;
        const plannedDomain = Number(data?.plannedQuestionCount) > 0 ? Number(data.plannedQuestionCount) : 5;
        plannedCountRef.current = plannedDomain + 1;
        setPlannedQuestionCount(plannedDomain + 1);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch interview data:', error);
        navigate('/dashboard');
      }
    };
    load();
    const cached = getCachedInterviewMedia(id);
    if (cached.video || cached.audio) applyMediaStreams(cached.video, cached.audio);
    return () => {
      cancelled = true;
    };
  }, [applyMediaStreams, id, navigate]);

  useEffect(() => {
    return () => {
      if (window.location.pathname.includes(`/interview/${id}`)) return;
      pauseInterviewerVideo();
      stopInterviewerAudio();
      bumpEvalPrep();
      geminiRef.current.disconnect();
      stopMedia();
    };
  }, [bumpEvalPrep, id, pauseInterviewerVideo, stopMedia]);

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play?.().catch?.(() => {});
    }
  }, [videoStream]);

  const askCurrentQuestion = useCallback(async () => {
    if (endingRef.current) return;
    let item = questionsRef.current[indexRef.current];
    if (!item && indexRef.current < (plannedCountRef.current || 5)) {
      item = await requestNextQuestionRef.current();
    }
    if (!item) return;
    const blocked = getHoldKind(videoStreamRef.current, audioStreamRef.current, facePresentRef.current);
    if (blocked) {
      holdFnRef.current();
      return;
    }
    questionPromptSentRef.current = true;
    setPhaseSafe('AI_SPEAKING');
    if (!greetingDoneRef.current && indexRef.current === 0) {
      greetingDoneRef.current = true;
      setStatusMessage('AI is greeting you');
      resetInterviewerVideo();
      try {
        await geminiRef.current.sendLine(`Hello, ${candidateFirstName(user)}.`, { kind: 'greeting' });
      } catch (error) {
        console.error('[AI-VOICE] greeting failed', error);
      }
      if (endingRef.current) return;
    }
    transcriptRef.current = '';
    committedTranscriptRef.current = '';
    setAnswer('');
    hadSpeechRef.current = false;
    lastSpeechAtRef.current = 0;
    bumpEvalPrep();
    setPhaseSafe('AI_SPEAKING');
    setStatusMessage('AI is asking the question');
    resetInterviewerVideo();
    try {
      await geminiRef.current.sendQuestion(item.questionText);
    } catch (error) {
      console.error('[AI-VOICE] question playback failed', error);
    }
    if (indexRef.current === 0) {
      requestNextQuestionRef.current().catch((error) => {
        console.error('[HF-QUESTION] prefetch domain question failed', error);
      });
    }
  }, [bumpEvalPrep, resetInterviewerVideo, user]);

  askFnRef.current = askCurrentQuestion;

  const enterHold = useCallback(async () => {
    if (endingRef.current || !liveReadyRef.current) return;
    const kind = getHoldKind(videoStreamRef.current, audioStreamRef.current, facePresentRef.current);
    if (!kind) {
      resumeFnRef.current();
      return;
    }
    pauseInterviewerVideo();
    const spoken = holdWarningText(kind);
    if (phaseRef.current === 'HOLD' || warningSpokenRef.current) {
      lastWarningKindRef.current = kind;
      geminiRef.current.stopListening();
      setPhaseSafe('HOLD');
      setStatusMessage(spoken);
      return;
    }
    if (phaseRef.current !== 'HOLD') {
      pausedPhaseRef.current = phaseRef.current;
    }
    geminiRef.current.stopListening();
    setPhaseSafe('HOLD');
    setStatusMessage(spoken);
    lastWarningKindRef.current = kind;
    warningSpokenRef.current = true;
    try {
      await geminiRef.current.sendSpokenMessage(spoken);
    } catch (error) {
      console.error('[GEMINI] Device warning failed', error);
    }
  }, [pauseInterviewerVideo]);

  holdFnRef.current = enterHold;

  const resumeWhenReady = useCallback(() => {
    if (endingRef.current || !liveReadyRef.current) return;
    const kind = getHoldKind(videoStreamRef.current, audioStreamRef.current, facePresentRef.current);
    if (kind) {
      enterHold();
      return;
    }
    if (phaseRef.current === 'CLOSING' || phaseRef.current === 'AI_SPEAKING' || phaseRef.current === 'FEEDBACK') {
      return;
    }
    lastWarningKindRef.current = null;
    warningSpokenRef.current = false;
    const paused = pausedPhaseRef.current;
    pausedPhaseRef.current = null;
    const needFirstQuestion =
      askedCountRef.current === 0 && !questionPromptSentRef.current && paused !== 'LISTENING';
    if (needFirstQuestion) {
      askCurrentQuestion();
      return;
    }
    if (questionPromptSentRef.current && askedCountRef.current === 0) {
      askCurrentQuestion();
      return;
    }
    setPhaseSafe('LISTENING');
    setStatusMessage('Listening to your answer');
    const audio = audioStreamRef.current;
    if (hasLiveTrack(audio, 'audio')) {
      geminiRef.current.startListening(audio).catch((error) => {
        console.error('[MIC] Could not resume microphone audio.', error);
      });
    }
  }, [askCurrentQuestion, enterHold]);

  resumeFnRef.current = resumeWhenReady;

  const saveCurrentAnswer = useCallback(async () => {
    const questionIndex = indexRef.current;
    const question = questionsRef.current[questionIndex];
    const transcript = String(transcriptRef.current || '').trim();
    const durationSec = Math.max(1, Math.round((Date.now() - (listenStartedAtRef.current || Date.now())) / 1000));
    if (!question) return null;
    if (askedCountRef.current < questionIndex + 1) return null;
    if (submittedIndexRef.current[questionIndex]) return { transcript, alreadySaved: true };
    answersByIndexRef.current[questionIndex] = transcript;
    submittedIndexRef.current[questionIndex] = true;
    try {
      await interviewService.submitAnswer(id, {
        questionId: question.id,
        question: question.questionText,
        userAnswer: transcript,
        timeTaken: durationSec,
      });
    } catch (error) {
      submittedIndexRef.current[questionIndex] = false;
      console.error('[ANSWER] Could not save answer:', error);
    }
    return { transcript, durationSec, question };
  }, [id]);

  const requestNextQuestion = useCallback(async (payload = {}) => {
    const plannedDomain = Math.max(1, (plannedCountRef.current || 6) - 1);
    if (domainQuestionCount(questionsRef.current) >= plannedDomain) return null;
    if (nextQuestionPromiseRef.current) return nextQuestionPromiseRef.current;
    nextQuestionPromiseRef.current = interviewService
      .generateNextQuestion(id, payload)
      .then((response) => {
        const data = response?.data || response;
        if (Array.isArray(data?.questions) && data.questions.length) {
          const next = attachIntroQuestion(data.questions);
          questionsRef.current = next;
          setQuestions(next);
        } else if (data?.question) {
          const merged = attachIntroQuestion([...questionsRef.current, data.question]);
          questionsRef.current = merged;
          setQuestions(merged);
        }
        return data?.question || questionsRef.current[questionsRef.current.length - 1] || null;
      })
      .finally(() => {
        nextQuestionPromiseRef.current = null;
      });
    return nextQuestionPromiseRef.current;
  }, [id]);
  requestNextQuestionRef.current = requestNextQuestion;

  const scheduleDraftEvaluation = useCallback((transcript) => {
    if (endingRef.current || advancingRef.current) return;
    if (phaseRef.current !== 'LISTENING') return;
    const spoken = String(transcript || '').trim();
    if (spokenWordCount(spoken) < 4) return;
    const question = questionsRef.current[indexRef.current];
    if (!question) return;
    const state = evalPrepRef.current;
    if (state.timer) window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => {
      if (endingRef.current || advancingRef.current) return;
      if (phaseRef.current !== 'LISTENING') return;
      if (state.promise && canReusePrepared(state.transcript, spoken)) return;
      try {
        state.abort?.abort();
      } catch {
        /* ignore */
      }
      const controller = new AbortController();
      const gen = state.gen;
      state.abort = controller;
      state.transcript = spoken;
      state.questionIndex = indexRef.current;
      state.result = null;
      state.promise = interviewService
        .evaluateSpokenAnswer(
          id,
          {
            questionId: question.id,
            question: question.questionText,
            transcript: spoken,
            draft: true,
          },
          { signal: controller.signal }
        )
        .then((response) => {
          if (gen !== evalPrepRef.current.gen) return null;
          const data = response?.data || response;
          evalPrepRef.current.result = { transcript: spoken, data };
          return data;
        })
        .catch((error) => {
          if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError' || error?.name === 'AbortError') {
            return null;
          }
          console.error('[EVAL] draft evaluation failed', error);
          return null;
        });
    }, 400);
  }, [id]);
  scheduleDraftEvalRef.current = scheduleDraftEvaluation;

  const finalizePreparedEvaluation = useCallback(async (answerText, question, durationSec) => {
    const finalText = String(answerText || '').trim();
    const state = evalPrepRef.current;
    if (state.timer) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
    if (state.promise) {
      try {
        await state.promise;
      } catch {
        /* draft may have been aborted */
      }
    }
    const prepared = evalPrepRef.current.result;
    const reuse = Boolean(prepared?.data && canReusePrepared(prepared.transcript, finalText));
    if (!reuse) {
      try {
        evalPrepRef.current.abort?.abort();
      } catch {
        /* ignore */
      }
    }
    const response = await interviewService.evaluateSpokenAnswer(id, {
      questionId: question?.id,
      question: question?.questionText || '',
      transcript: finalText,
      durationSec,
      draft: false,
      prepared: reuse ? prepared.data : undefined,
    });
    return response?.data || response || {};
  }, [id]);

  const resetAnswerCapture = useCallback(() => {
    bumpEvalPrep();
    transcriptRef.current = '';
    committedTranscriptRef.current = '';
    setAnswer('');
    hadSpeechRef.current = false;
    lastSpeechAtRef.current = 0;
    geminiRef.current.resetCandidateTranscript?.();
  }, [bumpEvalPrep]);

  const speakThenWait = useCallback(async (run) => {
    await run();
    await geminiRef.current.waitForPlaybackEnd();
  }, []);

  const handleRepeatQuestion = useCallback(async () => {
    if (endingRef.current || repeatInFlightRef.current || dontKnowInFlightRef.current) return;
    if (phaseRef.current === 'AI_SPEAKING') return;
    const item = questionsRef.current[indexRef.current];
    if (!item?.questionText) return;
    repeatInFlightRef.current = true;
    advancingRef.current = true;
    geminiRef.current.stopListening();
    resetAnswerCapture();
    geminiRef.current.prepareRepeatQuestion?.();
    setPhaseSafe('AI_SPEAKING');
    setStatusMessage('Repeating the question');
    questionPromptSentRef.current = true;
    resetInterviewerVideo();
    try {
      await geminiRef.current.sendQuestion(item.questionText, { repeat: true });
    } catch (error) {
      console.error('[GEMINI] Repeat question failed', error);
      repeatInFlightRef.current = false;
    } finally {
      advancingRef.current = false;
    }
  }, [resetAnswerCapture, resetInterviewerVideo]);
  handleRepeatRef.current = handleRepeatQuestion;

  const goToNextQuestion = useCallback(async () => {
    const nextIndex = indexRef.current + 1;
    const blocked = getHoldKind(videoStreamRef.current, audioStreamRef.current, facePresentRef.current);
    if (blocked) {
      if (!questionsRef.current[nextIndex]) {
        requestNextQuestionRef.current().catch((error) => {
          console.error('[HF-QUESTION] next question failed', error);
        });
      }
      indexRef.current = nextIndex;
      setCurrentQuestionIndex(nextIndex);
      questionAskedRef.current = false;
      questionPromptSentRef.current = false;
      advancingRef.current = false;
      setPhaseSafe('WAITING');
      resetInterviewerVideo();
      enterHold();
      return;
    }
    indexRef.current = nextIndex;
    setCurrentQuestionIndex(nextIndex);
    resetAnswerCapture();
    questionAskedRef.current = false;
    setPhaseSafe('AI_SPEAKING');
    setStatusMessage('AI is asking the question');
    questionPromptSentRef.current = true;
    resetInterviewerVideo();
    let item = questionsRef.current[nextIndex];
    if (!item) {
      item = await requestNextQuestion();
    }
    if (!item?.questionText) {
      setStatusMessage('Could not generate the next interview question.');
      advancingRef.current = false;
      return;
    }
    await geminiRef.current.sendQuestion(item.questionText);
    advancingRef.current = false;
  }, [enterHold, requestNextQuestion, resetAnswerCapture, resetInterviewerVideo]);

  const handleDontKnowAnswer = useCallback(async () => {
    if (endingRef.current || dontKnowInFlightRef.current || repeatInFlightRef.current) return;
    if (phaseRef.current !== 'LISTENING') return;
    dontKnowInFlightRef.current = true;
    advancingRef.current = true;
    geminiRef.current.stopListening({ endTurn: true });
    const questionIndex = indexRef.current;
    const answerText = String(transcriptRef.current || '').trim() || "I don't know this answer";
    answersByIndexRef.current[questionIndex] = answerText;
    submittedIndexRef.current[questionIndex] = true;
    const question = questionsRef.current[questionIndex];
    const planned = plannedCountRef.current || 6;
    const nextIndex = questionIndex + 1;
    const needNext = nextIndex < planned;
    setPhaseSafe('FEEDBACK');
    setStatusMessage('Okay, no problem');
    if (needNext && !questionsRef.current[nextIndex]) {
      requestNextQuestion({
        previousQuestion: question?.questionText || '',
        candidateAnswer: answerText,
        evaluation: 'unanswered',
        feedback: 'Candidate said they did not know the answer.',
      }).catch((error) => {
        console.error('[HF-QUESTION] next question failed', error);
      });
    }
    try {
      await saveCurrentAnswer();
    } catch (error) {
      console.error('[ANSWER] Could not save skipped answer', error);
    }
    try {
      await speakThenWait(() => geminiRef.current.sendFeedback('Okay, no problem.'));
    } catch (error) {
      console.error('[GEMINI] Skip acknowledgement failed', error);
    }
    if (endingRef.current) {
      advancingRef.current = false;
      return;
    }
    if (nextIndex >= planned) {
      setPhaseSafe('CLOSING');
      setStatusMessage('Wrapping up the interview...');
      try {
        await speakThenWait(() => geminiRef.current.sendClosingRemarks(
          questionsRef.current.slice(0, nextIndex).map((item, index) => ({
            questionText: item.questionText,
            answer: answersByIndexRef.current[index] || '',
          }))
        ));
      } catch (error) {
        console.error('[GEMINI] Closing remarks failed', error);
      }
      advancingRef.current = false;
      endInterviewRef.current('COMPLETED');
      return;
    }
    try {
      await goToNextQuestion();
    } catch (error) {
      console.error('[GEMINI] Next question after skip failed', error);
      dontKnowInFlightRef.current = false;
      advancingRef.current = false;
    }
  }, [goToNextQuestion, requestNextQuestion, saveCurrentAnswer, speakThenWait]);
  handleDontKnowRef.current = handleDontKnowAnswer;

  const advanceAfterSilence = useCallback(async () => {
    if (advancingRef.current || endingRef.current) return;
    if (phaseRef.current !== 'LISTENING') return;
    const answerText = String(transcriptRef.current || '').trim();
    if (isDontKnowIntent(answerText)) {
      await handleDontKnowAnswer();
      return;
    }
    if (isRepeatQuestionIntent(answerText)) {
      await handleRepeatQuestion();
      return;
    }
    const questionIndex = indexRef.current;
    if (submittedIndexRef.current[questionIndex]) return;
    advancingRef.current = true;
    geminiRef.current.stopListening({ endTurn: true });
    const question = questionsRef.current[questionIndex];
    const durationSec = Math.max(1, Math.round((Date.now() - (listenStartedAtRef.current || Date.now())) / 1000));
    const planned = plannedCountRef.current || 6;
    const nextIndex = questionIndex + 1;
    const needNext = nextIndex < planned;
    if (!answerText) {
      submittedIndexRef.current[questionIndex] = true;
      answersByIndexRef.current[questionIndex] = '';
      if (needNext && !questionsRef.current[nextIndex]) {
        requestNextQuestion().catch((error) => {
          console.error('[HF-QUESTION] next question failed', error);
        });
      }
      if (nextIndex >= planned) {
        setPhaseSafe('CLOSING');
        setStatusMessage('Wrapping up the interview...');
        try {
          await speakThenWait(() => geminiRef.current.sendClosingRemarks(
            questionsRef.current.slice(0, nextIndex).map((item, index) => ({
              questionText: item.questionText,
              answer: answersByIndexRef.current[index] || '',
            }))
          ));
        } catch (error) {
          console.error('[GEMINI] Closing remarks failed', error);
        }
        advancingRef.current = false;
        endInterviewRef.current('COMPLETED');
        return;
      }
      await goToNextQuestion();
      return;
    }
    setPhaseSafe('FEEDBACK');
    setStatusMessage('Evaluating your answer...');
    let evaluation = 'ungraded';
    let graderFeedback = '';
    const draftGrade = evalPrepRef.current.result?.data;
    const evalPromise = finalizePreparedEvaluation(answerText, question, durationSec).catch((error) => {
      console.error('[ANSWER] Evaluation failed:', error);
      return {};
    });
    const nextPromise = needNext
      ? requestNextQuestion({
          previousQuestion: question?.questionText || '',
          candidateAnswer: answerText,
          evaluation: draftGrade?.evaluation || '',
          feedback: draftGrade?.feedback || '',
        }).catch((error) => {
          console.error('[HF-QUESTION] next question failed', error);
          return null;
        })
      : Promise.resolve(null);
    const [, graded] = await Promise.all([
      saveCurrentAnswer(),
      evalPromise,
      nextPromise,
    ]);
    if (endingRef.current) {
      advancingRef.current = false;
      return;
    }
    evaluation = graded?.evaluation || evaluation;
    graderFeedback = graded?.feedback || '';
    if (endingRef.current) {
      advancingRef.current = false;
      return;
    }
    const line = spokenFeedbackLine(evaluation, graderFeedback);
    setStatusMessage('AI is giving feedback');
    try {
      await speakThenWait(() => geminiRef.current.sendFeedback(line));
    } catch (error) {
      console.error('[GEMINI] Answer feedback failed', error);
    }
    if (endingRef.current) {
      advancingRef.current = false;
      return;
    }
    if (needNext && !questionsRef.current[nextIndex]) {
      try {
        await requestNextQuestion({
          previousQuestion: question?.questionText || '',
          candidateAnswer: answerText,
          evaluation,
          feedback: graderFeedback,
        });
      } catch (error) {
        console.error('[HF-QUESTION] next question retry failed', error);
      }
    }
    if (nextIndex >= planned) {
      setPhaseSafe('CLOSING');
      setStatusMessage('Wrapping up the interview...');
      const recap = questionsRef.current.slice(0, nextIndex).map((item, index) => ({
        questionText: item.questionText,
        answer: answersByIndexRef.current[index] || '',
      }));
      try {
        await speakThenWait(() => geminiRef.current.sendClosingRemarks(recap));
      } catch (error) {
        console.error('[GEMINI] Closing remarks failed', error);
      }
      advancingRef.current = false;
      endInterviewRef.current('COMPLETED');
      return;
    }
    await goToNextQuestion();
  }, [finalizePreparedEvaluation, goToNextQuestion, handleDontKnowAnswer, handleRepeatQuestion, requestNextQuestion, saveCurrentAnswer, speakThenWait]);

  const endInterview = useCallback(async (endReason = 'ENDED_EARLY') => {
    if (endingRef.current) return;
    endingRef.current = true;
    advancingRef.current = true;
    bumpEvalPrep();
    const message = END_MESSAGES[endReason] || END_MESSAGES.ENDED_EARLY;
    try {
      const transcript = String(transcriptRef.current || '').trim();
      if (
        endReason !== 'COMPLETED' &&
        transcript &&
        !isRepeatQuestionIntent(transcript) &&
        !submittedIndexRef.current[indexRef.current]
      ) {
        await saveCurrentAnswer();
      }
      setStatusMessage('Saving your results...');
      let visualAnalysis = null;
      try {
        visualAnalysis = getFacialReport();
      } catch (error) {
        console.error('Visual analysis snapshot failed:', error);
      }
      const askedQuestionCount = questionsRef.current
        .slice(0, askedCountRef.current)
        .filter((item) => item?.id !== INTRO_QUESTION_ID).length;
      const savePromise = interviewService.completeInterview(id, {
        endReason,
        endMessage: message,
        visualAnalysis,
        askedQuestionCount,
        askedQuestionIndex: Math.max(0, indexRef.current - 1),
      });
      const cleanup = Promise.resolve().then(async () => {
        pauseInterviewerVideo();
        stopInterviewerAudio();
        geminiRef.current.stopListening({ endTurn: true });
        liveReadyRef.current = false;
        setSessionsReady(false);
        try {
          await geminiRef.current.disconnect();
        } catch (error) {
          console.error('[INTERVIEW] Disconnect after save:', error);
        }
        stopMedia();
      });
      navigate(`/interview/report/${id}`);
      savePromise.catch((error) => {
        console.error('Failed to complete interview in background:', error);
      });
      cleanup.catch(() => {});
      if (endReason !== 'COMPLETED') {
        showPopup({
          type: 'status',
          title: 'Interview ended',
          message,
          autoCloseMs: 1800,
        });
      }
    } catch (error) {
      endingRef.current = false;
      advancingRef.current = false;
      console.error('Failed to end interview:', error);
      setStatusMessage('Could not end the interview.');
    }
  }, [bumpEvalPrep, getFacialReport, id, navigate, pauseInterviewerVideo, saveCurrentAnswer, showPopup, stopMedia]);

  const endInterviewRef = useRef(endInterview);
  endInterviewRef.current = endInterview;

  const beginLiveSession = useCallback(async () => {
    if (connectingRef.current || liveReadyRef.current) return;
    connectingRef.current = true;
    try {
      setPhaseSafe('WAITING');
      setStatusMessage('Connecting live interviewer...');
      const tokenResponse = await interviewService.getGeminiToken();
      const payload = tokenResponse?.data || {};
      const transcribe = payload.transcribe;
      if (!transcribe?.token) {
        throw new Error('Transcription session token was empty.');
      }
      await geminiRef.current.connect({ transcribe, interviewId: id });
      liveReadyRef.current = true;
      setSessionsReady(true);
      interviewService.updateInterviewStatus(id, 'IN_PROGRESS').catch((error) => {
        console.error('[START] Status update failed', error);
      });
      resumeWhenReady();
    } catch (error) {
      console.error('[GEMINI] Failed to start live session:', error);
      setStatusMessage(error.response?.data?.message || error.message || 'Could not start the live interviewer.');
    } finally {
      connectingRef.current = false;
    }
  }, [id, resumeWhenReady]);

  useEffect(() => {
    if (!isSessionRoute || loading) return undefined;
    if (liveReadyRef.current || connectingRef.current) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await ensureLiveMedia();
        if (cancelled) return;
        if (!questionsRef.current.length) {
          const seeded = attachIntroQuestion([]);
          questionsRef.current = seeded;
          setQuestions(seeded);
        }
        await beginLiveSession();
      } catch (error) {
        console.error('[SESSION] Failed to enter live interview:', error);
        setStatusMessage(error.response?.data?.message || error.message || 'Could not start the live interviewer.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [beginLiveSession, ensureLiveMedia, isSessionRoute, loading]);

  useEffect(() => {
    if (!isSessionRoute || !sessionsReady) return undefined;
    if (!hasLiveTrack(audioStream, 'audio') && !audioStream?.getAudioTracks?.().some((track) => track.readyState === 'live')) {
      geminiRef.current.stopListening({ detach: true });
      return undefined;
    }
    const stream = audioStream;
    let cancelled = false;
    const attach = async () => {
      try {
        await geminiRef.current.attachMicrophone(stream);
        if (cancelled) return;
        if (phaseRef.current === 'LISTENING') {
          await geminiRef.current.startListening(stream);
        }
      } catch (error) {
        console.error('[MIC] Could not capture microphone audio.', error);
      }
    };
    attach();
    return () => {
      cancelled = true;
    };
  }, [audioStream, isSessionRoute, sessionsReady]);

  useEffect(() => {
    if (!sessionsReady) return undefined;
    if (phase === 'LISTENING') {
      listenStartedAtRef.current = Date.now();
      lastSpeechAtRef.current = Date.now();
      setStatusMessage('Listening to your answer');
      if (hasLiveTrack(audioStreamRef.current, 'audio')) {
        geminiRef.current.startListening(audioStreamRef.current).catch((error) => {
          console.error('[MIC] Could not capture microphone audio.', error);
          holdFnRef.current();
        });
      } else {
        holdFnRef.current();
      }
      return undefined;
    }
    geminiRef.current.stopListening();
    return undefined;
  }, [phase, sessionsReady]);

  useEffect(() => {
    if (phase !== 'LISTENING') return undefined;
    const timer = window.setInterval(() => {
      if (endingRef.current || advancingRef.current) return;
      if (phaseRef.current !== 'LISTENING') return;
      if (getHoldKind(videoStreamRef.current, audioStreamRef.current, facePresentRef.current)) {
        holdFnRef.current();
        return;
      }
      if (Date.now() - lastSpeechAtRef.current < SILENCE_MS) return;
      advanceAfterSilence();
    }, 250);
    return () => window.clearInterval(timer);
  }, [advanceAfterSilence, phase]);

  useEffect(() => {
    if (!isSessionRoute || !liveReadyRef.current && phase === 'idle') return undefined;
    if (!isSessionRoute) return undefined;
    const timer = window.setInterval(() => {
      if (endingRef.current || !liveReadyRef.current) return;
      if (phaseRef.current === 'CLOSING' || phaseRef.current === 'FEEDBACK') return;
      const kind = getHoldKind(videoStreamRef.current, audioStreamRef.current, facePresentRef.current);
      if (kind) {
        if (phaseRef.current !== 'HOLD') holdFnRef.current();
        return;
      }
      if (phaseRef.current === 'HOLD' || phaseRef.current === 'WAITING') resumeFnRef.current();
    }, 400);
    return () => window.clearInterval(timer);
  }, [isSessionRoute, phase]);

  const cameraReady = hasLiveTrack(videoStream, 'video');
  const micReady = hasLiveTrack(audioStream, 'audio');
  const canStart = cameraReady && micReady;

  useEffect(() => {
    if (isSessionRoute || !canStart) return undefined;
    interviewService.getGeminiToken().catch(() => {});
    return undefined;
  }, [canStart, isSessionRoute]);

  const handleStartInterview = async () => {
    if (starting) return;
    if (!canStart) {
      setStatusMessage('Enable both camera and microphone before starting the interview.');
      return;
    }
    setStarting(true);
    setStatusMessage('');
    unlockInterviewAudioContexts().catch((error) => console.error('[AUDIO] Unlock failed', error));
    unlockInterviewerAudioElement();
    cacheInterviewMedia(id, videoStream, audioStream);
    interviewService.updateInterviewStatus(id, 'IN_PROGRESS').catch((error) => {
      console.error('[START] Status update failed', error);
    });
    navigate(`/interview/${id}/session`);
    setStarting(false);
  };

  const requestEndInterview = () => {
    showPopup({
      type: 'confirm',
      title: 'End interview?',
      message: 'This will end the interview now, even if questions remain. Your progress so far will be saved to the report.',
      confirmLabel: 'End Interview',
      cancelLabel: 'Continue',
      onConfirm: () => endInterview('ENDED_EARLY'),
    });
  };

  const handleCandidateTranscriptChange = (value) => {
    const next = String(value || '');
    setAnswer(next);
    transcriptRef.current = next;
    committedTranscriptRef.current = next;
    lastSpeechAtRef.current = Date.now();
    hadSpeechRef.current = Boolean(next.trim());
  };

  const toggleVideo = async () => {
    if (!isVideoEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        });
        applyMediaStreams(stream, audioStreamRef.current);
        if (videoRef.current) videoRef.current.srcObject = stream;
        resumeFnRef.current();
      } catch (error) {
        setStatusMessage('Camera permission denied or unavailable. Enable camera to start.');
      }
    } else {
      videoStream?.getTracks?.().forEach((track) => track.stop());
      videoStreamRef.current = null;
      setVideoStream(null);
      setIsVideoEnabled(false);
      if (videoRef.current) videoRef.current.srcObject = null;
      cacheInterviewMedia(id, null, audioStreamRef.current);
      pauseInterviewerVideo();
      if (liveReadyRef.current) holdFnRef.current();
    }
  };

  const toggleAudio = async () => {
    if (!isAudioEnabled) {
      try {
        const gen = ++micToggleGenRef.current;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: MIC_AUDIO_CONSTRAINTS });
        const track = stream.getAudioTracks?.()[0];
        console.log('[MIC-PIPE] mic ON getUserMedia', {
          readyState: track?.readyState,
          enabled: track?.enabled,
          muted: track?.muted,
          phase: phaseRef.current,
        });
        if (gen !== micToggleGenRef.current) {
          stream.getTracks?.().forEach((track) => track.stop());
          return;
        }
        applyMediaStreams(videoStreamRef.current, stream);
        audioStreamRef.current = stream;
        setAudioStream(stream);
        setIsAudioEnabled(true);
        cacheInterviewMedia(id, videoStreamRef.current, stream);
        if (phaseRef.current === 'LISTENING') {
          await geminiRef.current.startListening(stream);
        }
        if (gen !== micToggleGenRef.current) {
          geminiRef.current.stopListening({ detach: true });
          return;
        }
        resumeFnRef.current();
      } catch (error) {
        setStatusMessage('Microphone permission denied or unavailable. Enable microphone to start.');
      }
    } else {
      micToggleGenRef.current += 1;
      console.log('[MIC-PIPE] mic OFF', {
        readyState: audioStream?.getAudioTracks?.()[0]?.readyState,
        phase: phaseRef.current,
      });
      geminiRef.current.stopListening({ detach: true });
      audioStream?.getTracks?.().forEach((track) => track.stop());
      audioStreamRef.current = null;
      setAudioStream(null);
      setIsAudioEnabled(false);
      cacheInterviewMedia(id, videoStreamRef.current, null);
      if (liveReadyRef.current) holdFnRef.current();
    }
  };

  const interviewerVideo = (
    <video
      ref={interviewerVideoRef}
      src={INTERVIEWER_VIDEO}
      muted
      defaultMuted
      playsInline
      preload="auto"
      controls={false}
      disablePictureInPicture
      className="absolute inset-0 h-full w-full object-fill object-center"
      onLoadedMetadata={(event) => {
        const node = event.currentTarget;
        muteInterviewerVideo(node);
        if (node.videoWidth > 0 && node.videoHeight > 0) {
          setAvatarRatio(node.videoWidth / node.videoHeight);
        }
      }}
      onPlay={(event) => muteInterviewerVideo(event.currentTarget)}
      onVolumeChange={(event) => muteInterviewerVideo(event.currentTarget)}
      onEnded={() => {
        const node = interviewerVideoRef.current;
        if (!node) return;
        muteInterviewerVideo(node);
        if (canPlayInterviewerAvatar() && speakingRef.current) {
          try {
            node.currentTime = 0;
          } catch {
            /* ignore */
          }
          node.play()?.catch?.(() => {});
          return;
        }
        try {
          node.pause();
        } catch {
          /* ignore */
        }
      }}
    />
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (isSessionRoute) {
    return (
      <div className="h-[calc(100dvh-4rem)] overflow-x-hidden overflow-y-auto bg-slate-950 text-white sm:overflow-hidden">
        <div className="mx-auto flex min-h-0 min-w-0 max-w-7xl flex-col overflow-x-hidden px-2 py-2 max-sm:h-auto sm:h-full sm:px-6 sm:py-3 lg:px-8">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2 min-w-0 sm:mb-3 sm:gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 animate-pulse" />
              <h1 className="truncate text-[clamp(0.9rem,3.8vw,1.125rem)] font-semibold">AI Interview Session</h1>
            </div>
            <p className="shrink-0 text-[11px] text-slate-300 sm:text-sm">
              Question {currentQuestionIndex + 1}/{plannedQuestionCount || questions.length || 0}
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden max-sm:flex-none max-sm:overflow-visible sm:min-h-0 sm:flex-1 sm:gap-3 sm:overflow-y-auto lg:grid lg:grid-cols-2 lg:overflow-hidden lg:gap-4">
            <div className="flex min-w-0 flex-col gap-3 max-sm:flex-none sm:min-h-0">
              <div
                className="relative mx-auto w-full max-h-[clamp(8rem,24vh,11rem)] shrink-0 overflow-hidden rounded-xl bg-slate-900 sm:max-h-[32vh] sm:rounded-2xl lg:max-h-none"
                style={{
                  aspectRatio: String(avatarRatio),
                  width: '100%',
                  maxWidth: `min(100%, calc(38vh * ${avatarRatio}))`,
                }}
              >
                {interviewerVideo}
                <span className="absolute left-2 top-2 rounded-full bg-violet-600/90 px-2 py-0.5 text-[10px] font-medium sm:left-3 sm:top-3 sm:px-3 sm:py-1 sm:text-xs">
                  AI Interviewer
                </span>
              </div>
              <div className="min-h-[4.5rem] min-w-0 overflow-hidden max-sm:max-h-[9rem] sm:min-h-[5.5rem] sm:flex-1">
                <InterviewTranscriptBox
                  title="AI Interviewer Transcript"
                  accent="purple"
                  readOnly
                  compact
                  value={aiTranscript}
                  placeholder="The interviewer question will appear here."
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3 max-sm:flex-none sm:min-h-0">
              <div className="relative flex aspect-video max-h-[clamp(8rem,24vh,11rem)] w-full min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-900 sm:max-h-[32vh] sm:rounded-2xl lg:max-h-none">
                {isVideoEnabled ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                ) : (
                  <div className="text-center text-slate-400">
                    <VideoCameraIcon className="mx-auto mb-2 h-8 w-8 sm:h-12 sm:w-12" />
                    <p className="text-xs sm:text-sm">Camera is off</p>
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-medium sm:left-3 sm:top-3 sm:px-3 sm:py-1 sm:text-xs">
                  You
                </span>
                {isVideoEnabled && (
                  <div className="absolute right-2 top-2 max-w-[62%] rounded-lg bg-slate-950/80 px-2 py-1.5 text-[10px] leading-4 text-slate-100 backdrop-blur-sm sm:right-3 sm:top-3 sm:max-w-[70%] sm:px-3 sm:py-2 sm:text-[11px]">
                    <p className="truncate font-medium">
                      {facialLive.loading
                        ? 'Starting visual analysis…'
                        : facialLive.error
                          ? 'Visual analysis unavailable'
                          : `Expression: ${expressionLabel(facialLive.expression)}`}
                    </p>
                    {!facialLive.loading && !facialLive.error && (
                      <p className="mt-0.5 hidden truncate text-slate-300 sm:block">
                        {facialLive.faceVisible
                          ? 'Face visible · visual cues only'
                          : 'Face not visible · visual cues only'}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="min-h-[5rem] min-w-0 overflow-hidden max-sm:max-h-[9.5rem] sm:min-h-[6.25rem] sm:flex-1">
                <InterviewTranscriptBox
                  title="Your Transcript"
                  accent="green"
                  compact
                  value={answer}
                  onChange={handleCandidateTranscriptChange}
                  placeholder={phase === 'LISTENING' ? 'Listening...' : 'Your spoken answer will appear here. You can edit it.'}
                />
              </div>
            </div>
          </div>

          {statusMessage && (
            <p className="mt-3 shrink-0 px-1 text-center text-[clamp(0.7rem,3vw,0.875rem)] leading-5 text-sky-300 break-words sm:mt-2">
              {statusMessage}
            </p>
          )}

          <div className="mt-4 flex shrink-0 items-start justify-center gap-5 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:mt-3 sm:gap-8 sm:pb-2">
            <button type="button" onClick={toggleAudio} className="flex w-[4.75rem] flex-col items-center text-[11px] text-slate-300 sm:text-xs">
              <span className={`flex h-11 w-11 items-center justify-center rounded-full sm:h-14 sm:w-14 ${isAudioEnabled ? 'bg-slate-700' : 'bg-red-600'}`}>
                <MicrophoneIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <span className="mt-1 min-h-[2rem] text-center leading-tight">Mute</span>
            </button>
            <button type="button" onClick={toggleVideo} className="flex w-[4.75rem] flex-col items-center text-[11px] text-slate-300 sm:text-xs">
              <span className={`flex h-11 w-11 items-center justify-center rounded-full sm:h-14 sm:w-14 ${isVideoEnabled ? 'bg-slate-700' : 'bg-red-600'}`}>
                <VideoCameraIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <span className="mt-1 min-h-[2rem] text-center leading-tight">Camera</span>
            </button>
            <button type="button" onClick={requestEndInterview} className="flex w-[4.75rem] flex-col items-center text-[11px] text-slate-300 sm:text-xs">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-900/40 sm:h-14 sm:w-14">
                <PhoneXMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <span className="mt-1 min-h-[2rem] text-center leading-tight">End Interview</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
        >
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">AI Interview Session</h1>
                <p className="text-blue-100">
                  {interview?.category?.replace('_', ' ')} - {interview?.level?.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            <div className="lg:col-span-2">
              <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center relative overflow-hidden">
                {isVideoEnabled ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                ) : (
                  <div className="text-gray-400 text-center">
                    <VideoCameraIcon className="w-16 h-16 mx-auto mb-4" />
                    <p>Camera is off</p>
                  </div>
                )}
                <div className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 space-x-4 sm:flex">
                  <button
                    type="button"
                    onClick={toggleVideo}
                    className={`p-3 rounded-full ${isVideoEnabled ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300'} hover:opacity-80`}
                  >
                    <VideoCameraIcon className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleAudio}
                    className={`p-3 rounded-full ${isAudioEnabled ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300'} hover:opacity-80`}
                  >
                    <MicrophoneIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex justify-center gap-8 sm:hidden">
                <button type="button" onClick={toggleVideo} className="flex min-w-[4.5rem] flex-col items-center gap-1">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full ${isVideoEnabled ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                    <VideoCameraIcon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Camera</span>
                </button>
                <button type="button" onClick={toggleAudio} className="flex min-w-[4.5rem] flex-col items-center gap-1">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full ${isAudioEnabled ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                    <MicrophoneIcon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Microphone</span>
                </button>
              </div>

              <div className="mt-6 text-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Ready to start your interview?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  Make sure your camera and microphone are working properly before you begin.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Camera: {cameraReady ? 'on' : 'off'} · Microphone: {micReady ? 'on' : 'off'}
                </p>
                {statusMessage && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{statusMessage}</p>}
                <button
                  type="button"
                  onClick={handleStartInterview}
                  disabled={!canStart || starting}
                  className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                >
                  {starting ? 'Starting...' : 'Start Interview'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">AI Interviewer</h3>
                <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-2 mb-4 overflow-hidden">
                  <div
                    className="relative mx-auto w-full overflow-hidden rounded-md bg-slate-950/30"
                    style={{ aspectRatio: String(avatarRatio) }}
                  >
                    {interviewerVideo}
                  </div>
                  <p className="text-white text-center text-sm mt-2">AI Assistant</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-6">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    I'm here to help you practice your interview skills. Take your time to answer each question thoughtfully.
                  </p>
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Tips</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start">
                    <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Be specific and provide examples</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Use the STAR method for behavioral questions</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Stay calm and confident</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default InterviewRoom;
