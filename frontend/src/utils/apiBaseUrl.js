/** Resolves the Express API base (`…/api`) from `VITE_API_URL`. */
export function normalizeApiBaseUrl(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  const source = trimmed || (import.meta.env.DEV ? 'http://localhost:8081/api' : '');
  if (!source) {
    throw new Error(
      'Missing VITE_API_URL. Set it in the production environment to your API URL (origin or origin/api).',
    );
  }

  try {
    const u = new URL(source);
    const p = u.pathname.replace(/\/+$/, '') || '/';
    if (p === '/' || p === '') {
      return `${u.origin}/api`;
    }
    if (p.endsWith('/api/api')) {
      return `${u.origin}${p.slice(0, -4)}`;
    }
    return `${u.origin}${p}`;
  } catch {
    const noTrail = source.replace(/\/+$/, '');
    if (noTrail.endsWith('/api/api')) return noTrail.slice(0, -4);
    return noTrail.endsWith('/api') ? noTrail : `${noTrail}/api`;
  }
}

export function getApiBaseUrl() {
  return normalizeApiBaseUrl(import.meta.env.VITE_API_URL);
}
