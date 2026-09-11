import { SignJWT } from "jose";
import { TokenVerifier } from "livekit-server-sdk";
import {
  candidateIdentity,
  describeLivekitToken,
  interviewerIdentity,
  interviewRoomName,
  logLivekitConfig,
  requireLivekitConfig,
} from "./livekitConfig.js";

const CLOCK_SKEW_SEC = 120;
const TOKEN_TTL_SEC = 2 * 60 * 60;

async function signToken({ identity, name, roomName, grant }) {
  const config = requireLivekitConfig();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    name,
    video: {
      roomJoin: true,
      room: roomName,
      canUpdateOwnMetadata: false,
      ...grant,
    },
  };
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(config.apiKey)
    .setSubject(identity)
    .setIssuedAt(now - CLOCK_SKEW_SEC)
    .setNotBefore(now - CLOCK_SKEW_SEC)
    .setExpirationTime(now + TOKEN_TTL_SEC)
    .sign(new TextEncoder().encode(config.apiSecret));

  try {
    await new TokenVerifier(config.apiKey, config.apiSecret).verify(token, CLOCK_SKEW_SEC + 30);
  } catch (error) {
    const authError = new Error(
      `LiveKit token failed local verification for identity=${identity} room=${roomName}: ${error.message}`
    );
    authError.statusCode = 401;
    throw authError;
  }

  logLivekitConfig(describeLivekitToken(token, { identity, roomName }));
  return token;
}

export async function createCandidateLivekitSession({ interviewId, userId, userName }) {
  const { url } = requireLivekitConfig();
  const roomName = interviewRoomName(interviewId);
  const identity = candidateIdentity(userId);
  const token = await signToken({
    identity,
    name: userName || "Candidate",
    roomName,
    grant: {
      canPublish: false,
      canSubscribe: true,
      canPublishData: true,
    },
  });
  return {
    token,
    roomName,
    participantIdentity: identity,
    livekitUrl: url,
  };
}

export async function createInterviewerLivekitToken(interviewId) {
  const roomName = interviewRoomName(interviewId);
  const identity = interviewerIdentity();
  const token = await signToken({
    identity,
    name: "AI Interviewer",
    roomName,
    grant: {
      roomCreate: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  });
  return { token, roomName, identity };
}
