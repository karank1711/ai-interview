import { getSupabaseAdmin, getOrCreateProfile, toRequestUser, describeProfileError, isOAuthUser } from "../config/supabase.js";
import { verifyUserAccessToken } from "../utils/jwtVerify.js";

const AUTH_CACHE_TTL_MS = 30_000;
const authCache = new Map();
const authInflight = new Map();

function perfEnabled() {
  return process.env.NODE_ENV !== "production";
}

function logPerf(message) {
  if (perfEnabled()) console.log(`[PERF] ${message}`);
}

function isJwtTimingError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("issued at future") || message.includes("jwt issued");
}

function tokenFingerprint(token) {
  return `${token.slice(0, 12)}…${token.slice(-8)}:${token.length}`;
}

function readCachedUser(token) {
  const cached = authCache.get(token);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    authCache.delete(token);
    return null;
  }
  return cached.user;
}

function storeCachedUser(token, user, jwtExpSec) {
  const ttlExpiry = Date.now() + AUTH_CACHE_TTL_MS;
  const jwtExpiry = jwtExpSec ? jwtExpSec * 1000 : ttlExpiry;
  authCache.set(token, { user, expiresAt: Math.min(ttlExpiry, jwtExpiry) });
  if (authCache.size > 200) {
    const oldest = authCache.keys().next().value;
    authCache.delete(oldest);
  }
}

async function getUserFromAuthApi(token) {
  const supabase = getSupabaseAdmin();
  const started = Date.now();
  const result = await supabase.auth.getUser(token);
  logPerf(`auth.getUser ${Date.now() - started}ms`);
  return result;
}

async function resolveUser(token) {
  const cachedUser = readCachedUser(token);
  if (cachedUser) {
    logPerf(`auth cache-hit key=${tokenFingerprint(token)}`);
    return cachedUser;
  }

  const existing = authInflight.get(token);
  if (existing) {
    logPerf(`auth inflight-wait key=${tokenFingerprint(token)}`);
    return existing;
  }

  const work = (async () => {
    const started = Date.now();
    let payload = null;
    let verifyMs = 0;
    try {
      const verifyStarted = Date.now();
      payload = await verifyUserAccessToken(token);
      verifyMs = Date.now() - verifyStarted;
    } catch (error) {
      if (
        error.code === "token_iat_future" ||
        error.code === "token_expired" ||
        error.code === "token_nbf" ||
        error.code === "invalid_role" ||
        error.code === "invalid_token"
      ) {
        logPerf(`auth jwt-reject ${error.code} ${error.message}`);
        const authError = new Error(error.message);
        authError.statusCode = 401;
        throw authError;
      }
      logPerf(`auth jwt-verify fallback (${error.code || error.message})`);
    }

    let authUser = payload
      ? {
          id: payload.sub,
          email: payload.email || "",
          user_metadata: payload.user_metadata || {},
          identities: []
        }
      : null;

    if (!authUser) {
      const { data, error } = await getUserFromAuthApi(token);
      if (error && isJwtTimingError(error)) {
        const skewError = new Error(
          `Auth API rejected JWT for clock skew: ${error.message}. Server time=${new Date().toISOString()}`
        );
        skewError.statusCode = 401;
        throw skewError;
      }
      if (error || !data?.user) {
        const authError = new Error("Unauthorized");
        authError.statusCode = 401;
        throw authError;
      }
      authUser = data.user;
    }

    const profileStarted = Date.now();
    const profile = await getOrCreateProfile(authUser);
    const profileMs = Date.now() - profileStarted;

    if (profile?.email_verified === false) {
      const { data, error } = await getUserFromAuthApi(token);
      if (!error && data?.user) {
        authUser = data.user;
      }
      if (!isOAuthUser(authUser)) {
        const verifyError = new Error("Please verify your email before continuing. Check your inbox for the code.");
        verifyError.statusCode = 403;
        verifyError.code = "email_not_verified";
        throw verifyError;
      }
    }

    const user = toRequestUser(profile, authUser);
    storeCachedUser(token, user, Number(payload?.exp || 0));
    logPerf(
      `auth resolve ${Date.now() - started}ms verify=${verifyMs}ms profile=${profileMs}ms user=${user.id}`
    );
    return user;
  })();

  authInflight.set(token, work);
  try {
    return await work;
  } finally {
    authInflight.delete(token);
  }
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    req.user = await resolveUser(token);
    next();
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({
        success: false,
        code: error.code || "email_not_verified",
        message: error.message
      });
    }
    if (error.statusCode === 401) {
      return res.status(401).json({ success: false, message: error.message || "Unauthorized" });
    }
    if (error.message && error.message !== "Unauthorized") {
      console.error("Auth middleware error:", error.message);
      return res.status(500).json({
        success: false,
        message: describeProfileError(error)
      });
    }
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
}
