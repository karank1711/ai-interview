import { useEffect, useRef, useState } from 'react';

const DEFAULT_DURATION_MS = 1600;

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export function parseCounterValue(value) {
  if (value == null || value === '') {
    return { numeric: null, prefix: '', suffix: '', decimals: 0, useGrouping: false, raw: value };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const decimals = Number.isInteger(value) ? 0 : String(value).split('.')[1]?.length || 0;
    return { numeric: value, prefix: '', suffix: '', decimals, useGrouping: false, raw: value };
  }

  const raw = String(value);
  const match = raw.match(/^(.*?)(-?[\d,]*\d(?:\.\d+)?)(.*)$/);
  if (!match) {
    return { numeric: null, prefix: '', suffix: '', decimals: 0, useGrouping: false, raw };
  }

  const [, prefix, numberText, suffix] = match;
  const useGrouping = numberText.includes(',');
  const decimals = numberText.includes('.') ? (numberText.split('.')[1]?.length || 0) : 0;
  const numeric = Number(numberText.replace(/,/g, ''));
  if (!Number.isFinite(numeric)) {
    return { numeric: null, prefix: '', suffix: '', decimals: 0, useGrouping: false, raw };
  }
  return { numeric, prefix, suffix, decimals, useGrouping, raw };
}

function formatCounterNumber(numeric, decimals, useGrouping) {
  const factor = 10 ** decimals;
  const rounded = decimals > 0
    ? Math.round(numeric * factor) / factor
    : Math.round(numeric);
  if (useGrouping) {
    return rounded.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return decimals > 0 ? rounded.toFixed(decimals) : String(rounded);
}

function formatDisplay(numeric, parsed) {
  return `${parsed.prefix}${formatCounterNumber(numeric, parsed.decimals, parsed.useGrouping)}${parsed.suffix}`;
}

/**
 * Reusable animated statistic. Pass the real value (number or formatted string).
 * First render animates from 0; later updates animate from the current display.
 */
export default function AnimatedCounter({
  value,
  duration = DEFAULT_DURATION_MS,
  className,
}) {
  const parsed = parseCounterValue(value);
  const [display, setDisplay] = useState(() => {
    if (parsed.numeric == null) return parsed.raw ?? '';
    return formatDisplay(0, parsed);
  });
  const displayedNumericRef = useRef(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const next = parseCounterValue(value);
    if (next.numeric == null) {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      setDisplay(next.raw ?? '');
      return undefined;
    }

    const from = displayedNumericRef.current;
    const to = next.numeric;
    if (from === to) {
      const formatted = formatDisplay(to, next);
      setDisplay(formatted);
      return undefined;
    }

    if (prefersReducedMotion() || duration <= 0) {
      displayedNumericRef.current = to;
      setDisplay(formatDisplay(to, next));
      return undefined;
    }

    const start = performance.now();
    const run = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const current = from + (to - from) * easeOutCubic(progress);
      displayedNumericRef.current = current;
      setDisplay(formatDisplay(current, next));
      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(run);
      } else {
        displayedNumericRef.current = to;
        setDisplay(formatDisplay(to, next));
      }
    };

    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(run);
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{display}</span>;
}
