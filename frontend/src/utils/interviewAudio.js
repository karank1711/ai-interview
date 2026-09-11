let playbackContext = null;
let captureContext = null;

function ensureContext(existing, sampleRate) {
  if (existing && existing.state !== 'closed') return existing;
  return new AudioContext({ sampleRate });
}

function playSilentUnlock(ctx) {
  const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  try {
    source.start(0);
  } catch (error) {
    console.error('[AUDIO] Playback attempt: silent unlock failed', error);
  }
}

export function unlockInterviewAudioContexts() {
  playbackContext = ensureContext(playbackContext, 24000);
  captureContext = ensureContext(captureContext, 16000);
  console.log('[AUDIO] AudioContext state before:', {
    playback: playbackContext.state,
    capture: captureContext.state,
  });
  playSilentUnlock(playbackContext);
  playSilentUnlock(captureContext);
  return Promise.all([playbackContext.resume(), captureContext.resume()])
    .then(() => {
      console.log('[AUDIO] AudioContext state after:', {
        playback: playbackContext.state,
        capture: captureContext.state,
      });
      console.log('[AUDIO] Playback attempt: unlocked from user gesture');
      return { playbackContext, captureContext };
    })
    .catch((error) => {
      console.error('[AUDIO] Failed to resume AudioContext', error);
      throw error;
    });
}

export function getPlaybackContext() {
  playbackContext = ensureContext(playbackContext, 24000);
  return playbackContext;
}

export function getCaptureContext() {
  captureContext = ensureContext(captureContext, 16000);
  return captureContext;
}

export async function resumePlaybackContext() {
  const ctx = getPlaybackContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
}

export async function resumeCaptureContext() {
  const ctx = getCaptureContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
}
