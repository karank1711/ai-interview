let audioEl = null;
let playGeneration = 0;
let objectUrl = '';
let currentPlaySettle = null;

function bumpPlayGeneration() {
  playGeneration += 1;
  const settle = currentPlaySettle;
  currentPlaySettle = null;
  settle?.({ interrupted: true });
  return playGeneration;
}

function groqPlaybackLog(message, extra) {
  if (extra !== undefined) console.log('[AI-VOICE]', message, extra);
  else console.log('[AI-VOICE]', message);
}

export function getInterviewerAudioElement() {
  if (audioEl) return audioEl;
  const el = document.createElement('audio');
  el.playsInline = true;
  el.preload = 'auto';
  el.setAttribute('data-interviewiq-interviewer-audio', 'true');
  document.body.appendChild(el);
  audioEl = el;
  return el;
}

export function unlockInterviewerAudioElement() {
  const el = getInterviewerAudioElement();
  el.muted = true;
  const play = el.play();
  if (play && typeof play.then === 'function') {
    play.then(() => {
      el.pause();
      el.muted = false;
      el.currentTime = 0;
    }).catch(() => {
      el.muted = false;
    });
  } else {
    el.muted = false;
  }
}

export function stopInterviewerAudio() {
  bumpPlayGeneration();
  const el = audioEl;
  if (!el) return;
  el.onplaying = null;
  el.onended = null;
  el.onpause = null;
  el.onerror = null;
  try {
    el.pause();
  } catch {
    /* ignore */
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = '';
  }
  el.removeAttribute('src');
  el.src = '';
}

async function attemptPlay(el) {
  el.muted = false;
  el.volume = 1;
  try {
    await el.play();
    return;
  } catch (error) {
    groqPlaybackLog('playback play() failed, retrying', { name: error?.name, message: error?.message });
    el.muted = true;
    try {
      await el.play();
      el.muted = false;
      el.volume = 1;
    } catch (retryError) {
      el.muted = false;
      throw retryError;
    }
  }
}

export function playInterviewerAudioBlob(blob, {
  onStart,
  onEnded,
  onError,
} = {}) {
  const generation = bumpPlayGeneration();
  const el = getInterviewerAudioElement();
  el.onplaying = null;
  el.onended = null;
  el.onpause = null;
  el.onerror = null;
  try {
    el.pause();
  } catch {
    /* ignore */
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = '';
  }
  objectUrl = URL.createObjectURL(blob);
  el.muted = false;
  el.volume = 1;
  el.src = objectUrl;
  groqPlaybackLog('audio buffer attached', { bytes: blob.size, type: blob.type || 'unknown' });

  return new Promise((resolve, reject) => {
    const stale = () => generation !== playGeneration;
    let started = false;
    const finishOk = (reason = 'ended') => {
      if (stale()) {
        resolve();
        return;
      }
      currentPlaySettle = null;
      groqPlaybackLog('playback end', { reason });
      onEnded?.();
      resolve();
    };
    const finishErr = (error) => {
      if (stale()) {
        resolve();
        return;
      }
      currentPlaySettle = null;
      groqPlaybackLog('playback error', { name: error?.name, message: error?.message });
      onError?.(error);
      reject(error);
    };

    currentPlaySettle = () => {
      groqPlaybackLog('playback interrupted');
      if (started) onEnded?.();
      resolve();
    };
    el.onplaying = () => {
      if (stale() || started) return;
      started = true;
      groqPlaybackLog('playback start');
      onStart?.();
    };
    el.onplay = el.onplaying;
    el.onended = () => finishOk('ended');
    el.onerror = () => finishErr(new Error('Interviewer audio playback failed.'));

    attemptPlay(el).catch((error) => finishErr(error));
  });
}
