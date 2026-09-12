import api from '../services/authService';
import { playInterviewerAudioBlob } from './interviewerPlayback';

const PENDING_KEY = 'interviewiq-welcome-pending';
const PLAYED_KEY = 'interviewiq-welcome-played';

let welcomeStarted = false;

export function markWelcomeVoicePending() {
  welcomeStarted = false;
  try {
    sessionStorage.setItem(PENDING_KEY, '1');
    sessionStorage.removeItem(PLAYED_KEY);
  } catch {
    /* ignore */
  }
}

export async function playHomeWelcomeVoiceOnce() {
  if (welcomeStarted) return;
  try {
    if (sessionStorage.getItem(PLAYED_KEY) === '1') return;
    if (sessionStorage.getItem(PENDING_KEY) !== '1') return;
  } catch {
    return;
  }

  welcomeStarted = true;
  try {
    sessionStorage.removeItem(PENDING_KEY);
    const response = await api.post('/interviews/welcome-tts', {}, {
      responseType: 'blob',
      timeout: 60000,
    });
    const blob = response.data;
    if (!(blob instanceof Blob) || blob.size < 40) return;
    if (String(blob.type || '').includes('json')) return;
    await playInterviewerAudioBlob(blob);
  } catch {
    /* Autoplay or network failures must not block Home. */
  } finally {
    try {
      sessionStorage.setItem(PLAYED_KEY, '1');
    } catch {
      /* ignore */
    }
  }
}
