import { env } from "../config/env.js";
import { chunkTtsText, concatWavBuffers, isTtsProviderFailure } from "./groqTts.js";
import { ensurePlayableAudio, inspectAudioBuffer } from "./ttsAudio.js";

const SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech";
const SARVAM_MODEL = "bulbul:v3";
const SARVAM_SPEAKER = "ritu";
const SARVAM_LANGUAGE = "hi-IN";
const SARVAM_MAX_CHARS = 2000;

function hindiLog(message, extra) {
  if (extra !== undefined) console.log("[HINDI-TTS]", message, extra);
  else console.log("[HINDI-TTS]", message);
}

function requireSarvamKey() {
  if (!env.sarvamApiKey) {
    const error = new Error("Hindi voice is not configured.");
    error.statusCode = 503;
    error.code = "TTS_UNAVAILABLE";
    error.voiceAvailable = false;
    throw error;
  }
}

function ttsFailure(status, rawBody, fallbackMessage) {
  const quota = isTtsProviderFailure(status, rawBody);
  const error = new Error(
    quota
      ? "Hindi voice is temporarily unavailable."
      : fallbackMessage
  );
  error.statusCode = quota ? 429 : status >= 500 ? 502 : 502;
  error.code = quota ? "TTS_UNAVAILABLE" : "TTS_ERROR";
  error.voiceAvailable = false;
  return error;
}

function decodeAudioPayload(payload) {
  const items = payload?.audios ?? payload?.audio;
  const list = Array.isArray(items) ? items : items ? [items] : [];
  const buffers = list
    .map((item) => {
      const raw = typeof item === "string" ? item : item?.data || item?.audio || "";
      return raw ? Buffer.from(raw, "base64") : null;
    })
    .filter((item) => item && item.length);
  if (!buffers.length) return null;
  if (buffers.length === 1) return buffers[0];
  if (buffers[0].subarray(0, 4).toString("ascii") === "RIFF") {
    return concatWavBuffers(buffers);
  }
  return Buffer.concat(buffers);
}

async function synthesizeHindiChunk(input, signal) {
  requireSarvamKey();
  const spoken = String(input || "").replace(/\s+/g, " ").trim();
  if (!spoken) {
    const error = new Error("Interviewer text is required.");
    error.statusCode = 400;
    throw error;
  }
  hindiLog("request started", { chars: spoken.length });
  const response = await fetch(SARVAM_TTS_URL, {
    method: "POST",
    headers: {
      "api-subscription-key": env.sarvamApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: spoken,
      model: SARVAM_MODEL,
      speaker: SARVAM_SPEAKER,
      language_code: SARVAM_LANGUAGE,
      target_language_code: SARVAM_LANGUAGE,
      pace: 1,
      speech_sample_rate: 24000,
    }),
    signal,
  });
  if (!response.ok) {
    const rawBody = await response.text();
    hindiLog("error", { status: response.status, body: String(rawBody).slice(0, 220) });
    throw ttsFailure(response.status, rawBody, "Hindi voice could not be generated.");
  }
  const payload = await response.json();
  const buffer = decodeAudioPayload(payload);
  if (!buffer?.length) {
    throw ttsFailure(502, "empty audio", "Hindi voice could not be generated.");
  }
  hindiLog("audio generated", inspectAudioBuffer(buffer));
  return buffer;
}

export function chunkHindiTtsText(text) {
  return chunkTtsText(text, SARVAM_MAX_CHARS);
}

export async function generateSarvamSpeech(text, { signal } = {}) {
  const chunks = chunkHindiTtsText(String(text || "").trim());
  if (!chunks.length) {
    const error = new Error("Interviewer text is required.");
    error.statusCode = 400;
    throw error;
  }
  const parts = [];
  for (const chunk of chunks) {
    parts.push(await synthesizeHindiChunk(chunk, signal));
  }
  const buffer = parts[0].subarray(0, 4).toString("ascii") === "RIFF"
    ? concatWavBuffers(parts)
    : Buffer.concat(parts);
  const playable = ensurePlayableAudio(buffer);
  hindiLog("playable audio", playable.inspected);
  return {
    mimeType: playable.mimeType,
    buffer: playable.buffer,
    chunkCount: parts.length,
    provider: "sarvam",
    language: "hi",
  };
}

export async function synthesizeHindiSpeech(text, options = {}) {
  return generateSarvamSpeech(text, options);
}
