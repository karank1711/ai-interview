import axios from 'axios';
import { supabase, getOAuthRedirectUrl, getAccessToken, getCachedAccessToken } from '../lib/supabase.js';
import { mapAuthError, toAppUser } from '../utils/authErrors.js';
import { clearPageCache } from '../utils/pageDataCache.js';
import { perfLog } from '../utils/perf.js';
import { applyTheme, mergeSettings, readLocalSettings, writeLocalSettings } from '../utils/userSettings.js';

/** Ensures requests hit Express routes mounted under `/api` (common deploy mistake: origin only). */
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

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);
const AUTH_REQUEST_TIMEOUT_MS = 12000;
const SIGNUP_TIMEOUT_MS = 15000;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = getCachedAccessToken() || (await getAccessToken());
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.metadata = { start: performance.now() };
    return config;
  },
  (error) => Promise.reject(error)
);

const inflightGets = new Map();
const originalAdapter = axios.defaults.adapter;
function runOriginalAdapter(config) {
  if (typeof axios.getAdapter === 'function') {
    const resolved = axios.getAdapter(originalAdapter || ['xhr', 'http']);
    return resolved(config);
  }
  if (typeof originalAdapter === 'function') return originalAdapter(config);
  throw new Error('No HTTP adapter available');
}
api.defaults.adapter = (config) => {
  const method = String(config.method || 'get').toLowerCase();
  if (method !== 'get') {
    clearPageCache();
    return runOriginalAdapter(config);
  }
  const key = `${config.baseURL || ''}|${config.url || ''}|${JSON.stringify(config.params || {})}`;
  const existing = inflightGets.get(key);
  if (existing) {
    if (import.meta.env.DEV) perfLog('inflight-dedupe', config.url);
    return existing;
  }
  const request = Promise.resolve(runOriginalAdapter(config)).finally(() => {
    inflightGets.delete(key);
  });
  inflightGets.set(key, request);
  return request;
};

api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      const started = Number(response.config?.metadata?.start || 0);
      if (started) {
        perfLog(
          `${String(response.config.method || 'GET').toUpperCase()} ${response.config.url}`,
          `${Math.round(performance.now() - started)}ms`
        );
      }
    }
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      clearPageCache();
      const requestUrl = String(error.config?.url || '');
      if (requestUrl.includes('/auth/confirm-email') || requestUrl.includes('/auth/me') || requestUrl.includes('/auth/verify-email') || requestUrl.includes('/auth/send-verification')) {
        return Promise.reject(error);
      }
      await supabase.auth.signOut();
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/signup' && path !== '/auth/callback') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function verificationClientError(error) {
  const code = error.response?.data?.code || error.code || '';
  const messages = {
    WRONG_CODE: 'Wrong verification code. Please try again.',
    EXPIRED_CODE: 'Verification code has expired. Please request a new code.',
    NO_PENDING_VERIFICATION: 'Please verify your email first. Enter the 6-digit code we sent you.',
    INVALID_FORMAT: 'Enter the 6-digit code sent to your email.',
    TOO_MANY_ATTEMPTS: 'Too many incorrect attempts. Request a new code.',
  };
  const message =
    messages[code] ||
    error.response?.data?.message ||
    (error.code === 'ECONNABORTED' ? 'The request timed out. Please try again.' : error.message) ||
    'Could not verify email.';
  const err = new Error(message);
  err.code = code || error.response?.data?.code;
  err.retryAfterSec = error.response?.data?.retryAfterSec;
  return err;
}

let loadAppUserInflight = null;
let loadAppUserToken = '';

async function loadAppUser(session) {
  if (!session?.access_token || !session.user) {
    return null;
  }

  if (loadAppUserInflight && loadAppUserToken === session.access_token) {
    return loadAppUserInflight;
  }

  loadAppUserToken = session.access_token;
  loadAppUserInflight = (async () => {
    try {
      const started = performance.now();
      const response = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      perfLog('/auth/me', `${Math.round(performance.now() - started)}ms`);
      return response.data?.data?.user
        ? { ...toAppUser(null, session.user), ...response.data.data.user }
        : toAppUser(null, session.user);
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Could not load your profile. Please try again.';
      if (error.response?.status === 403) {
        await supabase.auth.signOut();
      }
      throw new Error(message);
    } finally {
      loadAppUserInflight = null;
      loadAppUserToken = '';
    }
  })();

  return loadAppUserInflight;
}

function throwAuthError(error, fallback) {
  const err = new Error(mapAuthError(error, fallback));
  err.code = error?.code;
  throw err;
}

function isUnconfirmedEmailError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === 'email_not_confirmed' || message.includes('email not confirmed');
}

let completeOAuthInflight = null;

export const authService = {
  register: async ({ name, email, password, phoneNumber }) => {
    let data;
    let error;
    try {
      const result = await withTimeout(
        supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: getOAuthRedirectUrl(),
            data: {
              name,
              phone_number: phoneNumber || '',
            },
          },
        }),
        SIGNUP_TIMEOUT_MS,
        'Signup timed out. Please try again.'
      );
      data = result.data;
      error = result.error;
    } catch (timeoutError) {
      throw new Error(timeoutError.message || 'Signup timed out. Please try again.');
    }

    if (error) {
      throwAuthError(error, error.message || 'Registration failed. Please try again.');
    }

    if (!data?.user) {
      throwAuthError(
        { message: 'Registration did not create a user. Please try again.' },
        'Registration failed. Please try again.'
      );
    }

    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throwAuthError(
        { code: 'user_already_registered' },
        'An account with this email already exists.'
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const sessionUser = data.user;

    if (data.session) {
      await supabase.auth.signOut();
    }

    let sendWarning = '';
    try {
      await api.post(
        '/auth/send-verification',
        {
          email: normalizedEmail,
          userId: sessionUser?.id,
        },
        { timeout: AUTH_REQUEST_TIMEOUT_MS }
      );
    } catch (sendError) {
      sendWarning =
        sendError.response?.data?.message ||
        sendError.message ||
        'Account created, but the verification email could not be sent. Try Resend code.';
    }

    return {
      success: true,
      needsEmailVerification: true,
      sendWarning,
      data: {
        user: {
          id: sessionUser?.id,
          email: normalizedEmail,
        },
      },
    };
  },

  login: async ({ email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();
    let { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error && isUnconfirmedEmailError(error)) {
      throwAuthError(
        { code: 'email_not_confirmed' },
        'Please verify your email first. Enter the 6-digit code we sent you.'
      );
    }

    if (error) {
      throwAuthError(error, 'Login failed. Please try again.');
    }
    const user = await loadAppUser(data.session);
    return { success: true, data: { user } };
  },

  verifyEmailCode: async (email, code, userId) => {
    try {
      const response = await api.post(
        '/auth/verify-email',
        {
          email: String(email || '').trim().toLowerCase(),
          code: String(code || '').replace(/\D/g, '').slice(0, 6),
          userId,
        },
        { timeout: AUTH_REQUEST_TIMEOUT_MS }
      );
      return response.data;
    } catch (error) {
      throw verificationClientError(error);
    }
  },

  resendVerificationCode: async (email, userId) => {
    try {
      const response = await api.post(
        '/auth/send-verification',
        {
          email: String(email || '').trim().toLowerCase(),
          userId,
        },
        { timeout: AUTH_REQUEST_TIMEOUT_MS }
      );
      return response.data;
    } catch (error) {
      throw verificationClientError(error);
    }
  },

  signInWithOAuthProvider: async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getOAuthRedirectUrl(),
      },
    });
    if (error) {
      throwAuthError(error, 'Sign-in failed. Please try again.');
    }
  },

  signInWithGoogle: async function signInWithGoogle() {
    return authService.signInWithOAuthProvider('google');
  },

  signInWithGitHub: async function signInWithGitHub() {
    return authService.signInWithOAuthProvider('github');
  },

  completeOAuthRedirect: async () => {
    if (completeOAuthInflight) return completeOAuthInflight;
    completeOAuthInflight = (async () => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error_description') || params.get('error');
    if (oauthError) {
      throwAuthError(
        { code: params.get('error'), message: oauthError },
        'Sign-in was cancelled or failed.'
      );
    }

    const existing = await supabase.auth.getSession();
    if (!existing.data.session?.user && params.get('code')) {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) {
        const retry = await supabase.auth.getSession();
        if (!retry.data.session?.user) {
          throwAuthError(error, 'Sign-in failed. Please try again.');
        }
      }
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throwAuthError(error, 'Sign-in failed. Please try again.');
    }
    if (!data.session?.user) {
      throw new Error('Sign-in did not complete. Please try again.');
    }
    return loadAppUser(data.session);
    })();
    try {
      return await completeOAuthInflight;
    } catch (error) {
      completeOAuthInflight = null;
      throw error;
    }
  },

  logout: async () => {
    clearPageCache();
    await supabase.auth.signOut();
  },

  peekLocalUser: async () => {
    const started = performance.now();
    const { data } = await supabase.auth.getSession();
    perfLog('getSession()', `${Math.round(performance.now() - started)}ms`);
    if (!data.session?.user) return { session: null, user: null };
    return { session: data.session, user: toAppUser(null, data.session.user) };
  },

  hydrateAppUser: async (session) => loadAppUser(session),

  getSessionUser: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) return null;
    return loadAppUser(data.session);
  },

  onAuthStateChange: (callback) => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        return;
      }
      if (event === 'SIGNED_OUT' || !session?.user) {
        callback(null, event);
      }
    });
    return data.subscription;
  },

  updateProfile: async (profileData) => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      throw new Error('Your session has expired. Please sign in again.');
    }

    const nextName = String(profileData.name || '').trim();
    if (!nextName) {
      throw new Error('Full name is required.');
    }

    const metadataPatch = {
      ...(authData.user.user_metadata || {}),
      name: nextName,
    };
    if (profileData.avatarUrl !== undefined) {
      metadataPatch.avatar_url = profileData.avatarUrl || '';
    }

    const authPatch = { data: metadataPatch };
    if (profileData.email && profileData.email !== authData.user.email) {
      authPatch.email = profileData.email.trim().toLowerCase();
    }
    if (profileData.password) {
      authPatch.password = profileData.password;
    }

    const { error: userUpdateError } = await supabase.auth.updateUser(authPatch);
    if (userUpdateError) {
      throwAuthError(userUpdateError, 'Could not update your account. Please try again.');
    }

    try {
      const response = await api.put('/auth/profile', {
        name: nextName,
        phoneNumber: profileData.phoneNumber,
        avatarUrl: profileData.avatarUrl,
      });
      const { data: refreshed } = await supabase.auth.getUser();
      return {
        success: true,
        data: {
          ...toAppUser(null, refreshed.user || authData.user),
          ...(response.data?.data || {}),
          name: nextName,
          avatarUrl: profileData.avatarUrl !== undefined
            ? profileData.avatarUrl
            : (response.data?.data?.avatarUrl || metadataPatch.avatar_url || ''),
        },
      };
    } catch (error) {
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          name: nextName,
          phone_number: profileData.phoneNumber || null,
          avatar_url: profileData.avatarUrl ?? undefined,
        })
        .eq('id', authData.user.id)
        .select('id, name, email, phone_number, created_at, email_verified, avatar_url')
        .single();

      if (updateError && (String(updateError.message || '').includes('avatar_url') || updateError.code === '42703')) {
        const retry = await supabase
          .from('profiles')
          .update({
            name: nextName,
            phone_number: profileData.phoneNumber || null,
          })
          .eq('id', authData.user.id)
          .select('id, name, email, phone_number, created_at, email_verified')
          .single();
        if (retry.error) {
          throw new Error(error.response?.data?.message || 'Could not update profile');
        }
        const { data: refreshed } = await supabase.auth.getUser();
        return {
          success: true,
          data: toAppUser(
            { ...retry.data, avatar_url: profileData.avatarUrl || '' },
            refreshed.user || authData.user
          ),
        };
      }

      if (updateError) {
        throw new Error(error.response?.data?.message || 'Could not update profile');
      }
      const { data: refreshed } = await supabase.auth.getUser();
      return { success: true, data: toAppUser(data, refreshed.user || authData.user) };
    }
  },

  forgotPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) {
      throwAuthError(error, 'Could not send reset email. Please try again.');
    }
    return { success: true };
  },

  getSettings: async (userId) => {
    const local = readLocalSettings(userId);
    const { data } = await supabase.auth.getUser();
    const fromMeta = data.user?.user_metadata?.interviewiq_settings;
    const merged = mergeSettings({
      ...(fromMeta && typeof fromMeta === 'object' ? fromMeta : {}),
      ...local,
    });
    writeLocalSettings(userId, merged);
    applyTheme(merged.theme);
    return merged;
  },

  saveSettings: async (userId, settings) => {
    const next = writeLocalSettings(userId, settings);
    applyTheme(next.theme);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      throw new Error('Your session has expired. Please sign in again.');
    }
    const { error } = await supabase.auth.updateUser({
      data: {
        ...(authData.user.user_metadata || {}),
        interviewiq_settings: next,
      },
    });
    if (error) {
      throwAuthError(error, 'Could not save your settings.');
    }
    return next;
  },

  signOutAllDevices: async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      throwAuthError(error, 'Could not sign out of other devices.');
    }
  },

  deleteAccount: async () => {
    try {
      await api.delete('/auth/account');
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Could not delete your account.');
    }
    await supabase.auth.signOut();
  },
};

export default api;
