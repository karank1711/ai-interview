import { Router } from "express";
import { buildResultAnalytics, decodeAnswerFeedback, encodeAnswerFeedback, fallbackGradeFromTranscript, hasUsableAnswerGrade, transcriptCommunicationHint, unansweredGradeResult } from "../utils/evaluation.js";
import { createTranscribeEphemeralToken, evaluateSpokenAnswer, gradeInterviewAnswers, analyzeAnswerCompleteness, generateClosingRemarksText } from "../services/geminiLive.js";
import { synthesizeInterviewerSpeech, isTtsProviderFailure } from "../services/groqTts.js";
import {
  buildStoredQuestion,
  generateInterviewQuestion,
  plannedInterviewQuestionCount,
} from "../services/huggingfaceQuestions.js";
import {
  addInterviewAnswer,
  appendInterviewQuestion,
  completeInterview,
  createInterview,
  deleteInterview,
  getInterviewForUser,
  getUserInterviewStats,
  isUuid,
  listActiveInterviews,
  listInterviews,
  updateAnswerEvaluation,
  updateInterviewStatus
} from "../services/interviewStore.js";

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const nextQuestionLocks = new Map();

async function withNextQuestionLock(interviewId, fn) {
  const previous = nextQuestionLocks.get(interviewId) || Promise.resolve();
  let release = () => {};
  const current = new Promise((resolve) => {
    release = resolve;
  });
  nextQuestionLocks.set(interviewId, previous.then(() => current));
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

function validateInterviewId(req, res) {
  if (!isUuid(req.params.id)) {
    res.status(400).json({ success: false, message: "Invalid interview id" });
    return false;
  }
  return true;
}

const INTRO_QUESTION_ID = "intro-self";

function clientAnswerText(item) {
  return String(item?.userAnswer || item?.answer || "").trim();
}

function mergeScheduledQuestions(interview, extraAnswers = []) {
  const questions = [...(interview.questions || [])];
  const byId = new Map(questions.map((question) => [String(question.id), question]));
  const extras = [...(interview.answers || []), ...extraAnswers];
  for (const item of extras) {
    const id = String(item.questionId || item.id || "");
    if (!id || byId.has(id)) continue;
    const question = {
      id,
      questionText: item.question || item.questionText || "Interview question",
    };
    if (id === INTRO_QUESTION_ID) questions.unshift(question);
    else questions.push(question);
    byId.set(id, question);
  }
  return questions;
}

async function persistClientAnswers(interviewId, userId, interview, extraAnswers) {
  const extras = Array.isArray(extraAnswers) ? extraAnswers : [];
  let saved = 0;
  const existing = new Map();
  for (const row of interview.answers || []) {
    existing.set(String(row.questionId), String(row.answer || "").trim());
  }
  for (const item of extras) {
    const questionId = item?.questionId;
    const answer = clientAnswerText(item);
    if (!questionId || !answer) continue;
    const previous = existing.get(String(questionId));
    if (previous) continue;
    await addInterviewAnswer(interviewId, userId, {
      questionId,
      question: item.question || item.questionText || "Interview question",
      answer,
      timeTaken: Number(item.timeTaken || 0),
      score: 0,
      feedback: "",
    });
    existing.set(String(questionId), answer);
    saved += 1;
  }
  return saved;
}

router.post("/gemini-token", asyncHandler(async (req, res) => {
  try {
    const tokens = await createTranscribeEphemeralToken();
    return res.json({ success: true, data: tokens });
  } catch (error) {
    const status = error.statusCode || 502;
    console.error("Gemini token error:", error);
    return res.status(status).json({
      success: false,
      message: error.message || "Could not start candidate transcription. Please try again."
    });
  }
}));

router.post("/welcome-tts", asyncHandler(async (req, res) => {
  try {
    const audio = await synthesizeInterviewerSpeech("Welcome to InterviewIQ");
    res.setHeader("Content-Type", audio.mimeType);
    res.setHeader("Cache-Control", "no-store");
    return res.send(audio.buffer);
  } catch (error) {
    const status = error.statusCode || 502;
    console.error("[GROQ-TTS] welcome error");
    return res.status(status).json({
      success: false,
      voiceAvailable: false,
      message: "Could not generate interviewer voice.",
    });
  }
}));

router.post("/:id/interviewer/tts", asyncHandler(async (req, res) => {
  if (!validateInterviewId(req, res)) return;
  const interview = await getInterviewForUser(req.params.id, req.user.id);
  if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });
  const kind = String(req.body.kind || "other");
  let text = String(req.body.text || "").trim();
  if (kind === "closing" && !text) {
    text = await generateClosingRemarksText(req.body.recap || []);
  }
  if (!text) {
    return res.status(400).json({ success: false, message: "Interviewer text is required." });
  }
  try {
    const audio = await synthesizeInterviewerSpeech(text);
    res.setHeader("Content-Type", audio.mimeType);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Voice-Available", "true");
    return res.send(audio.buffer);
  } catch (error) {
    const status = error.statusCode || 502;
    const quota = error.code === "TTS_UNAVAILABLE" || isTtsProviderFailure(status, error.message);
    console.error("[GROQ-TTS] error", { status, code: error.code || "" });
    return res.status(quota ? 429 : status).json({
      success: false,
      voiceAvailable: false,
      message: quota
        ? "Interviewer voice is temporarily unavailable."
        : error.statusCode === 400
          ? error.message
          : "Could not generate interviewer voice.",
    });
  }
}));

router.post("/start", asyncHandler(async (req, res) => {
  const course = String(req.body.course || "BTECH").toUpperCase();
  const category = req.body.category || course;
  const level = req.body.level || "INTERMEDIATE";
  const type = req.body.type || "TECHNICAL";
  try {
    const interview = await createInterview({
      userId: req.user.id,
      course,
      category,
      level,
      type,
      questions: [],
      status: "CREATED"
    });
    return res.status(201).json({ success: true, data: interview });
  } catch (error) {
    const status = error.statusCode || 502;
    console.error("[HF-QUESTION] start failed", {
      status,
      message: String(error.message || "").slice(0, 240),
    });
    return res.status(status).json({
      success: false,
      message: error.message || "Could not create the interview."
    });
  }
}));

router.get("/history", asyncHandler(async (req, res) => {
  const started = Date.now();
  const page = Number(req.query.page || 0);
  const size = Number(req.query.size || 10);
  const interviews = await listInterviews({
    userId: req.user.id,
    page,
    size
  });
  if (process.env.NODE_ENV !== "production") {
    console.log(`[PERF] interviews/history db ${Date.now() - started}ms size=${size}`);
  }
  return res.json({ success: true, data: interviews });
}));

router.get("/active", asyncHandler(async (req, res) => {
  const interviews = await listActiveInterviews(req.user.id);
  return res.json({ success: true, data: interviews });
}));

router.get("/stats", asyncHandler(async (req, res) => {
  const stats = await getUserInterviewStats(req.user.id);
  return res.json({ success: true, data: stats });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  if (!validateInterviewId(req, res)) return;
  const interview = await getInterviewForUser(req.params.id, req.user.id);
  if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });
  return res.json({ success: true, data: interview });
}));

router.put("/:id/status", asyncHandler(async (req, res) => {
  if (!validateInterviewId(req, res)) return;
  const interview = await updateInterviewStatus(
    req.params.id,
    req.user.id,
    req.query.status || req.body.status || "IN_PROGRESS"
  );
  if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });
  return res.json({ success: true, data: interview });
}));

router.post("/:id/next-question", asyncHandler(async (req, res) => {
  if (!validateInterviewId(req, res)) return;
  return withNextQuestionLock(req.params.id, async () => {
  const interview = await getInterviewForUser(req.params.id, req.user.id);
  if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });
  const plannedCount = interview.plannedQuestionCount || plannedInterviewQuestionCount();
  const existing = interview.questions || [];
  if (existing.length >= plannedCount) {
    return res.json({
      success: true,
      data: { done: true, plannedQuestionCount: plannedCount, question: null, questions: existing },
    });
  }
  const previous = existing[existing.length - 1];
  const lastAnswer = (interview.answers || []).filter((item) => String(item.questionId) === String(previous?.id)).pop();
  const decoded = decodeAnswerFeedback(lastAnswer?.feedback || req.body.feedback || "");
  try {
    const questionText = await generateInterviewQuestion({
      course: interview.course,
      level: interview.level,
      type: interview.type,
      questionNumber: existing.length + 1,
      plannedCount,
      previousQuestion: String(req.body.previousQuestion || previous?.questionText || ""),
      candidateAnswer: String(req.body.candidateAnswer || lastAnswer?.answer || ""),
      evaluation: String(req.body.evaluation || decoded.evaluation || ""),
      feedback: String(req.body.feedback || decoded.feedback || ""),
      previousQuestions: existing.map((item) => item.questionText),
    });
    const stored = buildStoredQuestion({
      questionText,
      course: interview.course,
      level: interview.level,
      type: interview.type,
    });
    if (!stored.questionText) {
      return res.status(502).json({ success: false, message: "Could not generate the next interview question." });
    }
    const updated = await appendInterviewQuestion(req.params.id, req.user.id, stored, existing.length);
    return res.json({
      success: true,
      data: {
        done: false,
        plannedQuestionCount: plannedCount,
        question: stored,
        questions: updated?.questions || [...existing, stored],
      },
    });
  } catch (error) {
    const status = error.statusCode || 502;
    console.error("[HF-QUESTION] next failed", {
      status,
      message: String(error.message || "").slice(0, 240),
    });
    return res.status(status).json({
      success: false,
      message: error.message || "Could not generate the next interview question.",
    });
  }
  });
}));

router.post("/:id/answer", asyncHandler(async (req, res) => {
  if (!validateInterviewId(req, res)) return;
  const interview = await getInterviewForUser(req.params.id, req.user.id);
  if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });

  const questionId = req.body.questionId;
  const questionDoc = interview.questions.find((item) => item.id === questionId);
  const questionText = req.body.question || questionDoc?.questionText || "Interview question";
  const answerText = String(req.body.userAnswer || req.body.answer || "").trim();

  const updated = await addInterviewAnswer(req.params.id, req.user.id, {
    questionId,
    question: questionText,
    answer: answerText,
    timeTaken: Number(req.body.timeTaken || 0),
    score: 0,
    feedback: ""
  });

  console.log("[EVAL] saved final transcript", {
    interviewId: req.params.id,
    questionId,
    answerChars: answerText.length,
    wordCount: answerText ? answerText.split(/\s+/).filter(Boolean).length : 0
  });

  return res.json({
    success: true,
    data: updated,
    answerFeedback: {
      questionId,
      score: null,
      feedback: "",
      evaluation: null
    }
  });
}));

function normalizePreparedGrade(raw, transcript, durationSec) {
  const evaluation = String(raw?.evaluation || "").toLowerCase();
  if (!["correct", "partially_correct", "incorrect", "unanswered", "ungraded"].includes(evaluation)) {
    return null;
  }
  return {
    evaluation,
    score: raw.score == null ? null : Number(raw.score),
    maxScore: 100,
    mistake: String(raw.mistake || ""),
    idealAnswer: String(raw.idealAnswer || raw.ideal_answer || ""),
    feedback: String(raw.feedback || ""),
    communicationScore: Number.isFinite(Number(raw.communicationScore))
      ? Number(raw.communicationScore)
      : transcriptCommunicationHint(transcript),
    technicalScore: Number.isFinite(Number(raw.technicalScore))
      ? Number(raw.technicalScore)
      : Number.isFinite(Number(raw.score))
        ? Number(raw.score)
        : null,
    problemSolvingApplicable: raw.problemSolvingApplicable === true,
    problemSolvingScore: Number.isFinite(Number(raw.problemSolvingScore))
      ? Number(raw.problemSolvingScore)
      : null,
    durationSec: Number(durationSec) || Number(raw.durationSec) || 0
  };
}

router.post("/:id/evaluate-spoken", asyncHandler(async (req, res) => {
  if (!validateInterviewId(req, res)) return;
  const interview = await getInterviewForUser(req.params.id, req.user.id);
  if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });

  try {
    const isDraft = req.body.draft === true;
    const transcript = String(req.body.transcript || "").trim();
    let result = !isDraft ? normalizePreparedGrade(req.body.prepared, transcript, req.body.durationSec) : null;
    if (!result) {
      result = await evaluateSpokenAnswer({
        questionText: req.body.question || "",
        transcript,
        durationSec: req.body.durationSec
      });
    }
    const questionId = req.body.questionId;
    if (questionId && result?.evaluation) {
      await updateAnswerEvaluation(req.params.id, req.user.id, {
        questionId,
        score: result.score == null ? 0 : result.score,
        feedback: encodeAnswerFeedback(result)
      });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("Spoken evaluation error:", error);
    return res.status(502).json({
      success: false,
      message: error.message || "Could not evaluate the spoken answer. Please try again."
    });
  }
}));

router.post("/:id/analyze-completeness", asyncHandler(async (req, res) => {
  if (!validateInterviewId(req, res)) return;
  const interview = await getInterviewForUser(req.params.id, req.user.id);
  if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });
  try {
    const result = await analyzeAnswerCompleteness({
      questionText: req.body.question || "",
      transcript: req.body.transcript || ""
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("Completeness analysis error:", error);
    return res.status(502).json({
      success: false,
      message: error.message || "Could not analyze the answer."
    });
  }
}));

router.post("/:id/complete", asyncHandler(async (req, res) => {
  if (!validateInterviewId(req, res)) return;
  let interview = await getInterviewForUser(req.params.id, req.user.id);
  if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });

  const extraAnswers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const persistedFromClient = await persistClientAnswers(req.params.id, req.user.id, interview, extraAnswers);
  if (persistedFromClient > 0) {
    interview = await getInterviewForUser(req.params.id, req.user.id);
    if (!interview) return res.status(404).json({ success: false, message: "Interview not found" });
  }

  const savedAnswers = interview.answers || [];
  console.log("[EVAL] answers-loaded", {
    interviewId: req.params.id,
    savedAnswers: savedAnswers.length,
    persistedFromClient,
    clientAnswers: extraAnswers.length,
  });

  const endReason = String(req.body.endReason || "COMPLETED").toUpperCase();
  const endMessages = {
    COMPLETED: "Interview completed normally.",
    ENDED_EARLY: "Interview was ended early by the candidate.",
    CAMERA_OFF: "Interview ended because camera was not turned on.",
    MIC_OFF: "Interview ended because microphone was not turned on.",
    CAMERA_AND_MIC_OFF: "Interview ended because camera and microphone were not turned on.",
    FACE_NOT_DETECTED: "Interview ended because your face was not detected.",
    LOOKING_AWAY: "Interview ended because attention stayed away from the camera."
  };
  const endMessage = req.body.endMessage || endMessages[endReason] || endMessages.COMPLETED;

  const answersByQuestion = new Map();
  for (const saved of savedAnswers) {
    answersByQuestion.set(String(saved.questionId), saved);
  }

  const scheduledAll = mergeScheduledQuestions(interview, extraAnswers);
  const requestedAsked = Number(req.body.askedQuestionCount);
  const askedFromAnswers = savedAnswers.reduce((max, item) => {
    const idx = scheduledAll.findIndex((q) => String(q.id) === String(item.questionId));
    return idx >= 0 ? Math.max(max, idx + 1) : max;
  }, 0);
  let askedQuestionCount = Math.max(
    askedFromAnswers,
    Number.isFinite(requestedAsked) && requestedAsked > 0 ? requestedAsked : 0
  );
  if (askedQuestionCount === 0 && savedAnswers.length > 0) {
    askedQuestionCount = scheduledAll.length;
  }
  askedQuestionCount = Math.min(Math.max(askedQuestionCount, 0), scheduledAll.length);

  const scheduled = [];
  const seen = new Set();
  for (let i = 0; i < scheduledAll.length; i += 1) {
    const question = scheduledAll[i];
    const id = String(question.id);
    const hasAnswer = Boolean(String(answersByQuestion.get(id)?.answer || "").trim());
    if (hasAnswer || i < askedQuestionCount) {
      scheduled.push(question);
      seen.add(id);
    }
  }
  for (const saved of savedAnswers) {
    const id = String(saved.questionId);
    if (seen.has(id)) continue;
    scheduled.push({
      id: saved.questionId,
      questionText: saved.question || "Interview question",
    });
    seen.add(id);
  }

  console.log("[EVAL] asked-scope", {
    interviewId: req.params.id,
    generated: (interview.questions || []).length,
    scheduled: scheduled.length,
    askedQuestionCount,
    savedAnswers: savedAnswers.length,
    endReason
  });
  const needsLiveGrade = scheduled.some((question) => {
    const saved = answersByQuestion.get(String(question.id));
    const transcript = String(saved?.answer || "").trim();
    if (!transcript) return false;
    return !hasUsableAnswerGrade(saved);
  });
  const gradeItems = scheduled.map((question) => {
    const saved = answersByQuestion.get(String(question.id));
    return {
      questionText: question.questionText,
      transcript: String(saved?.answer || "").trim()
    };
  });
  const withTranscripts = gradeItems.filter((item) => item.transcript).length;
  console.log("[EVAL] grading-input", {
    interviewId: req.params.id,
    sentForGrading: gradeItems.length,
    withTranscripts,
    needsLiveGrade,
  });
  let gradedBatch;
  if (needsLiveGrade) {
    try {
      gradedBatch = await gradeInterviewAnswers(gradeItems);
    } catch (error) {
      console.error("[EVAL] grading-provider", {
        provider: "fallback",
        error: String(error.message || error).slice(0, 240),
      });
      gradedBatch = gradeItems.map((item) =>
        fallbackGradeFromTranscript(item.transcript, item.questionText)
      );
    }
  } else {
    gradedBatch = scheduled.map((question) => {
      const saved = answersByQuestion.get(String(question.id));
      const transcript = String(saved?.answer || "").trim();
      const decoded = decodeAnswerFeedback(saved?.feedback);
      if (!transcript) return unansweredGradeResult();
      if (!hasUsableAnswerGrade(saved)) {
        return fallbackGradeFromTranscript(transcript, question.questionText);
      }
      const evaluation = decoded.evaluation;
      return {
        evaluation,
        score: saved?.score,
        maxScore: 100,
        mistake: decoded.mistake || "",
        idealAnswer: decoded.idealAnswer || "",
        feedback: decoded.feedback || String(saved?.feedback || ""),
        communicationScore: decoded.communicationScore,
        technicalScore: decoded.technicalScore ?? (Number.isFinite(Number(saved?.score)) ? Number(saved.score) : null),
        problemSolvingApplicable: decoded.problemSolvingApplicable === true,
        problemSolvingScore: decoded.problemSolvingScore
      };
    });
  }
  const gradedQuestions = [];
  for (let i = 0; i < scheduled.length; i += 1) {
    const question = scheduled[i];
    const saved = answersByQuestion.get(String(question.id));
    const transcript = String(saved?.answer || "").trim();
    const graded = gradedBatch[i] || fallbackGradeFromTranscript(transcript, question.questionText);
    const usable = ["correct", "partially_correct", "incorrect", "unanswered"].includes(
      String(graded.evaluation || "").toLowerCase()
    );
    const resolved = usable
      ? { ...graded, evaluation: String(graded.evaluation).toLowerCase() }
      : transcript
        ? fallbackGradeFromTranscript(transcript, question.questionText)
        : unansweredGradeResult();
    const row = {
      questionNumber: i + 1,
      questionId: question.id,
      question: question.questionText,
      candidateAnswer: transcript,
      evaluation: resolved.evaluation,
      score: resolved.score,
      maxScore: resolved.maxScore || 100,
      mistake: resolved.mistake || "",
      idealAnswer: resolved.idealAnswer || "",
      feedback: resolved.feedback || "",
      timeTaken: Number(saved?.timeTaken || 0),
      communicationScore: resolved.communicationScore,
      technicalScore: resolved.technicalScore,
      problemSolvingApplicable: resolved.problemSolvingApplicable === true,
      problemSolvingScore: resolved.problemSolvingScore
    };
    if (row.evaluation === "unanswered" && endReason === "ENDED_EARLY") {
      row.mistake = "No spoken answer was submitted.";
      row.feedback =
        askedQuestionCount <= 1
          ? "No spoken answer was submitted because the interview was ended after the first question."
          : "No spoken answer was submitted for this asked question.";
      row.idealAnswer = "";
    }
    gradedQuestions.push(row);
    console.log("[EVAL] graded", {
      interviewId: req.params.id,
      questionId: question.id,
      questionNumber: row.questionNumber,
      evaluation: row.evaluation,
      score: row.score,
      maxScore: row.maxScore,
      answerChars: transcript.length,
      communicationScore: row.communicationScore,
      technicalScore: row.technicalScore,
      problemSolvingScore: row.problemSolvingScore
    });
    if (saved) {
      await updateAnswerEvaluation(req.params.id, req.user.id, {
        questionId: question.id,
        score: row.score == null ? 0 : row.score,
        feedback: encodeAnswerFeedback(row)
      });
    }
  }

  const analytics = buildResultAnalytics(gradedQuestions, req.body.visualAnalysis || null, {
    endReason
  });
  console.log("[EVAL] summary", {
    interviewId: req.params.id,
    questionsAsked: analytics.interviewSummary.questionsAsked,
    questionsAnswered: analytics.interviewSummary.questionsAnswered,
    unanswered: analytics.interviewSummary.unanswered,
    correct: analytics.interviewSummary.correct,
    partiallyCorrect: analytics.interviewSummary.partiallyCorrect,
    incorrect: analytics.interviewSummary.incorrect,
    totalMarks: analytics.interviewSummary.totalMarks,
    maxMarks: analytics.interviewSummary.maxMarks,
    accuracyPercent: analytics.interviewSummary.accuracyPercent,
    confidenceScore: analytics.confidenceScore,
    communicationScore: analytics.communicationScore,
    technicalScore: analytics.technicalScore,
    problemSolvingScore: analytics.problemSolvingScore,
    overallScore: analytics.overallScore,
    hasAnswerGrading: analytics.interviewSummary.hasAnswerGrading,
    hasVisualConfidence: analytics.interviewSummary.hasVisualConfidence
  });
  const perQuestionFeedback = {
    version: 1,
    summary: analytics.interviewSummary,
    questions: gradedQuestions
  };

  const persistPromise = completeInterview(req.params.id, req.user.id, {
    ...analytics,
    summary: `[${endReason}] ${endMessage}\n${analytics.summary}`,
    perQuestionFeedback,
    visualAnalysis: req.body.visualAnalysis || null,
    voiceAvailable: req.body.voiceAvailable !== false
  });
  const completed = await persistPromise;
  console.log("[EVAL] persist", {
    interviewId: req.params.id,
    ok: Boolean(completed?.result),
    resultId: completed?.result?.id || null,
    overallScore: completed?.result?.overallScore ?? analytics.overallScore,
    grade: completed?.result?.grade ?? analytics.grade,
    visualAnalysis: Boolean(completed?.result?.visualAnalysis),
  });
  if (!completed) return res.status(404).json({ success: false, message: "Interview not found" });
  return res.json({
    success: true,
    reportGenerated: true,
    voiceAvailable: req.body.voiceAvailable !== false,
    data: completed
  });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  if (!validateInterviewId(req, res)) return;
  const deleted = await deleteInterview(req.params.id, req.user.id);
  if (!deleted) return res.status(404).json({ success: false, message: "Interview not found" });
  return res.json({ success: true, message: "Interview deleted" });
}));

export default router;
