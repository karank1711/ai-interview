import { getSupabaseAdmin } from "../config/supabase.js";
import { env } from "../config/env.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_RE.test(String(value || ""));
}

function fail(error, fallback) {
  const err = new Error(fallback);
  err.cause = error;
  throw err;
}

function mapQuestion(row) {
  return {
    id: row.question_key,
    questionText: row.question_text,
    course: row.course,
    level: row.level,
    type: row.type
  };
}

function mapAnswer(row) {
  return {
    questionId: row.question_id,
    question: row.question,
    answer: row.answer,
    timeTaken: Number(row.time_taken || 0),
    score: Number(row.score || 0),
    feedback: row.feedback || "",
    createdAt: row.created_at
  };
}

export function mapInterview(row, questions = [], answers = []) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: row.user_id,
    course: row.course,
    category: row.category,
    level: row.level,
    type: row.type,
    status: row.status,
    plannedQuestionCount: env.interviewQuestionCount,
    questions: questions.map(mapQuestion),
    answers: answers.map(mapAnswer),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseEndReason(summary) {
  const text = String(summary || "");
  const match = text.match(/^\[([A-Z_]+)\]\s*([^\n]*)/);
  if (!match) {
    return { code: null, message: null };
  }
  return { code: match[1], message: match[2] || "Interview ended." };
}

function unwrapPerQuestionFeedback(raw) {
  if (Array.isArray(raw)) {
    return { questions: raw, summary: null, visualBackup: null, voiceAvailable: true };
  }
  if (raw && typeof raw === "object") {
    const questions = Array.isArray(raw.questions) ? raw.questions : [];
    return {
      questions,
      summary: raw.summary && typeof raw.summary === "object" ? raw.summary : null,
      visualBackup:
        raw.visualAnalysis && typeof raw.visualAnalysis === "object" ? raw.visualAnalysis : null,
      voiceAvailable: raw.voiceAvailable !== false
    };
  }
  return { questions: [], summary: null, visualBackup: null, voiceAvailable: true };
}

export function mapResult(row) {
  if (!row) return null;
  const unwrapped = unwrapPerQuestionFeedback(row.per_question_feedback);
  const visualFromColumn =
    row.visual_analysis && typeof row.visual_analysis === "object" && Object.keys(row.visual_analysis).length
      ? row.visual_analysis
      : null;
  const visualAnalysis = visualFromColumn || unwrapped.visualBackup || null;
  const interviewSummary = unwrapped.summary || null;
  return {
    _id: row.id,
    id: row.id,
    interviewId: row.interview_id,
    userId: row.user_id,
    overallScore: Number(row.overall_score || 0),
    confidenceScore: Number(row.confidence_score || 0),
    communicationScore: Number(row.communication_score || 0),
    technicalScore: Number(row.technical_score || 0),
    problemSolvingScore: Number(row.problem_solving_score || 0),
    passFail: Boolean(row.pass_fail),
    grade: row.grade,
    strengths: row.strengths || "",
    weaknesses: row.weaknesses || "",
    improvements: row.improvements || "",
    summary: row.summary || "",
    endReason: parseEndReason(row.summary).code,
    endMessage: parseEndReason(row.summary).message,
    interviewSummary,
    perQuestionFeedback: unwrapped.questions,
    visualAnalysis,
    voiceAvailable: unwrapped.voiceAvailable !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function loadQuestions(supabase, interviewId) {
  const { data, error } = await supabase
    .from("interview_questions")
    .select("question_key, question_text, course, level, type, sort_order")
    .eq("interview_id", interviewId)
    .order("sort_order", { ascending: true });
  if (error) fail(error, "Could not load interview questions");
  return data || [];
}

async function loadAnswers(supabase, interviewId) {
  const { data, error } = await supabase
    .from("interview_answers")
    .select("question_id, question, answer, time_taken, score, feedback, created_at")
    .eq("interview_id", interviewId)
    .order("created_at", { ascending: true });
  if (error) fail(error, "Could not load interview answers");
  return data || [];
}

async function loadInterviewBundle(supabase, interviewId, userId) {
  const { data: row, error } = await supabase
    .from("interviews")
    .select("id, user_id, course, category, level, type, status, created_at, updated_at")
    .eq("id", interviewId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail(error, "Could not load interview");
  if (!row) return null;
  const [questions, answers] = await Promise.all([
    loadQuestions(supabase, interviewId),
    loadAnswers(supabase, interviewId)
  ]);
  return mapInterview(row, questions, answers);
}

export async function createInterview({ userId, course, category, level, type, questions, status }) {
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("interviews")
    .insert({
      user_id: userId,
      course,
      category,
      level,
      type,
      status
    })
    .select("*")
    .single();
  if (error || !row) fail(error, "Could not create interview");

  const questionRows = (questions || []).map((item, index) => ({
    interview_id: row.id,
    user_id: userId,
    question_key: item.id,
    question_text: item.questionText,
    course: item.course || course,
    level: item.level || level,
    type: item.type || type,
    sort_order: index
  }));

  if (questionRows.length > 0) {
    const { error: questionError } = await supabase.from("interview_questions").insert(questionRows);
    if (questionError) fail(questionError, "Could not save interview questions");
  }

  return mapInterview(
    row,
    (questions || []).map((item) => ({
      question_key: item.id,
      question_text: item.questionText,
      course: item.course || course,
      level: item.level || level,
      type: item.type || type
    })),
    []
  );
}

export async function listInterviews({ userId, page = 0, size = 10, statuses }) {
  const supabase = getSupabaseAdmin();
  const from = page * size;
  const to = from + size - 1;
  let query = supabase
    .from("interviews")
    .select("id, user_id, course, category, level, type, status, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (statuses?.length) {
    query = query.in("status", statuses);
  }

  const { data, error } = await query;
  if (error) fail(error, "Could not load interviews");
  return (data || []).map((row) => mapInterview(row));
}

export async function getUserInterviewStats(userId) {
  const supabase = getSupabaseAdmin();
  const [totalRes, completedRes, resultsRes] = await Promise.all([
    supabase.from("interviews").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("interviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "COMPLETED"),
    supabase.from("interview_results").select("overall_score, pass_fail").eq("user_id", userId)
  ]);
  if (totalRes.error) fail(totalRes.error, "Could not load interview totals");
  if (completedRes.error) fail(completedRes.error, "Could not load completed interview totals");
  if (resultsRes.error) fail(resultsRes.error, "Could not load interview scores");

  const totalInterviews = Number(totalRes.count) || 0;
  const completedInterviews = Number(completedRes.count) || 0;
  const results = resultsRes.data || [];
  const averageScore = results.length
    ? Math.round(
        results.reduce((sum, row) => sum + (Number(row.overall_score) || 0), 0) / results.length
      )
    : 0;
  const passCount = results.filter((row) => row.pass_fail === true).length;
  const passRate = completedInterviews > 0 ? Math.round((passCount / completedInterviews) * 100) : 0;

  return {
    totalInterviews,
    completedInterviews,
    averageScore,
    passRate
  };
}

export async function listActiveInterviews(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("interviews")
    .select("id, user_id, course, category, level, type, status, created_at, updated_at")
    .eq("user_id", userId)
    .in("status", ["CREATED", "IN_PROGRESS"])
    .order("updated_at", { ascending: false });
  if (error) fail(error, "Could not load interviews");
  return (data || []).map((row) => mapInterview(row));
}

export async function getInterviewForUser(interviewId, userId) {
  return loadInterviewBundle(getSupabaseAdmin(), interviewId, userId);
}

export async function updateInterviewStatus(interviewId, userId, status) {
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("interviews")
    .update({ status })
    .eq("id", interviewId)
    .eq("user_id", userId)
    .select("id, user_id, course, category, level, type, status, created_at, updated_at")
    .maybeSingle();
  if (error) fail(error, "Could not update interview");
  if (!row) return null;
  return mapInterview(row);
}

export async function appendInterviewQuestion(interviewId, userId, question, sortOrder) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("interview_questions").insert({
    interview_id: interviewId,
    user_id: userId,
    question_key: question.id,
    question_text: question.questionText,
    course: question.course,
    level: question.level,
    type: question.type,
    sort_order: sortOrder
  });
  if (error) fail(error, "Could not save interview question");
  return loadInterviewBundle(supabase, interviewId, userId);
}

export async function addInterviewAnswer(interviewId, userId, answer) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("interview_answers").insert({
    interview_id: interviewId,
    user_id: userId,
    question_id: answer.questionId,
    question: answer.question,
    answer: answer.answer,
    time_taken: answer.timeTaken,
    score: answer.score,
    feedback: answer.feedback
  });
  if (error) fail(error, "Could not save answer");
  return loadInterviewBundle(supabase, interviewId, userId);
}

export async function updateAnswerEvaluation(interviewId, userId, { questionId, score, feedback }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("interview_answers")
    .select("id")
    .eq("interview_id", interviewId)
    .eq("user_id", userId)
    .eq("question_id", questionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail(error, "Could not load answer for evaluation update");
  if (!data?.id) return;
  const { error: updateError } = await supabase
    .from("interview_answers")
    .update({ score, feedback })
    .eq("id", data.id);
  if (updateError) fail(updateError, "Could not update answer evaluation");
}

function sanitizeVisualAnalysis(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  if (!raw.engine && raw.available == null && !raw.summary) return {};
  const engagement = raw.engagement && typeof raw.engagement === "object" ? raw.engagement : {};
  const signals = raw.signals && typeof raw.signals === "object" ? raw.signals : {};
  const share = raw.expressionShare && typeof raw.expressionShare === "object" ? raw.expressionShare : {};
  return {
    available: Boolean(raw.available),
    engine: String(raw.engine || "").slice(0, 80),
    sampleCount: Number(raw.sampleCount) || 0,
    faceSamples: Number(raw.faceSamples) || 0,
    durationSec: Number(raw.durationSec) || 0,
    faceVisiblePercent: Number(raw.faceVisiblePercent) || 0,
    dominantExpression: String(raw.dominantExpression || "").slice(0, 40),
    expressionShare: {
      smiling: Number(share.smiling) || 0,
      neutral: Number(share.neutral) || 0,
      stressed: Number(share.stressed) || 0
    },
    visualConfidenceIndicator: Number(raw.visualConfidenceIndicator) || 0,
    visualNervousnessIndicator: Number(raw.visualNervousnessIndicator) || 0,
    cameraAttention: String(raw.cameraAttention || "").slice(0, 40),
    attentionTowardCameraPercent: Number(raw.attentionTowardCameraPercent) || 0,
    attentionRiskIndicator: Number(raw.attentionRiskIndicator) || 0,
    offScreenEvents: Number(raw.offScreenEvents) || 0,
    offScreenDurationSec: Number(raw.offScreenDurationSec) || 0,
    attentionWarnings: Number(raw.attentionWarnings) || 0,
    faceMissingEvents: Number(raw.faceMissingEvents) || 0,
    lookingAwayPercent:
      Number(raw.lookingAwayPercent) ||
      Number(engagement.lookingAwayPercent) ||
      Math.max(0, 100 - (Number(raw.attentionTowardCameraPercent) || Number(engagement.facingCameraPercent) || 0)),
    lookingTowardCamera: Boolean(
      raw.lookingTowardCamera != null
        ? raw.lookingTowardCamera
        : (Number(raw.attentionTowardCameraPercent) || Number(engagement.facingCameraPercent) || 0) >= 60
    ),
    headStability: String(raw.headStability || engagement.headMovement || "").slice(0, 20),
    endedBecauseFaceMissing: Boolean(raw.endedBecauseFaceMissing),
    endedBecauseAttention: Boolean(raw.endedBecauseAttention),
    engagement: {
      facingCameraPercent: Number(engagement.facingCameraPercent) || 0,
      lookingAwayPercent: Number(engagement.lookingAwayPercent) || 0,
      blinksPerMinute: Number(engagement.blinksPerMinute) || 0,
      headMovement: String(engagement.headMovement || "").slice(0, 20),
      headYawStd: Number(engagement.headYawStd) || 0,
      headPitchStd: Number(engagement.headPitchStd) || 0
    },
    signals: {
      smile: Number(signals.smile) || 0,
      frown: Number(signals.frown) || 0,
      browFurrow: Number(signals.browFurrow) || 0,
      innerBrowRaise: Number(signals.innerBrowRaise) || 0,
      lipPress: Number(signals.lipPress) || 0,
      mouthStretch: Number(signals.mouthStretch) || 0,
      jawOpen: Number(signals.jawOpen) || 0,
      eyeBlink: Number(signals.eyeBlink) || 0,
      eyeMovement: Number(signals.eyeMovement) || 0
    },
    summary: String(raw.summary || "").slice(0, 2000),
    disclaimer: String(raw.disclaimer || "").slice(0, 500)
  };
}

export async function completeInterview(interviewId, userId, analytics) {
  const supabase = getSupabaseAdmin();
  const statusRow = await updateInterviewStatus(interviewId, userId, "COMPLETED");
  if (!statusRow) return null;
  const interview = await loadInterviewBundle(supabase, interviewId, userId);
  if (!interview) return null;

  const visualAnalysis = sanitizeVisualAnalysis(analytics.visualAnalysis);
  const feedbackPayload =
    analytics.perQuestionFeedback && typeof analytics.perQuestionFeedback === "object"
      ? {
          ...analytics.perQuestionFeedback,
          visualAnalysis,
          voiceAvailable: analytics.voiceAvailable !== false
        }
      : {
          version: 1,
          questions: Array.isArray(analytics.perQuestionFeedback) ? analytics.perQuestionFeedback : [],
          visualAnalysis,
          voiceAvailable: analytics.voiceAvailable !== false
        };

  const payload = {
    interview_id: interviewId,
    user_id: userId,
    overall_score: analytics.overallScore,
    confidence_score: analytics.confidenceScore,
    communication_score: analytics.communicationScore,
    technical_score: analytics.technicalScore,
    problem_solving_score: analytics.problemSolvingScore,
    pass_fail: analytics.passFail,
    grade: analytics.grade,
    strengths: analytics.strengths,
    weaknesses: analytics.weaknesses,
    improvements: analytics.improvements,
    summary: analytics.summary,
    per_question_feedback: feedbackPayload,
    visual_analysis: visualAnalysis
  };

  let { data: resultRow, error } = await supabase
    .from("interview_results")
    .upsert(payload, { onConflict: "interview_id" })
    .select("*")
    .single();
  if (error && /visual_analysis/i.test(String(error.message || ""))) {
    const fallback = { ...payload };
    delete fallback.visual_analysis;
    const retry = await supabase
      .from("interview_results")
      .upsert(fallback, { onConflict: "interview_id" })
      .select("*")
      .single();
    resultRow = retry.data;
    error = retry.error;
    if (!error && analytics.visualAnalysis) {
      console.warn("visual_analysis column is missing; run the latest supabase/schema.sql to persist camera analysis.");
    }
  }
  if (error || !resultRow) fail(error, "Could not save interview result");

  return {
    interview,
    result: mapResult(resultRow)
  };
}

export async function deleteInterview(interviewId, userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("interviews")
    .delete()
    .eq("id", interviewId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) fail(error, "Could not delete interview");
  return Boolean(data);
}

export async function listResults({ userId, page = 0, size = 10 }) {
  const supabase = getSupabaseAdmin();
  const from = page * size;
  const to = from + size - 1;
  const { data, error } = await supabase
    .from("interview_results")
    .select("id, interview_id, user_id, overall_score, confidence_score, communication_score, technical_score, problem_solving_score, pass_fail, grade, strengths, weaknesses, improvements, summary, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) fail(error, "Could not load results");
  return (data || []).map(mapResult);
}

export async function getLatestResultForUser(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("interview_results")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail(error, "Could not load result");
  return mapResult(data);
}

export async function getResultForInterview(interviewId, userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("interview_results")
    .select("*")
    .eq("interview_id", interviewId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail(error, "Could not load result");
  return mapResult(data);
}
