import { useEffect, useRef, useState } from 'react';
import { browserSupportsSegmentation, getImageSegmenter } from '../utils/imageSegmenter';

const FRAME_MS = 50;
const TEMPORAL_CURRENT = 0.38;
const TEMPORAL_PREV = 0.62;
const DILATE_RADIUS = 2;
const ERODE_RADIUS = 1;
const FEATHER_PX = 1.6;

function ensureSize(canvas, width, height) {
  if (!canvas) return false;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return width > 0 && height > 0;
}

function drawCover(ctx, image, width, height) {
  const iw = image.naturalWidth || image.width || width;
  const ih = image.naturalHeight || image.height || height;
  if (!iw || !ih) return false;
  const scale = Math.max(width / iw, height / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);
  return true;
}

function readMaskValues(mask) {
  try {
    if (typeof mask.hasUint8Array !== 'function' || mask.hasUint8Array()) {
      const data = mask.getAsUint8Array();
      if (data?.length) return { data, float: false };
    }
  } catch (error) {
    console.error('[BG] categoryMask getAsUint8Array failed', error);
  }
  try {
    const data = mask.getAsFloat32Array();
    if (data?.length) return { data, float: true };
  } catch (error) {
    console.error('[BG] categoryMask getAsFloat32Array failed', error);
  }
  return null;
}

function smoothstep(value, edge0, edge1) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function morphExtremum(src, dest, width, height, radius, takeMax) {
  const r = radius;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let acc = takeMax ? 0 : 255;
      for (let dy = -r; dy <= r; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        const row = yy * width;
        for (let dx = -r; dx <= r; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          const v = src[row + xx];
          if (takeMax) {
            if (v > acc) acc = v;
          } else if (v < acc) acc = v;
        }
      }
      dest[y * width + x] = acc;
    }
  }
}

function letterboxSourceRect(maskW, maskH, videoW, videoH) {
  const videoAspect = videoW / videoH;
  const maskAspect = maskW / maskH;
  if (Math.abs(videoAspect - maskAspect) < 0.03) {
    return { sx: 0, sy: 0, sw: maskW, sh: maskH };
  }
  const scale = Math.min(maskW / videoW, maskH / videoH);
  const sw = videoW * scale;
  const sh = videoH * scale;
  return {
    sx: (maskW - sw) / 2,
    sy: (maskH - sh) / 2,
    sw,
    sh,
  };
}

function closeMask(mask) {
  try {
    mask?.close?.();
  } catch {
    /* ignore */
  }
}

export function useVirtualBackground({ videoRef, canvasRef, enabled, effect }) {
  const [status, setStatus] = useState('idle');
  const invertRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const personCanvasRef = useRef(null);
  const composeCanvasRef = useRef(null);
  const workCanvasRef = useRef(null);
  const prevAlphaRef = useRef(null);
  const lastGoodMaskRef = useRef(false);
  const bgImageRef = useRef(null);
  const effectRef = useRef(effect);
  const stampRef = useRef(0);
  const diagAtRef = useRef(0);
  const dilateBufRef = useRef(null);
  const erodeBufRef = useRef(null);
  effectRef.current = effect;

  useEffect(() => {
    bgImageRef.current = null;
    if (effect?.kind !== 'image' || !effect.url) return undefined;
    let cancelled = false;
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (!cancelled) bgImageRef.current = image;
    };
    image.onerror = (event) => {
      console.error('[BG] Background image failed to load (CORS or path)', effect.url, event);
      if (!cancelled) bgImageRef.current = null;
    };
    image.src = effect.url;
    return () => {
      cancelled = true;
    };
  }, [effect?.kind, effect?.url]);

  useEffect(() => {
    const active = Boolean(enabled && effect?.kind && effect.kind !== 'none');
    const canvas = canvasRef.current;
    if (!active) {
      setStatus('idle');
      prevAlphaRef.current = null;
      lastGoodMaskRef.current = false;
      invertRef.current = null;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
      }
      return undefined;
    }

    if (!browserSupportsSegmentation()) {
      console.error('[BG] WebAssembly is not available in this browser');
      setStatus('unavailable');
      return undefined;
    }

    let cancelled = false;
    let raf = 0;
    let busy = false;
    let lastTs = 0;
    let segmenter = null;
    let painted = false;
    stampRef.current = 0;
    diagAtRef.current = 0;
    setStatus('loading');
    if (!maskCanvasRef.current) maskCanvasRef.current = document.createElement('canvas');
    if (!personCanvasRef.current) personCanvasRef.current = document.createElement('canvas');
    if (!composeCanvasRef.current) composeCanvasRef.current = document.createElement('canvas');
    if (!workCanvasRef.current) workCanvasRef.current = document.createElement('canvas');

    const updateMask = (mask, videoW, videoH) => {
      const mw = mask.width;
      const mh = mask.height;
      const values = readMaskValues(mask);
      if (!values?.data?.length) return false;

      const src = values.data;
      let max = 0;
      const step = Math.max(1, Math.floor(src.length / 32));
      for (let i = 0; i < src.length; i += step) max = Math.max(max, src[i] || 0);
      const scale = values.float ? 1 : max > 1 ? 255 : 1;

      if (invertRef.current == null) {
        const corners = [0, mw - 1, (mh - 1) * mw, mh * mw - 1];
        let sum = 0;
        corners.forEach((index) => {
          const raw = src[index] || 0;
          sum += scale === 1 ? raw : raw / scale;
        });
        invertRef.current = sum / corners.length > 0.5;
      }

      const curr = new Uint8Array(mw * mh);
      for (let i = 0; i < src.length; i += 1) {
        const raw = scale === 1 ? src[i] : src[i] / scale;
        const person = invertRef.current ? 1 - raw : raw;
        curr[i] = Math.round(smoothstep(person, 0.12, 0.42) * 255);
      }

      const dilateBuf = dilateBufRef.current && dilateBufRef.current.length === curr.length
        ? dilateBufRef.current
        : new Uint8Array(curr.length);
      const erodeBuf = erodeBufRef.current && erodeBufRef.current.length === curr.length
        ? erodeBufRef.current
        : new Uint8Array(curr.length);
      dilateBufRef.current = dilateBuf;
      erodeBufRef.current = erodeBuf;
      morphExtremum(curr, dilateBuf, mw, mh, DILATE_RADIUS, true);
      morphExtremum(dilateBuf, erodeBuf, mw, mh, ERODE_RADIUS, false);

      const prev = prevAlphaRef.current;
      const sameSize = prev && prev.length === erodeBuf.length;
      const blended = sameSize ? prev : new Uint8Array(erodeBuf.length);
      for (let i = 0; i < erodeBuf.length; i += 1) {
        const now = erodeBuf[i];
        if (sameSize) {
          const kept = prev[i] > 150 && now > 24 ? Math.max(now, prev[i] - 20) : now;
          blended[i] = Math.round(kept * TEMPORAL_CURRENT + prev[i] * TEMPORAL_PREV);
        } else {
          blended[i] = now;
        }
      }
      prevAlphaRef.current = blended;

      const work = workCanvasRef.current;
      if (!ensureSize(work, mw, mh)) return false;
      const wctx = work.getContext('2d', { willReadFrequently: true });
      const imageData = wctx.createImageData(mw, mh);
      const pixels = imageData.data;
      for (let i = 0; i < blended.length; i += 1) {
        const offset = i * 4;
        pixels[offset] = 255;
        pixels[offset + 1] = 255;
        pixels[offset + 2] = 255;
        pixels[offset + 3] = blended[i];
      }
      wctx.putImageData(imageData, 0, 0);

      const maskCanvas = maskCanvasRef.current;
      if (!ensureSize(maskCanvas, videoW, videoH)) return false;
      const mctx = maskCanvas.getContext('2d');
      mctx.imageSmoothingEnabled = true;
      mctx.imageSmoothingQuality = 'high';
      mctx.clearRect(0, 0, videoW, videoH);
      const box = letterboxSourceRect(mw, mh, videoW, videoH);
      mctx.filter = `blur(${FEATHER_PX}px)`;
      mctx.drawImage(work, box.sx, box.sy, box.sw, box.sh, 0, 0, videoW, videoH);
      mctx.filter = 'none';
      lastGoodMaskRef.current = true;
      return true;
    };

    const paint = (video, result, startedAt) => {
      const output = canvasRef.current;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!output || cancelled || !width || !height) return false;
      const mask = result?.categoryMask;
      if (!mask) {
        console.error('[BG] Segmentation result had no categoryMask');
        return lastGoodMaskRef.current;
      }
      const maskOk = updateMask(mask, width, height);
      if (!maskOk && !lastGoodMaskRef.current) return false;

      if (!ensureSize(output, width, height)) {
        console.error('[BG] Could not size output canvas', { width, height });
        return false;
      }
      const person = personCanvasRef.current;
      const compose = composeCanvasRef.current;
      if (!ensureSize(person, width, height) || !ensureSize(compose, width, height)) return false;

      const current = effectRef.current;
      const cctx = compose.getContext('2d');
      const pctx = person.getContext('2d');
      if (!cctx || !pctx) {
        console.error('[BG] 2D canvas context unavailable');
        return false;
      }

      cctx.setTransform(1, 0, 0, 1, 0, 0);
      cctx.globalCompositeOperation = 'source-over';
      cctx.filter = 'none';
      if (current?.kind === 'blur') {
        cctx.filter = 'blur(16px)';
        cctx.drawImage(video, 0, 0, width, height);
        cctx.filter = 'none';
      } else if (current?.kind === 'image') {
        if (!bgImageRef.current) return lastGoodMaskRef.current;
        cctx.clearRect(0, 0, width, height);
        if (!drawCover(cctx, bgImageRef.current, width, height)) return false;
      } else {
        return false;
      }

      pctx.setTransform(1, 0, 0, 1, 0, 0);
      pctx.globalCompositeOperation = 'source-over';
      pctx.clearRect(0, 0, width, height);
      pctx.drawImage(video, 0, 0, width, height);
      pctx.globalCompositeOperation = 'destination-in';
      pctx.drawImage(maskCanvasRef.current, 0, 0, width, height);
      pctx.globalCompositeOperation = 'source-over';
      cctx.drawImage(person, 0, 0, width, height);

      const octx = output.getContext('2d');
      if (!octx) return false;
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.drawImage(compose, 0, 0, width, height);

      const now = performance.now();
      if (now - diagAtRef.current > 2000) {
        diagAtRef.current = now;
        console.info('[BG] frame', {
          videoWidth: width,
          videoHeight: height,
          canvasWidth: output.width,
          canvasHeight: output.height,
          maskWidth: mask.width,
          maskHeight: mask.height,
          segmentMs: Math.round(now - startedAt),
          inverted: invertRef.current,
        });
      }
      return true;
    };

    const tick = (now) => {
      if (cancelled) return;
      raf = window.requestAnimationFrame(tick);
      const video = videoRef.current;
      if (!segmenter || !video || video.readyState < 2 || !video.videoWidth || busy) return;
      if (now - lastTs < FRAME_MS) return;
      lastTs = now;
      busy = true;
      const stamp = Math.max(now, stampRef.current + 1);
      stampRef.current = stamp;
      const startedAt = performance.now();
      try {
        segmenter.segmentForVideo(video, stamp, (result) => {
          try {
            const ok = paint(video, result, startedAt);
            if (ok && !painted) {
              painted = true;
              setStatus('ready');
            }
          } catch (error) {
            console.error('[BG] Canvas composite failed', error);
          } finally {
            closeMask(result?.categoryMask);
            busy = false;
          }
        });
      } catch (error) {
        console.error('[BG] segmentForVideo failed', error);
        busy = false;
      }
    };

    let retryTimer = 0;

    const startSegmenter = () => {
      getImageSegmenter()
        .then((instance) => {
          if (cancelled) return;
          segmenter = instance;
          if (!raf) raf = window.requestAnimationFrame(tick);
        })
        .catch((error) => {
          console.error('[BG] Image segmenter could not start', error);
          if (cancelled) return;
          if (!browserSupportsSegmentation()) {
            setStatus('unavailable');
            return;
          }
          setStatus('loading');
          retryTimer = window.setTimeout(startSegmenter, 2500);
        });
    };

    startSegmenter();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      if (raf) window.cancelAnimationFrame(raf);
      prevAlphaRef.current = null;
      lastGoodMaskRef.current = false;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
      }
    };
  }, [canvasRef, enabled, effect?.kind, effect?.url, videoRef]);

  return { status };
}
