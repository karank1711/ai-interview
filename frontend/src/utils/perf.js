const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

export function perfLog(label, detail) {
  if (!isDev) return;
  if (detail !== undefined) console.log('[PERF]', label, detail);
  else console.log('[PERF]', label);
}

export function perfTimeStart(name) {
  if (!isDev || typeof performance === 'undefined') return () => {};
  const mark = `${name}-start-${Math.random().toString(36).slice(2, 7)}`;
  performance.mark(mark);
  return (extra) => {
    const elapsed = Math.round(performance.now() - performance.getEntriesByName(mark)[0]?.startTime || 0);
    console.log('[PERF]', name, `${elapsed}ms`, extra || '');
  };
}

let lastNav = performance.now();
export function markRouteChange(pathname) {
  if (!isDev) return;
  const now = performance.now();
  console.log('[PERF] route', pathname, `${Math.round(now - lastNav)}ms since last nav`);
  lastNav = now;
}
