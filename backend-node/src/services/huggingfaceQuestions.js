import { randomUUID } from "crypto";
import { env } from "../config/env.js";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_WHOAMI_URL = "https://huggingface.co/api/whoami-v2";
const REQUEST_TIMEOUT_MS = 25000;

let authProbe = null;

function hfLog(message, extra) {
  if (extra !== undefined) console.log("[HF-QUESTION]", message, extra);
  else console.log("[HF-QUESTION]", message);
}

function requireHfKey() {
  if (!env.huggingfaceApiKey) {
    const error = new Error("Question generation is not configured.");
    error.statusCode = 503;
    throw error;
  }
}

function tokenFingerprint() {
  const token = env.huggingfaceApiKey;
  return {
    present: Boolean(token),
    chars: token.length,
    prefix: token.startsWith("hf_") ? "hf_" : token ? "other" : "none",
  };
}

function routedModelId() {
  const model = env.huggingfaceQuestionModel;
  const provider = env.huggingfaceInferenceProvider;
  if (!model || model.includes(":")) return model;
  if (!provider) return model;
  return `${model}:${provider}`;
}

function permissionNames(authPayload) {
  const fineGrained = authPayload?.auth?.accessToken?.fineGrained || {};
  const names = [];
  for (const group of [fineGrained.global, fineGrained.scoped]) {
    if (!Array.isArray(group)) continue;
    for (const item of group) {
      for (const perm of item?.permissions || []) names.push(String(perm));
    }
  }
  return [...new Set(names)].sort();
}

async function probeHfAuth() {
  if (authProbe) return authProbe;
  requireHfKey();
  try {
    const response = await fetch(HF_WHOAMI_URL, {
      headers: { Authorization: `Bearer ${env.huggingfaceApiKey}` },
    });
    const raw = await response.text();
    let payload = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = {};
    }
    const permissions = permissionNames(payload);
    authProbe = {
      ok: response.ok,
      status: response.status,
      type: payload?.type || payload?.auth?.type || "unknown",
      tokenRole: payload?.auth?.accessToken?.role || payload?.auth?.type || "unknown",
      permissions,
      canCallInferenceProviders:
        permissions.includes("inference.serverless.write") ||
        permissions.includes("inference.endpoints.infer.write") ||
        String(payload?.auth?.accessToken?.role || "").toLowerCase() === "write",
      permissionCount: permissions.length,
    };
    hfLog("auth probe", authProbe);
    if (response.ok && authProbe.canCallInferenceProviders === false && authProbe.tokenRole === "fineGrained") {
      hfLog("auth warning", {
        message:
          "Fine-grained token is missing Inference Providers permission (Make calls to Inference Providers).",
      });
    }
  } catch (error) {
    authProbe = {
      ok: false,
      status: 0,
      type: "probe_failed",
      tokenRole: "unknown",
      canCallInferenceProviders: false,
      permissionCount: 0,
    };
    hfLog("auth probe failed", { status: 0, message: sanitizeHfError(error?.message) });
  }
  return authProbe;
}

function domainFromCourse(course) {
  const key = String(course || "").toUpperCase();
  if (key === "MTECH") return "postgraduate computer science, systems, and applied engineering";
  if (key === "MCA") return "full-stack software development, web applications, and programming";
  if (key === "BTECH") return "undergraduate computer science and software engineering";
  return "software engineering";
}

function levelLabel(level) {
  const key = String(level || "").toUpperCase();
  if (key === "FRESHER") return "fresher / entry-level";
  if (key === "EXPERIENCED") return "experienced professional";
  return "intermediate";
}

export function sanitizeInterviewQuestion(raw) {
  let text = String(raw || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  text = text.replace(/^["'`]+|["'`]+$/g, "").trim();
  text = text.replace(/^(here('?s| is) (your|the) (interview )?question[:\s-]*)/i, "");
  text = text.replace(/^(interview question[:\s-]*)/i, "");
  text = text.replace(/^(question\s*\d*\s*[:.-]\s*)/i, "");
  text = text.replace(/^(q\s*\d+\s*[:.-]\s*)/i, "");
  const match = text.match(/[^.!?]{12,400}\?/);
  if (match) text = match[0].trim();
  text = text.replace(/^[-*•\d.)\s]+/, "").trim();
  if (text.length < 12) return "";
  if (text.length > 400) {
    const cut = text.slice(0, 400);
    const mark = cut.lastIndexOf("?");
    text = mark >= 20 ? cut.slice(0, mark + 1) : `${cut.trim()}?`;
  }
  return text;
}

function extractChatText(payload) {
  const choice = payload?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "string" ? part : part?.text || "")).join(" ");
  }
  if (typeof payload?.generated_text === "string") return payload.generated_text;
  if (Array.isArray(payload) && payload[0]?.generated_text) return payload[0].generated_text;
  return "";
}

function sanitizeHfError(raw) {
  return String(raw || "")
    .slice(0, 240)
    .replace(/hf_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/bearer\s+\S+/gi, "Bearer [redacted]");
}

async function parseHfResponse(response) {
  const raw = await response.text();
  if (!response.ok) {
    const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : response.status === 403 ? 403 : 400;
    hfLog("error", { status: response.status, message: sanitizeHfError(raw) });
    const error = new Error(
      response.status === 429
        ? "Question generation is busy. Please try again in a moment."
        : response.status === 403
          ? "Hugging Face token cannot call Inference Providers. Enable “Make calls to Inference Providers” on the existing backend HF_TOKEN."
          : "Could not generate the next interview question."
    );
    error.statusCode = status === 403 ? 403 : status;
    error.retryable = response.status === 400 || response.status === 404;
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const error = new Error("Could not generate the next interview question.");
    error.statusCode = 502;
    throw error;
  }
  const question = sanitizeInterviewQuestion(extractChatText(parsed));
  if (!question) {
    hfLog("error", { status: 502, message: "empty or invalid question text" });
    const error = new Error("Could not generate the next interview question.");
    error.statusCode = 502;
    throw error;
  }
  hfLog("question generated", { chars: question.length });
  return question;
}

async function postChatCompletions(model, messages, signal) {
  hfLog("request started", {
    model,
    endpoint: "router.huggingface.co/v1/chat/completions",
    ...tokenFingerprint(),
  });
  const response = await fetch(HF_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.huggingfaceApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 180,
      temperature: 0.7,
    }),
    signal,
  });
  return parseHfResponse(response);
}

async function callHuggingFaceInference(messages, signal) {
  requireHfKey();
  await probeHfAuth();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.("abort", onAbort);
  const routed = routedModelId();
  const bare = env.huggingfaceQuestionModel;
  try {
    try {
      return await postChatCompletions(routed, messages, controller.signal);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      if (!error?.retryable || routed === bare) throw error;
      hfLog("retry without provider suffix", { model: bare });
      return await postChatCompletions(bare, messages, controller.signal);
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeout = new Error("Question generation timed out. Please try again.");
      timeout.statusCode = 504;
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}

function buildSystemPrompt() {
  return `You are a professional interviewer conducting a spoken interview.
Return exactly one interview question as plain text.
Do not include numbering, labels, quotes, markdown, or explanations.
Do not answer the question. Do not greet the candidate.`;
}

export async function generateInterviewQuestion({
  course,
  level,
  type,
  questionNumber = 1,
  plannedCount = env.interviewQuestionCount,
  previousQuestion = "",
  candidateAnswer = "",
  evaluation = "",
  feedback = "",
  previousQuestions = [],
  signal,
} = {}) {
  const role = domainFromCourse(course);
  const experience = levelLabel(level);
  const interviewType = String(type || "TECHNICAL").toUpperCase();
  const avoided = (previousQuestions || []).map((item) => String(item || "").trim()).filter(Boolean);
  const userParts = [
    `Job/program context: ${String(course || "BTECH").toUpperCase()} (${role}).`,
    `Experience level: ${experience}.`,
    `Interview type: ${interviewType}.`,
    `This is question ${questionNumber} of ${plannedCount}.`,
  ];
  if (previousQuestion) {
    userParts.push(`Previous question: ${previousQuestion}`);
  }
  if (candidateAnswer) {
    userParts.push(`Candidate's latest answer: ${candidateAnswer}`);
  }
  if (evaluation) {
    userParts.push(`Latest evaluation: ${evaluation}`);
  }
  if (feedback) {
    userParts.push(`Latest feedback: ${String(feedback).slice(0, 400)}`);
  }
  if (avoided.length) {
    userParts.push(`Do not repeat these questions: ${avoided.join(" | ")}`);
  }
  if (questionNumber === 1) {
    userParts.push(
      "Ask an opening interview question that fits this role, skill domain, and difficulty. Keep it conversational and specific."
    );
  } else {
    userParts.push(
      "Ask the next adaptive interview question. Follow up on gaps or go deeper based on the answer when useful. Stay in the same job/technical context. One question only."
    );
  }

  return callHuggingFaceInference(
    [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: userParts.join("\n") },
    ],
    signal
  );
}

export function buildStoredQuestion({ questionText, course, level, type }) {
  return {
    id: `hf-${randomUUID()}`,
    questionText: sanitizeInterviewQuestion(questionText),
    course: String(course || "BTECH").toUpperCase(),
    level: level || "INTERMEDIATE",
    type: String(type || "TECHNICAL").toUpperCase(),
  };
}

export const plannedInterviewQuestionCount = () => env.interviewQuestionCount;
