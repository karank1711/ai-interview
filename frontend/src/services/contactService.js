import axios from 'axios';

function normalizeApiBaseUrl(raw) {
  const fallback = 'http://localhost:8081/api';
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    const p = u.pathname.replace(/\/+$/, '') || '/';
    if (p === '/') {
      return `${u.origin}/api`;
    }
    return `${u.origin}${p}`;
  } catch {
    const noTrail = trimmed.replace(/\/+$/, '');
    return noTrail.endsWith('/api') ? noTrail : `${noTrail}/api`;
  }
}

const api = axios.create({
  baseURL: normalizeApiBaseUrl(import.meta.env.VITE_API_URL),
  headers: { 'Content-Type': 'application/json' },
});

export async function sendContactMessage({ name, email, message }) {
  try {
    const response = await api.post('/contact', { name, email, message });
    return response.data;
  } catch (error) {
    const messageText =
      error.response?.data?.message || error.message || 'Could not send your message. Please try again.';
    throw new Error(messageText);
  }
}
