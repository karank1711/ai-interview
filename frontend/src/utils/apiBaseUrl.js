function strip(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/^['"]|['"]$/g, '');
}

function hostnameOf(urlLike) {
  try {
    return new URL(urlLike).hostname;
  } catch {
    return '';
  }
}

function isLoopbackHost(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function pageIsLocalDev() {
  if (typeof window === 'undefined') return Boolean(import.meta.env.DEV);
  return isLoopbackHost(window.location.hostname);
}

function runtimeOverride() {
  if (typeof window === 'undefined') return '';
  return strip(window.__INTERVIEWIQ_RUNTIME_API_URL__);
}

function localDevFallback() {
  if (import.meta.env.DEV) return 'http://localhost:8081/api';
  return '';
}

/** Ensures requests hit Express routes mounted under `/api`. */
export function normalizeApiBaseUrl(raw) {
  const source = strip(raw);
  if (!source) return '';
  try {
    const u = new URL(source);
    const p = u.pathname.replace(/\/+$/, '') || '/';
    if (p === '/' || p === '') return `${u.origin}/api`;
    if (p.endsWith('/api/api')) return `${u.origin}${p.slice(0, -4)}`;
    return `${u.origin}${p}`;
  } catch {
    const noTrail = source.replace(/\/+$/, '');
    if (noTrail.endsWith('/api/api')) return noTrail.slice(0, -4);
    return noTrail.endsWith('/api') ? noTrail : `${noTrail}/api`;
  }
}

function resolveApiChoice() {
  const envRaw = strip(import.meta.env.VITE_API_URL);
  const envIsLoopback = Boolean(envRaw) && isLoopbackHost(hostnameOf(envRaw));
  const localPage = pageIsLocalDev();
  const envUsable = Boolean(envRaw) && !(envIsLoopback && !localPage);
  const runtime = runtimeOverride();
  const chosen = envUsable ? envRaw : (runtime || (localPage ? localDevFallback() : ''));
  return {
    envRaw,
    envIsLoopback,
    localPage,
    chosen,
    resolved: normalizeApiBaseUrl(chosen),
  };
}

const apiChoice = resolveApiChoice();

if (typeof window !== 'undefined') {
  window.__INTERVIEWIQ_API__ = {
    resolved: apiChoice.resolved,
    mode: import.meta.env.MODE,
    prod: Boolean(import.meta.env.PROD),
    pageHost: window.location.hostname,
    envPresent: Boolean(apiChoice.envRaw),
    envIsLoopback: apiChoice.envIsLoopback,
  };
  console.info('[InterviewIQ] API base', window.__INTERVIEWIQ_API__.resolved || '(unset)', window.__INTERVIEWIQ_API__);
}

export function getApiBaseUrl() {
  const resolved = apiChoice.resolved;
  if (!resolved || (isLoopbackHost(hostnameOf(resolved)) && !pageIsLocalDev())) {
    throw new Error(
      'Missing VITE_API_URL for production. Set Vercel Production env VITE_API_URL to the Render API origin (not localhost).',
    );
  }
  return resolved;
}
