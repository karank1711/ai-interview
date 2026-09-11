const SETTINGS_KEY = 'interviewiq-settings';
const USER_KEY_PREFIX = 'interviewiq-settings:';

export const DEFAULT_SETTINGS = {
  language: 'en-US',
  defaultDifficulty: 'INTERMEDIATE',
  defaultInterviewType: 'TECHNICAL',
  autoStartInterview: false,
  aiFollowUpQuestions: true,
  autoPlayAiVoice: true,
  speakingSpeed: 'normal',
  interviewReminders: true,
  interviewCompletionNotifications: true,
  productUpdateNotifications: false,
  theme: 'light',
  interviewHistoryVisibility: 'private',
};

export function storageKeyForUser(userId) {
  return userId ? `${USER_KEY_PREFIX}${userId}` : SETTINGS_KEY;
}

export function mergeSettings(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...raw };
}

export function readLocalSettings(userId) {
  try {
    const specific = userId ? localStorage.getItem(storageKeyForUser(userId)) : null;
    const fallback = localStorage.getItem(SETTINGS_KEY);
    const parsed = JSON.parse(specific || fallback || 'null');
    return mergeSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeLocalSettings(userId, settings) {
  const next = mergeSettings(settings);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    if (userId) localStorage.setItem(storageKeyForUser(userId), JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

export const THEME_CHANGE_EVENT = 'interviewiq-theme-change';

export function resolveTheme(theme) {
  const mode = theme || DEFAULT_SETTINGS.theme;
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  const mode = theme || DEFAULT_SETTINGS.theme;
  const resolved = resolveTheme(mode);
  const isDark = resolved === 'dark';
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;
  if (document.body) {
    document.body.classList.toggle('dark', isDark);
    document.body.setAttribute('data-theme', resolved);
  }
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme: mode, resolved } }));
}

export function setAppTheme(theme, userId) {
  const next = writeLocalSettings(userId, { ...readLocalSettings(userId), theme });
  applyTheme(next.theme);
  return next;
}

export function applyStoredTheme(userId) {
  applyTheme(readLocalSettings(userId).theme);
}
