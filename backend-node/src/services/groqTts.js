import { env } from "../config/env.js";

const GROQ_SPEECH_URL = "https://api.groq.com/openai/v1/audio/speech";
const GROQ_TTS_MODEL = "canopylabs/orpheus-v1-english";
const GROQ_TTS_VOICE = "hannah";
const GROQ_TTS_FORMAT = "wav";
const MAX_INPUT_CHARS = 180;

function groqLog(message, extra) {
  if (extra !== undefined) console.log("[GROQ-TTS]", message, extra);
  else console.log("[GROQ-TTS]", message);
}

function sanitizeGroqErrorText(raw) {
  const text = String(raw || "").slice(0, 400);
  return text
    .replace(/bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/gsk_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/authorization["']?\s*[:=]\s*["']?[^"',}\s]+/gi, "authorization:[redacted]");
}

function groqErrorMessage(rawBody) {
  const body = String(rawBody || "").trim();
  if (!body) return "empty error body";
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message || parsed?.message || parsed?.error || body;
    return sanitizeGroqErrorText(typeof message === "string" ? message : JSON.stringify(message));
  } catch {
    return sanitizeGroqErrorText(body);
  }
}

export function isTtsProviderFailure(status, rawBody) {
  const code = Number(status);
  const text = `${rawBody || ""}`.toLowerCase();
  return (
    code === 429
    || code === 408
    || code === 500
    || code === 502
    || code === 503
    || /rate.?limit|tpd|tokens per day|quota|timeout|timed out|over capacity/i.test(text)
  );
}

function requireGroqKey() {
  if (!env.groqApiKey) {
    const error = new Error("Interviewer voice is not configured.");
    error.statusCode = 503;
    throw error;
  }
}

export function chunkTtsText(raw, maxChars = MAX_INPUT_CHARS) {
  const limit = Math.max(40, Number(maxChars) || MAX_INPUT_CHARS);
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  if (text.length <= limit) return [text];

  const chunks = [];
  let remaining = text;
  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    let splitAt = -1;
    const sentence = window.match(/.*[.!?](\s|$)/s);
    if (sentence) splitAt = sentence[0].length;
    if (splitAt < 40) {
      const punct = Math.max(window.lastIndexOf(";"), window.lastIndexOf(":"), window.lastIndexOf(","));
      if (punct >= 40) splitAt = punct + 1;
    }
    if (splitAt < 40) {
      const space = window.lastIndexOf(" ");
      if (space >= 40) splitAt = space + 1;
    }
    if (splitAt < 40) splitAt = limit;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks.filter(Boolean);
}

function wavPayload(buffer) {
  const marker = Buffer.from("data");
  const idx = buffer.indexOf(marker);
  if (idx < 0 || idx + 8 > buffer.length) return buffer;
  const size = buffer.readUInt32LE(idx + 4);
  return buffer.subarray(idx + 8, Math.min(buffer.length, idx + 8 + size));
}

export function concatWavBuffers(buffers) {
  const list = (buffers || []).filter((item) => item && item.length);
  if (!list.length) return Buffer.alloc(0);
  if (list.length === 1) return list[0];
  const payloads = list.map(wavPayload);
  const first = list[0];
  const dataIdx = first.indexOf(Buffer.from("data"));
  if (dataIdx < 0) return Buffer.concat(list);
  const header = Buffer.from(first.subarray(0, dataIdx + 8));
  const data = Buffer.concat(payloads);
  header.writeUInt32LE(36 + data.length, 4);
  header.writeUInt32LE(data.length, dataIdx + 4);
  return Buffer.concat([header, data]);
}

async function synthesizeChunk(input, signal) {
  requireGroqKey();
  const spoken = String(input || "").replace(/\s+/g, " ").trim();
  if (!spoken) {
    const error = new Error("Interviewer text is required.");
    error.statusCode = 400;
    throw error;
  }
  groqLog("request started", { chars: spoken.length });
  const response = await fetch(GROQ_SPEECH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_TTS_MODEL,
      voice: GROQ_TTS_VOICE,
      input: spoken,
      response_format: GROQ_TTS_FORMAT,
    }),
    signal,
  });
  if (!response.ok) {
    const rawBody = await response.text();
    groqLog("error", { status: response.status, message: groqErrorMessage(rawBody) });
    const quota = isTtsProviderFailure(response.status, rawBody);
    const error = new Error(
      quota
        ? "Interviewer voice is temporarily unavailable."
        : "Could not generate interviewer voice."
    );
    error.statusCode = quota ? 429 : response.status >= 500 ? 502 : 400;
    error.code = quota ? "TTS_UNAVAILABLE" : "TTS_ERROR";
    error.voiceAvailable = false;
    throw error;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  groqLog("audio generated", { bytes: bytes.length });
  return bytes;
}

export async function generateGroqSpeech(text, { signal } = {}) {
  const spoken = String(text || "").trim();
  const chunks = chunkTtsText(spoken);
  if (!chunks.length) {
    const error = new Error("Interviewer text is required.");
    error.statusCode = 400;
    throw error;
  }
  const parts = [];
  for (const chunk of chunks) {
    parts.push(await synthesizeChunk(chunk, signal));
  }
  return {
    mimeType: "audio/wav",
    buffer: concatWavBuffers(parts),
    chunkCount: parts.length,
    provider: "groq",
    language: "en",
  };
}

export async function synthesizeInterviewerSpeech(text, options = {}) {
  return generateGroqSpeech(text, options);
}
