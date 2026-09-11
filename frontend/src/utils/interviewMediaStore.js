const cache = {
  interviewId: null,
  video: null,
  audio: null,
};

export const MIC_AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export function isUsableTrack(track) {
  if (!track) return false;
  if (track.readyState !== 'live' || track.enabled === false) return false;
  if (track.kind === 'audio' && track.muted) return false;
  return true;
}

export function hasLiveTrack(stream, kind) {
  if (!stream || typeof stream.getTracks !== 'function') return false;
  return stream.getTracks().some((track) => track.kind === kind && isUsableTrack(track));
}

export function getFirstUsableTrack(stream, kind) {
  if (!stream || typeof stream.getTracks !== 'function') return null;
  return stream.getTracks().find((track) => track.kind === kind && isUsableTrack(track)) || null;
}

export function cacheInterviewMedia(interviewId, videoStream, audioStream) {
  cache.interviewId = interviewId;
  if (videoStream !== undefined) cache.video = videoStream;
  if (audioStream !== undefined) cache.audio = audioStream;
}

export function getCachedInterviewMedia(interviewId) {
  if (!interviewId || cache.interviewId !== interviewId) {
    return { video: null, audio: null };
  }
  return {
    video: hasLiveTrack(cache.video, 'video') ? cache.video : null,
    audio: hasLiveTrack(cache.audio, 'audio') ? cache.audio : null,
  };
}

export function describeTracks(stream, kind) {
  if (!stream || typeof stream.getTracks !== 'function') {
    return [];
  }
  return stream
    .getTracks()
    .filter((track) => !kind || track.kind === kind)
    .map((track) => ({
      kind: track.kind,
      label: track.label,
      enabled: track.enabled,
      readyState: track.readyState,
      muted: track.muted,
    }));
}

export function stopAndClearInterviewMedia(interviewId) {
  if (interviewId && cache.interviewId !== interviewId) return;
  cache.video?.getTracks?.().forEach((track) => track.stop());
  cache.audio?.getTracks?.().forEach((track) => track.stop());
  cache.interviewId = null;
  cache.video = null;
  cache.audio = null;
}
