import { useCallback, useEffect, useRef, useState } from 'react';
import { getFaceLandmarker } from '../utils/faceLandmarker';
import { FaceSignalAggregator } from '../utils/facialSignals';

const SAMPLE_MS = 180;
const MISS_TO_ABSENT = 2;
const HIT_TO_PRESENT = 2;

export function useFacialAnalysis({ videoRef, enabled, onFacePresenceChange, onAttentionEvent }) {
  const aggregatorRef = useRef(new FaceSignalAggregator());
  const lastTsRef = useRef(0);
  const lastUiKeyRef = useRef('');
  const rafRef = useRef(0);
  const missRef = useRef(0);
  const hitRef = useRef(0);
  const announcedRef = useRef(null);
  const callbacksRef = useRef({ onFacePresenceChange, onAttentionEvent });
  callbacksRef.current = { onFacePresenceChange, onAttentionEvent };

  const [live, setLive] = useState({
    ready: false,
    faceVisible: false,
    expression: 'none',
    facingCamera: false,
    attentionState: 'NORMAL',
    loading: false,
    error: '',
  });

  const getReport = useCallback(() => aggregatorRef.current.finalize(), []);
  const acknowledgeAttentionWarning = useCallback(() => {
    aggregatorRef.current.acknowledgeAttentionWarning();
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let landmarker = null;
    missRef.current = 0;
    hitRef.current = 0;
    announcedRef.current = null;
    lastTsRef.current = 0;
    lastUiKeyRef.current = '';
    aggregatorRef.current = new FaceSignalAggregator();

    const announce = (visible) => {
      if (announcedRef.current === visible) return;
      announcedRef.current = visible;
      callbacksRef.current.onFacePresenceChange?.(visible);
    };

    const tick = (now) => {
      if (cancelled) return;
      rafRef.current = window.requestAnimationFrame(tick);
      const video = videoRef.current;
      if (!landmarker || !video || video.readyState < 2) return;
      if (now - lastTsRef.current < SAMPLE_MS) return;
      lastTsRef.current = now;
      try {
        const result = landmarker.detectForVideo(video, now);
        const detected = Boolean(result?.faceLandmarks?.[0]?.length);
        const attentionEvent = aggregatorRef.current.addFrame(result, Date.now());
        const preview = aggregatorRef.current.livePreview();

        if (detected) {
          missRef.current = 0;
          hitRef.current += 1;
          if (hitRef.current >= HIT_TO_PRESENT) announce(true);
        } else {
          hitRef.current = 0;
          missRef.current += 1;
          if (missRef.current >= MISS_TO_ABSENT) announce(false);
        }

        if (attentionEvent) callbacksRef.current.onAttentionEvent?.(attentionEvent);

        const uiKey = `${detected}|${preview.expression}|${preview.facingCamera}|${preview.attentionState}`;
        if (uiKey !== lastUiKeyRef.current) {
          lastUiKeyRef.current = uiKey;
          setLive({
            ready: true,
            faceVisible: detected,
            expression: preview.expression,
            facingCamera: preview.facingCamera,
            attentionState: preview.attentionState || 'NORMAL',
            loading: false,
            error: '',
          });
        }
      } catch {
        // Keep the interview running if a single frame fails.
      }
    };

    setLive((current) => ({ ...current, loading: true, error: '', ready: false, faceVisible: false }));
    getFaceLandmarker()
      .then((instance) => {
        if (cancelled) return;
        landmarker = instance;
        rafRef.current = window.requestAnimationFrame(tick);
      })
      .catch((error) => {
        if (cancelled) return;
        setLive((current) => ({
          ...current,
          loading: false,
          error: error.message || 'Facial analysis could not start.',
        }));
      });

    return () => {
      cancelled = true;
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [enabled, videoRef]);

  return { live, getReport, acknowledgeAttentionWarning };
}
