const enabled = () => {
  if (typeof window === 'undefined') return false;
  if (window.__INTERVIEWIQ_MEDIA_LOG === false) return false;
  return Boolean(import.meta.env?.DEV);
};

export function mediaLog(prefix, message, extra) {
  if (!enabled()) return;
  if (extra !== undefined) console.log(`[${prefix}]`, message, extra);
  else console.log(`[${prefix}]`, message);
}
