import { env } from "../config/env.js";
import { detectTtsLanguage } from "./speechLanguage.js";
import { generateGroqSpeech, isTtsProviderFailure } from "./groqTts.js";
import { generateSarvamSpeech } from "./sarvamTts.js";

export { isTtsProviderFailure, chunkTtsText } from "./groqTts.js";
export { detectTtsLanguage } from "./speechLanguage.js";
export { generateGroqSpeech } from "./groqTts.js";
export { generateSarvamSpeech } from "./sarvamTts.js";

const PROVIDER_TIMEOUT_MS = 25000;
const TEXT_ONLY_MESSAGE = "Audio is temporarily unavailable. You can still read the response.";

function ttsLog(message, extra) {
  if (extra !== undefined) console.log("[TTS]", message, extra);
  else console.log("[TTS]", message);
}

function textOnlyError(status = 502) {
  const error = new Error(TEXT_ONLY_MESSAGE);
  error.statusCode = status;
  error.code = "TTS_UNAVAILABLE";
  error.voiceAvailable = false;
  error.textOnly = true;
  return error;
}

export function isRetryableTtsError(error, clientSignal) {
  if (clientSignal?.aborted) return false;
  const status = Number(error?.statusCode || error?.status || 0);
  if (status === 400 && /required/i.test(String(error?.message || ""))) return false;
  if (error?.code === "TTS_TIMEOUT" || error?.code === "TTS_UNAVAILABLE" || error?.code === "TTS_ERROR") {
    return true;
  }
  if ([408, 429, 500, 502, 503].includes(status)) return true;
  if (error?.name === "AbortError") return true;
  if (!status) return true;
  return isTtsProviderFailure(status, error?.message);
}

function providerTimeoutSignal(external, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    const timeout = new Error("TTS provider timed out.");
    timeout.statusCode = 408;
    timeout.code = "TTS_TIMEOUT";
    controller.abort(timeout);
  }, ms);
  const onAbort = () => controller.abort(external?.reason);
  external?.addEventListener?.("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      external?.removeEventListener?.("abort", onAbort);
    },
  };
}

async function callProvider(name, text, externalSignal) {
  const timed = providerTimeoutSignal(externalSignal, PROVIDER_TIMEOUT_MS);
  try {
    if (name === "sarvam") return await generateSarvamSpeech(text, { signal: timed.signal });
    return await generateGroqSpeech(text, { signal: timed.signal });
  } catch (error) {
    if (timed.signal.aborted && !externalSignal?.aborted) {
      const timeout = new Error("TTS provider timed out.");
      timeout.statusCode = 408;
      timeout.code = "TTS_TIMEOUT";
      throw timeout;
    }
    throw error;
  } finally {
    timed.cleanup();
  }
}

function configuredProviders(primary) {
  const secondary = primary === "sarvam" ? "groq" : "sarvam";
  const has = {
    sarvam: Boolean(env.sarvamApiKey),
    groq: Boolean(env.groqApiKey),
  };
  const order = [];
  if (has[primary]) order.push(primary);
  else {
    ttsLog("skip provider", { provider: primary, reason: "missing_api_key" });
  }
  if (has[secondary]) order.push(secondary);
  else {
    ttsLog("skip provider", { provider: secondary, reason: "missing_api_key" });
  }
  return order;
}

export async function generateSpeechWithFallback(text, { signal } = {}) {
  const spoken = String(text || "").trim();
  if (!spoken) {
    const error = new Error("Interviewer text is required.");
    error.statusCode = 400;
    throw error;
  }

  const language = detectTtsLanguage(spoken);
  const primary = language === "hi" ? "sarvam" : "groq";
  const order = configuredProviders(primary);

  ttsLog("route selected", {
    language,
    primary,
    providers: order,
    chars: spoken.length,
  });

  if (!order.length) {
    ttsLog("final result", { success: false, textOnly: true, reason: "no_provider_configured" });
    throw textOnlyError(503);
  }

  let lastError = null;
  for (let index = 0; index < order.length; index += 1) {
    const provider = order[index];
    if (signal?.aborted) throw lastError || textOnlyError(499);
    ttsLog("attempt", { provider, fallback: index > 0 });
    try {
      const audio = await callProvider(provider, spoken, signal);
      audio.fallback = index > 0;
      ttsLog("final result", {
        success: true,
        provider: audio.provider || provider,
        fallback: index > 0,
        bytes: audio.buffer?.length || 0,
      });
      return audio;
    } catch (error) {
      lastError = error;
      const status = Number(error?.statusCode || error?.status || 0);
      ttsLog("provider failed", {
        provider,
        status: status || error?.code || "unknown",
        reason: String(error?.message || "provider_error").slice(0, 180),
      });
      const canFallback = index < order.length - 1 && isRetryableTtsError(error, signal);
      if (!canFallback) break;
      ttsLog("fallback", {
        from: provider,
        to: order[index + 1],
        status: status || error?.code || "unknown",
        reason: String(error?.message || "provider_error").slice(0, 180),
      });
    }
  }

  ttsLog("final result", { success: false, textOnly: true });
  throw textOnlyError(lastError?.statusCode === 429 ? 429 : 502);
}

export async function synthesizeInterviewerSpeech(text, options = {}) {
  return generateSpeechWithFallback(text, options);
}
