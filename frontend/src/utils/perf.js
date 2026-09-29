export function perfLog() {}

export function perfTimeStart() {
  return () => {};
}

let lastNav = typeof performance !== 'undefined' ? performance.now() : 0;
export function markRouteChange() {
  if (typeof performance === 'undefined') return;
  lastNav = performance.now();
}
