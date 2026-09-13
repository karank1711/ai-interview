import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { fallbackGradeFromTranscript, transcriptCommunicationHint } from "../utils/evaluation.js";

export const TRANSCRIBE_LIVE_MODEL = "gemini-3.5-transcribe-live";

export const TRANSCRIBE_LIVE_CONFIG = {
  responseModalities: ["TEXT"],
  inputAudioTranscription: { mode: "smart" }
};

function getClient() {
  if (!env.geminiApiKey) {
    const error = new Error("Gemini is not configured on the server.");
    error.statusCode = 503;
    throw error;
  }
  return new GoogleGenAI({
    apiKey: env.geminiApiKey,
    httpOptions: { apiVersion: "v1alpha" }
  });
}

function getRestClient() {
  if (!env.geminiApiKey) {
    const error = new Error("Gemini is not configured on the server.");
    error.statusCode = 503;
    throw error;
  }
  return new GoogleGenAI({
    apiKey: env.geminiApiKey,
    httpOptions: { apiVersion: "v1beta" }
  });
}

async function createConstrainedToken(client, { model, config, expireTime, newSessionExpireTime }) {
  const token = await client.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      newSessionExpireTime,
      liveConnectConstraints: {
        model,
        config
      },
      httpOptions: { apiVersion: "v1alpha" }
    }
  });
  const name = token?.name;
  if (!name) {
    const error = new Error("Could not create a Gemini Live session token.");
    error.statusCode = 502;
    throw error;
  }
  return { token: name, model, expiresAt: expireTime };
}

export async function createTranscribeEphemeralToken() {
  const client = getClient();
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const transcribe = await createConstrainedToken(client, {
    model: process.env.GEMINI_TRANSCRIBE_MODEL || TRANSCRIBE_LIVE_MODEL,
    config: TRANSCRIBE_LIVE_CONFIG,
    expireTime,
    newSessionExpireTime
  });
  return { transcribe };
}

export async function createLiveEphemeralTokens() {
  return createTranscribeEphemeralToken();
}

/** @deprecated Use createLiveEphemeralTokens */
export async function createLiveEphemeralToken() {
  const tokens = await createTranscribeEphemeralToken();
  return tokens;
}

const FALLBACK_CLOSING =
  "Thank you for completing this interview. We appreciate the time you spent answering each question. This session is now complete, and your report will be available shortly.";

export async function generateClosingRemarksText(items = []) {
  const recap = (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const answer = String(item?.answer || "").trim() || "(no speech captured)";
      return `Question ${index + 1}: ${item?.questionText || ""}\nCandidate answer: ${answer}`;
    })
    .join("\n\n");
  const prompt = `Write a short professional spoken interview closing of 3 to 5 sentences.
Thank the candidate, acknowledge that the interview is complete, and give a high-level impression based only on the answers below.
Do not ask another question. Do not mention numeric scores or grades.
Do not invent achievements, skills, or questions that were not asked.
Do not read the answers back word for word.
Return plain spoken text only.

${recap || "No answers were captured."}`;
  try {
    const client = getRestClient();
    let lastError;
    for (const model of GRADE_MODELS) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
        });
        const text = String(modelText(response) || "").replace(/^["'\s]+|["'\s]+$/g, "").trim();
        if (text) return text;
      } catch (error) {
        lastError = error;
        if (isMissingModelError(error)) continue;
        if (!isRetryableGeminiError(error)) break;
      }
    }
    if (lastError) console.error("[GEMINI] closing text generation failed");
  } catch {
    console.error("[GEMINI] closing text generation failed");
  }
  return FALLBACK_CLOSING;
}

function parseJsonObject(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/\{[\s\S]*\}/);
  const payload = fenced ? fenced[0] : raw;
  return JSON.parse(payload);
}

function modelText(response) {
  if (!response) return "";
  if (typeof response.text === "function") return response.text() || "";
  if (typeof response.text === "string") return response.text;
  const parts = response.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || "").join("");
}

export function scoreFromEvaluation(evaluation, suggestedScore) {
  const category = String(evaluation || "unanswered").toLowerCase();
  const ranges = {
    correct: [80, 100],
    partially_correct: [50, 79],
    incorrect: [0, 49],
    unanswered: [0, 0],
    insufficient: [0, 0]
  };
  const range = ranges[category] || ranges.incorrect;
  const numeric = Number(suggestedScore);
  if (Number.isFinite(numeric)) {
    return Math.max(range[0], Math.min(range[1], Math.round(numeric)));
  }
  return range[0];
}

const GRADE_PROMPT = `You are grading one interview answer using only the candidate's final transcript.
Return JSON only with keys:
evaluation, score, mistake, idealAnswer, feedback,
communicationScore, technicalScore, problemSolvingApplicable, problemSolvingScore.
evaluation must be one of: correct, partially_correct, incorrect.
score is an integer 0-100 for overall answer quality:
- correct: 80-100
- partially_correct: 50-79
- incorrect: 0-49
communicationScore (0-100) scores spoken communication independently: clarity, relevance, completeness, structure, and unnecessary repetition. Do not copy score unless they truly match.
technicalScore (0-100) scores technical accuracy independently: correctness, important concepts covered, missing concepts, and depth. Do not copy score unless they truly match.
problemSolvingApplicable is true only if the question asks for reasoning, design, approach, tradeoffs, or solving a problem. Otherwise false.
problemSolvingScore (0-100) is required only when problemSolvingApplicable is true. Score reasoning, approach, logical structure, solution quality, completeness, and edge cases. If not applicable, omit it and do not penalize.
mistake: what was wrong or missing (1-3 sentences). Empty string if fully correct.
idealAnswer: a concise ideal/correct answer (2-6 sentences).
feedback: brief explanation of the grade (1-3 sentences).
Do not invent content the candidate did not say. Do not use placeholder or random scores.`;

const GRADE_MODELS = [
  process.env.GEMINI_GRADE_MODEL || "gemini-3.6-flash",
  "gemini-3.6-flash-lite",
  "gemini-3-flash",
  "gemini-flash-lite-latest"
].filter((model, index, all) => model && all.indexOf(model) === index);

function geminiErrorMessage(error) {
  return String(error?.error?.message || error?.message || error || "unknown");
}

function isRetryableGeminiError(error) {
  const message = geminiErrorMessage(error);
  return /503|UNAVAILABLE|high demand|RESOURCE_EXHAUSTED|429|try again/i.test(message);
}

function isMissingModelError(error) {
  const message = geminiErrorMessage(error);
  return /404|NOT_FOUND|no longer available|not found/i.test(message);
}

function retryDelayMs(error) {
  const message = geminiErrorMessage(error);
  const seconds = message.match(/Please retry in ([\d.]+)\s*s/i);
  if (seconds) return Math.min(20000, Math.max(400, Math.ceil(Number(seconds[1]) * 1000)));
  const millis = message.match(/Please retry in ([\d.]+)\s*ms/i);
  if (millis) return Math.min(20000, Math.max(400, Math.ceil(Number(millis[1]))));
  return 800;
}

async function generateJsonContent(prompt) {
  const client = getRestClient();
  let lastError;
  for (const model of GRADE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await client.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
      } catch (error) {
        lastError = error;
        console.error("[EVAL] Gemini request failed", {
          model,
          attempt,
          message: geminiErrorMessage(error)
        });
        if (isMissingModelError(error)) break;
        if (!isRetryableGeminiError(error) || attempt === 2) break;
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(error)));
      }
    }
  }
  throw lastError;
}

function unansweredResult() {
  return {
    evaluation: "unanswered",
    score: 0,
    maxScore: 100,
    mistake: "No final spoken answer was captured for this question.",
    idealAnswer: "A complete spoken answer covering the main points of the question.",
    feedback: "This question was unanswered.",
    communicationScore: 0,
    technicalScore: 0,
    problemSolvingApplicable: false,
    problemSolvingScore: null
  };
}

function ungradedResult(answer) {
  return {
    evaluation: "ungraded",
    score: null,
    maxScore: 100,
    mistake: "Automatic grading could not finish. The recorded answer was saved.",
    idealAnswer: "",
    feedback: "The answer was recorded but could not be auto-graded.",
    communicationScore: transcriptCommunicationHint(answer),
    technicalScore: null,
    problemSolvingApplicable: false,
    problemSolvingScore: null
  };
}

function normalizeParsedGrade(parsed, answer) {
  let evaluation = String(parsed?.evaluation || "").toLowerCase();
  if (!["correct", "partially_correct", "incorrect"].includes(evaluation)) {
    evaluation = "incorrect";
  }
  const contentScore = scoreFromEvaluation(evaluation, parsed?.score);
  const communicationHint = transcriptCommunicationHint(answer);
  let communicationScore = Number(parsed?.communicationScore);
  communicationScore = Number.isFinite(communicationScore)
    ? Math.round(communicationScore * 0.75 + communicationHint * 0.25)
    : communicationHint;
  let technicalScore = Number(parsed?.technicalScore);
  technicalScore = Number.isFinite(technicalScore) ? technicalScore : contentScore;
  const problemSolvingApplicable = parsed?.problemSolvingApplicable === true;
  let problemSolvingScore = Number(parsed?.problemSolvingScore);
  if (!problemSolvingApplicable) problemSolvingScore = null;
  else if (!Number.isFinite(problemSolvingScore)) problemSolvingScore = contentScore;
  return {
    evaluation,
    score: contentScore,
    maxScore: 100,
    mistake: String(parsed?.mistake || "").slice(0, 800),
    idealAnswer: String(parsed?.idealAnswer || parsed?.ideal_answer || "").slice(0, 1200),
    feedback: String(parsed?.feedback || "").slice(0, 800),
    communicationScore: Math.max(0, Math.min(100, Math.round(communicationScore))),
    technicalScore: Math.max(0, Math.min(100, Math.round(technicalScore))),
    problemSolvingApplicable,
    problemSolvingScore:
      problemSolvingScore == null ? null : Math.max(0, Math.min(100, Math.round(problemSolvingScore)))
  };
}

function parseGradesPayload(text) {
  const raw = String(text || "").trim();
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (objectMatch) {
    const parsed = parseJsonObject(objectMatch[0]);
    if (Array.isArray(parsed.grades)) return parsed.grades;
    if (Array.isArray(parsed.results)) return parsed.results;
    if (parsed.evaluation) return [parsed];
  }
  if (arrayMatch) return JSON.parse(arrayMatch[0]);
  throw new Error("Could not parse grading JSON");
}

export async function gradeInterviewAnswer({ questionText, transcript }) {
  const [graded] = await gradeInterviewAnswers([{ questionText, transcript }]);
  return graded;
}

export async function gradeInterviewAnswers(items) {
  const list = Array.isArray(items) ? items : [];
  const unansweredIndexes = [];
  const pending = [];
  list.forEach((item, index) => {
    const transcript = String(item?.transcript || "").trim();
    if (!transcript) unansweredIndexes.push(index);
    else pending.push({ index, transcript, questionText: item.questionText || "" });
  });
  const byIndex = new Map();
  unansweredIndexes.forEach((index) => byIndex.set(index, unansweredResult()));
  if (!pending.length) {
    return list.map((_, index) => byIndex.get(index));
  }

  const prompt = `${GRADE_PROMPT}

Grade every item independently. Return JSON only as {"grades":[{...one object per item, including "index"}]}.
index is the 1-based item number from the list below. Do not invent answers. Do not skip items.

${pending
  .map(
    (item, offset) =>
      `---\nindex: ${offset + 1}\nQuestion: ${item.questionText}\nFinal candidate transcript: ${item.transcript}`
  )
  .join("\n")}`;

  let provider = "gemini";
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await generateJsonContent(prompt);
      const grades = parseGradesPayload(modelText(response) || "");
      const listGrades = Array.isArray(grades) ? grades : [];
      pending.forEach((item, offset) => {
        const parsed =
          listGrades.find((grade) => Number(grade?.index) === offset + 1) || listGrades[offset] || null;
        byIndex.set(
          item.index,
          parsed
            ? normalizeParsedGrade(parsed, item.transcript)
            : fallbackGradeFromTranscript(item.transcript, item.questionText)
        );
      });
      lastError = "";
      break;
    } catch (error) {
      lastError = geminiErrorMessage(error);
      console.error("[EVAL] Gemini grade failed", { attempt, message: lastError });
      if (attempt === 2) {
        provider = "fallback";
        pending.forEach((item) => {
          byIndex.set(item.index, fallbackGradeFromTranscript(item.transcript, item.questionText));
        });
      }
    }
  }
  console.log("[EVAL] grading-provider", {
    provider,
    pending: pending.length,
    unanswered: unansweredIndexes.length,
    error: lastError || null,
  });
  return list.map((_, index) => byIndex.get(index) || unansweredResult());
}

export async function evaluateSpokenAnswer({ questionText, transcript, durationSec }) {
  const graded = await gradeInterviewAnswer({ questionText, transcript });
  return {
    ...graded,
    durationSec: Number(durationSec) || 0
  };
}

export async function analyzeAnswerCompleteness({ questionText, transcript }) {
  const answer = String(transcript || "").trim();
  if (!answer) {
    return { complete: false, declinedToAddMore: false };
  }
  if (answer.split(/\s+/).filter(Boolean).length < 8) {
    return { complete: false, declinedToAddMore: false };
  }

  const prompt = `You are checking whether an interview answer is finished enough to grade.
Return JSON only with keys: complete (boolean).
complete=true only if the candidate addressed the question with a self-contained explanation (not just a fragment, one-liner, or trailing-off thought).
complete=false if the answer is short, incomplete, missing explanation/examples, or could reasonably be expanded.
When unsure, return complete=false.
Do not grade the answer. Do not invent extra content.

Question: ${questionText}
Candidate transcript: ${answer}`;

  const response = await generateJsonContent(prompt);
  const parsed = parseJsonObject(modelText(response) || "{}");
  return {
    complete: parsed.complete === true,
    declinedToAddMore: false
  };
}
