let audioEl = null;
let playGeneration = 0;
let objectUrl = '';
let currentPlaySettle = null;
let playbackActive = false;

function bumpPlayGeneration() {
  playGeneration += 1;
  const settle = currentPlaySettle;
  currentPlaySettle = null;
  settle?.({ interrupted: true });
  return playGeneration;
}

function voiceLog(message, extra) {
  if (extra !== undefined) console.log('[AI-VOICE]', message, extra);
  else console.log('[AI-VOICE]', message);
}

function describeAudioElement(el) {
  if (!el) return { present: false };
  return {
    src: el.currentSrc || el.src || '',
    muted: el.muted,
    defaultMuted: el.defaultMuted,
    volume: el.volume,
    paused: el.paused,
    readyState: el.readyState,
    networkState: el.networkState,
  };
}

export function sniffAudioBlob(blob) {
  return blob.slice(0, 16).arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    const magic = String.fromCharCode(...bytes.slice(0, 4));
    const mpeg = bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
    if (magic === 'RIFF') return { mime: 'audio/wav', playable: true, magic };
    if (magic.startsWith('ID3') || mpeg) return { mime: 'audio/mpeg', playable: true, magic: magic || 'mpeg' };
    if (magic === 'OggS') return { mime: 'audio/ogg', playable: true, magic };
    const text = new TextDecoder().decode(bytes);
    if (text.trim().startsWith('{')) return { mime: 'application/json', playable: false, magic };
    return { mime: String(blob.type || '').split(';')[0] || 'application/octet-stream', playable: blob.size > 40, magic };
  });
}

export function getInterviewerAudioElement() {
  if (audioEl && document.body.contains(audioEl)) return audioEl;
  const el = document.createElement('audio');
  el.playsInline = true;
  el.preload = 'auto';
  el.controls = false;
  el.muted = false;
  el.defaultMuted = false;
  el.volume = 1;
  el.setAttribute('data-interviewiq-interviewer-audio', 'true');
  document.body.appendChild(el);
  audioEl = el;
  return el;
}

export function isInterviewerAudioPlaying() {
  return playbackActive && audioEl && !audioEl.paused;
}

export function unlockInterviewerAudioElement() {
  const el = getInterviewerAudioElement();
  if (playbackActive || (el.src && !el.paused && !el.ended)) {
    voiceLog('unlock skipped', describeAudioElement(el));
    return;
  }
  el.muted = true;
  const play = el.play();
  if (play && typeof play.then === 'function') {
    play.then(() => {
      if (playbackActive) {
        el.muted = false;
        el.volume = 1;
        return;
      }
      el.pause();
      el.muted = false;
      el.defaultMuted = false;
      el.volume = 1;
      el.currentTime = 0;
    }).catch(() => {
      el.muted = false;
      el.defaultMuted = false;
      el.volume = 1;
    });
  } else {
    el.muted = false;
    el.volume = 1;
  }
}

function clearAudioHandlers(el) {
  if (!el) return;
  el.onplaying = null;
  el.onplay = null;
  el.onended = null;
  el.onpause = null;
  el.onerror = null;
  el.oncanplay = null;
  el.ontimeupdate = null;
}

export function stopInterviewerAudio() {
  playbackActive = false;
  bumpPlayGeneration();
  const el = audioEl;
  if (!el) return;
  clearAudioHandlers(el);
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

function waitForCanPlay(el, generation) {
  if (el.readyState >= 3) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const stale = () => generation !== playGeneration;
    const onReady = () => {
      cleanup();
      if (stale()) {
        resolve();
        return;
      }
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Audio failed to load.'));
    };
    const cleanup = () => {
      el.removeEventListener('canplay', onReady);
      el.removeEventListener('loadeddata', onReady);
      el.removeEventListener('error', onError);
    };
    el.addEventListener('canplay', onReady, { once: true });
    el.addEventListener('loadeddata', onReady, { once: true });
    el.addEventListener('error', onError, { once: true });
    try {
      el.load();
    } catch {
      /* ignore */
    }
  });
}

async function attemptPlay(el) {
  el.muted = false;
  el.defaultMuted = false;
  el.volume = 1;
  voiceLog('play() attempt', describeAudioElement(el));
  try {
    await el.play();
    el.muted = false;
    el.volume = 1;
    voiceLog('play() success', describeAudioElement(el));
  } catch (error) {
    voiceLog('play() failure', { name: error?.name, message: error?.message, ...describeAudioElement(el) });
    throw error;
  }
}

export async function preparePlayableAudioBlob(blob) {
  const sniffed = await sniffAudioBlob(blob);
  const type = sniffed.playable ? sniffed.mime : String(blob.type || '').split(';')[0];
  voiceLog('blob inspect', {
    bytes: blob.size,
    headerType: blob.type || 'unknown',
    sniffedType: sniffed.mime,
    magic: sniffed.magic,
    playable: sniffed.playable,
  });
  if (!sniffed.playable || blob.size < 40) {
    const error = new Error('Audio is temporarily unavailable. You can still read the response.');
    error.audioError = true;
    error.voiceAvailable = false;
    throw error;
  }
  return new Blob([blob], { type: type || 'audio/wav' });
}

export function playInterviewerAudioBlob(blob, {
  onCanPlay,
  onStart,
  onTimeUpdate,
  onPause,
  onEnded,
  onError,
} = {}) {
  const generation = bumpPlayGeneration();
  const el = getInterviewerAudioElement();
  clearAudioHandlers(el);
  try {
    el.pause();
  } catch {
    /* ignore */
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = '';
  }

  return (async () => {
    const playable = await preparePlayableAudioBlob(blob);
    if (generation !== playGeneration) return;
    objectUrl = URL.createObjectURL(playable);
    el.muted = false;
    el.defaultMuted = false;
    el.volume = 1;
    el.src = objectUrl;
    voiceLog('audio source attached', {
      blobUrlValid: objectUrl.startsWith('blob:'),
      bytes: playable.size,
      type: playable.type,
      ...describeAudioElement(el),
    });

    await new Promise((resolve, reject) => {
      if (generation !== playGeneration) {
        resolve();
        return;
      }
      const stale = () => generation !== playGeneration;
      let started = false;
      let settled = false;

      const progressPayload = () => ({
        currentTime: Number(el.currentTime) || 0,
        duration: Number(el.duration) || 0,
      });

      const finishOk = (reason = 'ended') => {
        if (settled) return;
        settled = true;
        playbackActive = false;
        currentPlaySettle = null;
        clearAudioHandlers(el);
        if (stale()) {
          resolve();
          return;
        }
        voiceLog('playback end', { reason, ...describeAudioElement(el) });
        onEnded?.({ reason, ...progressPayload() });
        resolve();
      };
      const finishErr = (error) => {
        if (settled) return;
        settled = true;
        playbackActive = false;
        currentPlaySettle = null;
        clearAudioHandlers(el);
        if (stale()) {
          resolve();
          return;
        }
        voiceLog('playback error', { name: error?.name, message: error?.message, ...describeAudioElement(el) });
        onError?.(error);
        reject(error);
      };

      currentPlaySettle = () => {
        playbackActive = false;
        voiceLog('playback interrupted', describeAudioElement(el));
        if (!settled) {
          settled = true;
          clearAudioHandlers(el);
          if (started && !stale()) onEnded?.({ reason: 'interrupted', ...progressPayload() });
        }
        resolve();
      };

      el.oncanplay = () => {
        if (stale()) return;
        onCanPlay?.({ duration: Number(el.duration) || 0 });
      };
      el.onplaying = () => {
        if (stale() || started) return;
        el.muted = false;
        el.volume = 1;
        playbackActive = true;
        started = true;
        voiceLog('playback start', describeAudioElement(el));
        onStart?.(progressPayload());
      };
      el.ontimeupdate = () => {
        if (stale() || !started) return;
        onTimeUpdate?.(progressPayload());
      };
      el.onpause = () => {
        if (stale() || el.ended || settled) return;
        onPause?.(progressPayload());
      };
      el.onended = () => finishOk('ended');
      el.onerror = () => finishErr(new Error('Interviewer audio playback failed.'));

      waitForCanPlay(el, generation).then(async () => {
        if (stale() || settled) return;
        voiceLog('audio loaded', describeAudioElement(el));
        try {
          await attemptPlay(el);
        } catch (error) {
          finishErr(error);
        }
      }).catch(finishErr);
    });
  })().catch((error) => {
    playbackActive = false;
    onError?.(error);
    throw error;
  });
}
