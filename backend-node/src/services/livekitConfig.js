const SAMPLE_RATE = 24000;
const PLACEHOLDER_POINTS = new Set([0x2022, 0x2026, 0x25cf, 0x2023]);

function sanitize(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\+$/g, "")
    .trim();
}

function isPlaceholderSecret(secret) {
  if (!secret) return true;
  if (secret.length < 16) return true;
  const bullets = [...secret].filter((ch) => PLACEHOLDER_POINTS.has(ch.codePointAt(0))).length;
  if (bullets >= 8) return true;
  const lower = secret.toLowerCase();
  if (lower.includes("your_livekit") || lower.includes("changeme") || lower === "secret") return true;
  return false;
}

function projectHost(url) {
  try {
    return new URL(url.replace(/^wss:/i, "https:")).host;
  } catch {
    return "";
  }
}

export function getLivekitConfig() {
  const url = sanitize(process.env.LIVEKIT_URL);
  const apiKey = sanitize(process.env.LIVEKIT_API_KEY);
  const apiSecret = sanitize(process.env.LIVEKIT_API_SECRET);
  const missing = [];
  if (!url) missing.push("LIVEKIT_URL");
  if (!apiKey) missing.push("LIVEKIT_API_KEY");
  if (!apiSecret) missing.push("LIVEKIT_API_SECRET");
  const placeholderSecret = isPlaceholderSecret(apiSecret);
  return {
    url,
    apiKey,
    apiSecret,
    host: projectHost(url),
    apiKeyPrefix: apiKey ? `${apiKey.slice(0, 6)}…` : "",
    apiKeyLength: apiKey.length,
    secretLength: apiSecret.length,
    placeholderSecret,
    configured: missing.length === 0 && !placeholderSecret,
    missing,
  };
}

export function logLivekitConfig(extra = {}) {
  const config = getLivekitConfig();
  console.log("[LIVEKIT] auth-config", {
    url: config.url,
    host: config.host,
    apiKeyPrefix: config.apiKeyPrefix,
    apiKeyLength: config.apiKeyLength,
    secretLength: config.secretLength,
    placeholderSecret: config.placeholderSecret,
    ...extra,
  });
}

export function requireLivekitConfig() {
  const config = getLivekitConfig();
  if (config.missing.length > 0) {
    const error = new Error(
      `LiveKit is not configured on the server. Set ${config.missing.join(", ")} in backend-node/.env.`
    );
    error.statusCode = 503;
    throw error;
  }
  if (config.placeholderSecret) {
    const error = new Error(
      "LIVEKIT_API_SECRET is missing or looks like a placeholder. Paste the API secret from LiveKit Cloud → Settings → Keys for this project. Do not use masked/bullet characters."
    );
    error.statusCode = 503;
    throw error;
  }
  return config;
}

export function interviewRoomName(interviewId) {
  return `interviewiq-interview-${interviewId}`;
}

export function candidateIdentity(userId) {
  return `candidate-${userId}`;
}

export function interviewerIdentity() {
  return "gemini-interviewer";
}

export function interviewerAudioSampleRate() {
  return SAMPLE_RATE;
}

export function decodeLivekitJwtClaims(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function describeLivekitToken(token, { identity, roomName } = {}) {
  const claims = decodeLivekitJwtClaims(token) || {};
  const exp = Number(claims.exp || 0);
  return {
    identity: claims.sub || identity || "",
    roomName: claims.video?.room || roomName || "",
    issPrefix: claims.iss ? `${String(claims.iss).slice(0, 6)}…` : "",
    tokenExpiration: exp ? new Date(exp * 1000).toISOString() : "",
    roomJoin: Boolean(claims.video?.roomJoin),
    canPublish: claims.video?.canPublish,
    canSubscribe: claims.video?.canSubscribe,
  };
}
