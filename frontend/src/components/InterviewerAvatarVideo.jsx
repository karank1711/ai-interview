import { useCallback, useEffect, useRef, useState } from 'react';

export const INTERVIEWER_VIDEO_SRC = '/video/ai-interview.mp4';

export default function InterviewerAvatarVideo({
  speaking = false,
  playbackId = 0,
  className = '',
  label = 'AI Coach',
}) {
  const videoRef = useRef(null);
  const speakingRef = useRef(speaking);
  const playbackIdRef = useRef(playbackId);
  const [ratio, setRatio] = useState(16 / 9);

  const muteVideo = useCallback((node = videoRef.current) => {
    if (!node) return;
    if (!node.muted) node.muted = true;
    if (!node.defaultMuted) node.defaultMuted = true;
    if (node.volume !== 0) node.volume = 0;
    node.playsInline = true;
  }, []);

  useEffect(() => {
    playbackIdRef.current = playbackId;
    const node = videoRef.current;
    if (!node) return;
    muteVideo(node);
    try {
      node.currentTime = 0;
    } catch {
      /* ignore */
    }
    try {
      node.pause();
    } catch {
      /* ignore */
    }
  }, [muteVideo, playbackId]);

  useEffect(() => {
    speakingRef.current = speaking;
    const node = videoRef.current;
    if (!node) return;
    muteVideo(node);
    if (!speaking) {
      try {
        node.pause();
      } catch {
        /* ignore */
      }
      return;
    }
    node.play()?.catch?.(() => {});
  }, [muteVideo, speaking]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-slate-900 ${className}`}
      style={{ aspectRatio: String(ratio) }}
    >
      <video
        ref={videoRef}
        src={INTERVIEWER_VIDEO_SRC}
        muted
        defaultMuted
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        className="absolute inset-0 h-full w-full object-fill object-center"
        onLoadedMetadata={(event) => {
          const node = event.currentTarget;
          muteVideo(node);
          if (node.videoWidth > 0 && node.videoHeight > 0) {
            setRatio(node.videoWidth / node.videoHeight);
          }
        }}
        onPlay={(event) => muteVideo(event.currentTarget)}
        onVolumeChange={(event) => muteVideo(event.currentTarget)}
        onEnded={() => {
          const node = videoRef.current;
          if (!node) return;
          muteVideo(node);
          if (speakingRef.current && playbackIdRef.current === playbackId) {
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
      <span className="absolute left-2 top-2 rounded-full bg-violet-600/90 px-2 py-0.5 text-[10px] font-medium text-white sm:left-3 sm:top-3 sm:px-3 sm:py-1 sm:text-xs">
        {label}
      </span>
      {speaking ? (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-rose-600/90 px-2 py-0.5 text-[10px] font-medium text-white sm:right-3 sm:top-3 sm:text-xs">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Live
        </span>
      ) : null}
    </div>
  );
}
