import { createPublicKey, verify } from "node:crypto";
import { env } from "../config/env.js";

const CLOCK_TOLERANCE_SEC = 60;
const JWKS_TTL_MS = 60 * 60 * 1000;

let jwksCache = { keys: [], fetchedAt: 0 };
let jwksInflight = null;

function decodeJwtPart(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

export async function getJwks() {
  if (jwksCache.keys.length && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  if (jwksInflight) return jwksInflight;
  jwksInflight = (async () => {
    const started = Date.now();
    const response = await fetch(`${env.supabaseUrl}/auth/v1/.well-known/jwks.json`);
    if (!response.ok) {
      throw new Error(`JWKS fetch failed (${response.status})`);
    }
    const body = await response.json();
    jwksCache = { keys: body.keys || [], fetchedAt: Date.now() };
    if (process.env.NODE_ENV !== "production") {
      console.log(`[PERF] jwks ${Date.now() - started}ms keys=${jwksCache.keys.length}`);
    }
    return jwksCache.keys;
  })().finally(() => {
    jwksInflight = null;
  });
  return jwksInflight;
}

export function prefetchJwks() {
  getJwks().catch((error) => {
    console.warn("JWKS prefetch failed:", error.message);
  });
}

export async function verifyUserAccessToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    const error = new Error("Invalid access token");
    error.code = "invalid_token";
    throw error;
  }

  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  if (header.alg !== "ES256") {
    const error = new Error(`Unsupported JWT alg ${header.alg}`);
    error.code = "unsupported_alg";
    throw error;
  }
  if (payload.role && payload.role !== "authenticated") {
    const error = new Error("Access token role is not authenticated");
    error.code = "invalid_role";
    throw error;
  }
  if (!payload.sub) {
    const error = new Error("Access token is missing sub");
    error.code = "invalid_token";
    throw error;
  }

  const keys = await getJwks();
  const jwk = keys.find((key) => key.kid === header.kid) || keys[0];
  if (!jwk) {
    const error = new Error("No JWKS key available to verify access token");
    error.code = "jwks_missing";
    throw error;
  }

  const key = createPublicKey({ key: jwk, format: "jwk" });
  const data = Buffer.from(`${parts[0]}.${parts[1]}`);
  const signature = Buffer.from(parts[2], "base64url");
  const valid = verify("sha256", data, { key, dsaEncoding: "ieee-p1363" }, signature);
  if (!valid) {
    const error = new Error("Invalid access token signature");
    error.code = "invalid_signature";
    throw error;
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = Number(payload.exp || 0);
  const iat = Number(payload.iat || 0);
  const nbf = Number(payload.nbf || 0);

  if (exp && now > exp + CLOCK_TOLERANCE_SEC) {
    const error = new Error("Access token expired");
    error.code = "token_expired";
    throw error;
  }
  if (nbf && now + CLOCK_TOLERANCE_SEC < nbf) {
    const error = new Error(`Access token not valid yet (nbf ${nbf - now}s ahead)`);
    error.code = "token_nbf";
    throw error;
  }
  if (iat && iat - now > CLOCK_TOLERANCE_SEC) {
    const error = new Error(
      `JWT iat is ${iat - now}s in the future; clock skew exceeds ${CLOCK_TOLERANCE_SEC}s leeway`
    );
    error.code = "token_iat_future";
    throw error;
  }
  if (iat && iat > now && process.env.NODE_ENV !== "production") {
    console.warn(`[PERF] jwt iat clock skew +${iat - now}s (accepted within ${CLOCK_TOLERANCE_SEC}s leeway)`);
  }

  return payload;
}
