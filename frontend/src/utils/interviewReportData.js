export const EVALUATION_LABELS = {
  correct: "Correct",
  partially_correct: "Partially Correct",
  incorrect: "Incorrect",
  unanswered: "Unanswered",
  ungraded: "Not auto-graded",
  insufficient: "Unanswered",
  captured: "Unanswered",
};

const GRADE_KEYS = new Set(["correct", "partially_correct", "incorrect", "unanswered", "ungraded"]);
const SCORED_KEYS = new Set(["correct", "partially_correct", "incorrect"]);

export function evaluationLabel(value) {
  const key = String(value || "unanswered").toLowerCase();
  return EVALUATION_LABELS[key] || value || "Unanswered";
}

export function isScoredEvaluation(value) {
  return SCORED_KEYS.has(String(value || "").toLowerCase());
}

export function resultBadgeClass(value) {
  const key = String(value || "").toLowerCase();
  if (key === "correct") return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
  if (key === "partially_correct") return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200";
  if (key === "incorrect") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  if (key === "ungraded") return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
}

const FILLERS = /^(um+|uh+|er+|ah+|like|yeah|okay|ok|hmm+)$/i;

function clampHint(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function transcriptCommunicationHint(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const fillers = words.filter((word) => FILLERS.test(word)).length;
  const fillerRatio = fillers / words.length;
  const lengthScore = words.length >= 50 ? 82 : words.length >= 24 ? 68 : words.length >= 12 ? 52 : 28;
  const fillerScore = clampHint(100 - fillerRatio * 280);
  return clampHint(lengthScore * 0.65 + fillerScore * 0.35);
}

export function parseEvalFeedback(feedback) {
  const text = String(feedback || '').trim();
  const match = text.match(/^(correct|partially_correct|incorrect|unanswered|ungraded):\s*([\s\S]*)$/i);
  if (!match) {
    return {
      evaluation: '',
      feedback: text,
      mistake: '',
      idealAnswer: '',
      communicationScore: null,
      technicalScore: null,
      problemSolvingApplicable: false,
      problemSolvingScore: null,
    };
  }
  const evaluation = match[1].toLowerCase();
  const rest = match[2].trim();
  if (rest.startsWith('{')) {
    try {
      const parsed = JSON.parse(rest);
      return {
        evaluation,
        feedback: String(parsed.feedback || ''),
        mistake: String(parsed.mistake || ''),
        idealAnswer: String(parsed.idealAnswer || parsed.ideal_answer || ''),
        communicationScore: Number.isFinite(Number(parsed.communicationScore))
          ? Number(parsed.communicationScore)
          : null,
        technicalScore: Number.isFinite(Number(parsed.technicalScore)) ? Number(parsed.technicalScore) : null,
        problemSolvingApplicable: parsed.problemSolvingApplicable === true,
        problemSolvingScore: Number.isFinite(Number(parsed.problemSolvingScore))
          ? Number(parsed.problemSolvingScore)
          : null,
      };
    } catch {
      /* plain */
    }
  }
  return {
    evaluation,
    feedback: rest,
    mistake: '',
    idealAnswer: '',
    communicationScore: null,
    technicalScore: null,
    problemSolvingApplicable: false,
    problemSolvingScore: null,
  };
}

function fillReviewContent(row) {
  const answer = String(row.candidateAnswer || '').trim();
  const evaluation = normalizeEvaluation(row.evaluation, {
    answerText: answer,
    feedback: row.feedback,
  });
  const parsed = parseEvalFeedback(row.feedback);
  const feedback = String(row.feedback || parsed.feedback || '').trim();
  let mistake = String(row.mistake || parsed.mistake || '').trim();
  let idealAnswer = String(row.idealAnswer || parsed.idealAnswer || '').trim();
  let communicationScore = row.communicationScore;
  if (!Number.isFinite(Number(communicationScore))) communicationScore = parsed.communicationScore;
  if (!Number.isFinite(Number(communicationScore))) {
    communicationScore = answer ? transcriptCommunicationHint(answer) : 0;
  }
  if (!mistake) {
    if (!answer) mistake = 'No spoken answer was submitted.';
    else if (evaluation === 'correct') mistake = 'No significant mistakes or missing points were identified.';
    else if (evaluation === 'partially_correct') {
      mistake = feedback || 'The answer addressed the question only in part and left out important details.';
    } else if (evaluation === 'incorrect') {
      mistake = feedback || 'The answer did not correctly cover the required points of the question.';
    } else {
      mistake = feedback || 'Grading details were limited for this captured answer.';
    }
  }
  if (!idealAnswer) {
    const question = String(row.question || '').trim();
    idealAnswer = question
      ? `A complete answer should directly address this question with a clear explanation of the key points it asks for: ${question}`
      : 'A complete spoken answer covering the main points of the question.';
  }
  return {
    ...row,
    evaluation,
    resultLabel: evaluationLabel(evaluation),
    mistake,
    idealAnswer,
    feedback: feedback || row.feedback || '',
    communicationScore,
    scored: isScoredEvaluation(evaluation),
    technicalScore: Number.isFinite(Number(row.technicalScore))
      ? Number(row.technicalScore)
      : parsed.technicalScore,
    problemSolvingApplicable: row.problemSolvingApplicable === true || parsed.problemSolvingApplicable === true,
    problemSolvingScore: Number.isFinite(Number(row.problemSolvingScore))
      ? Number(row.problemSolvingScore)
      : parsed.problemSolvingScore,
  };
}

function lastAnswerMap(answers) {
  const map = new Map();
  for (const item of answers || []) {
    map.set(String(item.questionId), item);
  }
  return map;
}

function evaluationFromFeedback(feedback) {
  const match = String(feedback || "").match(
    /^(correct|partially_correct|incorrect|unanswered|ungraded)\b/i
  );
  return match ? match[1].toLowerCase() : "";
}

export function normalizeEvaluation(raw, { answerText = "", feedback = "" } = {}) {
  let key = String(raw || "").toLowerCase();
  if (key === "captured" || key === "insufficient") key = "";
  const fromFeedback = evaluationFromFeedback(feedback);
  if (!GRADE_KEYS.has(key) && fromFeedback) key = fromFeedback;
  if (GRADE_KEYS.has(key)) {
    if (!String(answerText || "").trim() && key !== "unanswered") return "unanswered";
    return key;
  }
  return String(answerText || "").trim() ? "ungraded" : "unanswered";
}

function mapReviewRow(extra, index) {
  const parsed = parseEvalFeedback(extra.feedback);
  const candidateAnswer = extra.candidateAnswer || extra.answer || '';
  const evaluation = normalizeEvaluation(extra.evaluation || parsed.evaluation, {
    answerText: candidateAnswer,
    feedback: extra.feedback,
  });
  const scored = isScoredEvaluation(evaluation);
  return fillReviewContent({
    questionNumber: extra.questionNumber || index + 1,
    questionId: extra.questionId,
    question: extra.question || `Question ${index + 1}`,
    candidateAnswer,
    evaluation,
    resultLabel: evaluationLabel(evaluation),
    score: scored ? Number(extra.score) || 0 : null,
    maxScore: Number(extra.maxScore) > 0 ? Number(extra.maxScore) : 100,
    scored,
    communicationScore: extra.communicationScore ?? parsed.communicationScore,
    technicalScore: extra.technicalScore ?? parsed.technicalScore,
    problemSolvingApplicable: extra.problemSolvingApplicable === true || parsed.problemSolvingApplicable === true,
    problemSolvingScore: extra.problemSolvingScore ?? parsed.problemSolvingScore,
    mistake: extra.mistake || parsed.mistake || '',
    idealAnswer: extra.idealAnswer || extra.ideal_answer || parsed.idealAnswer || '',
    feedback: parsed.feedback || extra.feedback || '',
  });
}

export function getQuestionReviewRows(results, interview) {
  if (Array.isArray(results?.perQuestionFeedback) && results.perQuestionFeedback.length) {
    return results.perQuestionFeedback.map(mapReviewRow);
  }

  const answers = lastAnswerMap(interview?.answers);
  if (!answers.size) return [];
  const questions = interview?.questions || [];
  const rows = questions
    .map((question, index) => {
      const saved = answers.get(String(question.id));
      if (!saved) return null;
      return mapReviewRow(
        {
          questionNumber: index + 1,
          questionId: question.id,
          question: question.questionText,
          candidateAnswer: saved.answer || '',
          evaluation: saved.evaluation,
          score: saved.score,
          maxScore: 100,
          communicationScore: saved.communicationScore,
          technicalScore: saved.technicalScore,
          problemSolvingApplicable: saved.problemSolvingApplicable,
          problemSolvingScore: saved.problemSolvingScore,
          mistake: saved.mistake,
          idealAnswer: saved.idealAnswer,
          feedback: saved.feedback,
        },
        index
      );
    })
    .filter(Boolean);
  const seen = new Set(rows.map((row) => String(row.questionId)));
  answers.forEach((saved, questionId) => {
    if (seen.has(String(questionId))) return;
    rows.push(
      mapReviewRow(
        {
          questionNumber: rows.length + 1,
          questionId,
          question: saved.question || `Question ${rows.length + 1}`,
          candidateAnswer: saved.answer || '',
          evaluation: saved.evaluation,
          score: saved.score,
          maxScore: 100,
          feedback: saved.feedback,
        },
        rows.length
      )
    );
  });
  return rows;
}

function feedbackCopy({
  questionsAsked,
  questionsAnswered,
  correct,
  partiallyCorrect,
  incorrect,
  unanswered,
  ungraded,
}) {
  const gradedCount = correct + partiallyCorrect + incorrect;
  return {
    strengths:
      gradedCount === 0
        ? questionsAnswered === 0
          ? "No spoken answers were submitted."
          : "Spoken answers were captured, but automatic grading was not available for this session."
        : correct > 0
          ? `${correct} answer(s) graded correct.`
          : `${gradedCount} answer(s) were graded.`,
    weaknesses:
      questionsAnswered === 0
        ? questionsAsked === 0
          ? "The interview ended before a question was asked."
          : questionsAsked === 1
          ? "No spoken answer was submitted because the interview was ended after the first question."
          : `No spoken answers were submitted for the ${questionsAsked} question(s) that were asked.`
        : gradedCount === 0
          ? "Automatic grades were not saved. The captured transcripts are available in the question review."
          : unanswered > 0 || incorrect > 0
            ? `${incorrect} incorrect and ${unanswered} unanswered question(s) among the ${questionsAsked} asked.`
            : "Keep adding more technical depth where answers were only partially correct.",
    improvements:
      questionsAnswered === 0
        ? "Stay in the interview and give a complete spoken answer before ending."
        : gradedCount === 0
          ? "Review the captured answers below. Overall score will appear when automatic grading succeeds."
          : unanswered > 0
            ? "Answer every asked question with a complete spoken explanation."
            : "Tighten structure and cover missing points noted per question.",
    ungraded,
  };
}

function averageScore(values) {
  const nums = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return Math.round(nums.reduce((sum, value) => sum + value, 0) / nums.length);
}

export function summarizeQuestionRows(rows) {
  const items = Array.isArray(rows) ? rows : [];
  let correct = 0;
  let partiallyCorrect = 0;
  let incorrect = 0;
  let unanswered = 0;
  let ungraded = 0;
  let totalMarks = 0;
  let maxMarks = 0;
  const communicationScores = [];
  const technicalScores = [];
  const problemSolvingScores = [];
  items.forEach((row) => {
    const answerText = String(row.candidateAnswer || "").trim();
    const key = normalizeEvaluation(row.evaluation, {
      answerText,
      feedback: row.feedback,
    });
    if (!answerText) {
      unanswered += 1;
      return;
    }
    if (Number.isFinite(Number(row.communicationScore))) {
      communicationScores.push(Number(row.communicationScore));
    } else {
      communicationScores.push(transcriptCommunicationHint(answerText));
    }
    if (key === "correct" || key === "partially_correct" || key === "incorrect") {
      if (key === "correct") correct += 1;
      else if (key === "partially_correct") partiallyCorrect += 1;
      else incorrect += 1;
      const maxScore = Number(row.maxScore) > 0 ? Number(row.maxScore) : 100;
      maxMarks += maxScore;
      totalMarks += Number(row.score) || 0;
      if (Number.isFinite(Number(row.technicalScore))) technicalScores.push(Number(row.technicalScore));
      else technicalScores.push(Number(row.score) || 0);
      if (row.problemSolvingApplicable === true && Number.isFinite(Number(row.problemSolvingScore))) {
        problemSolvingScores.push(Number(row.problemSolvingScore));
      }
      return;
    }
    ungraded += 1;
  });
  const questionsAsked = items.length;
  const questionsAnswered = questionsAsked - unanswered;
  const gradedCount = correct + partiallyCorrect + incorrect;
  const hasAnswerGrading = gradedCount > 0;
  const accuracyPercent = hasAnswerGrading && maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : null;
  const technicalScore = averageScore(technicalScores);
  const problemSolvingScore = averageScore(problemSolvingScores);
  return {
    questionsAsked,
    questionsAnswered,
    correct,
    partiallyCorrect,
    incorrect,
    unanswered,
    ungraded,
    gradedCount,
    hasAnswerGrading,
    totalMarks: hasAnswerGrading ? totalMarks : null,
    maxMarks: hasAnswerGrading ? maxMarks : null,
    accuracyPercent,
    overallScore: accuracyPercent,
    communicationScore: averageScore(communicationScores),
    technicalScore,
    problemSolvingScore,
    hasTechnical: hasAnswerGrading && technicalScore != null,
    hasProblemSolving: problemSolvingScores.length > 0,
    ...feedbackCopy({
      questionsAsked,
      questionsAnswered,
      correct,
      partiallyCorrect,
      incorrect,
      unanswered,
      ungraded,
    }),
  };
}

export function getInterviewSummary(results, interview) {
  const rows = getQuestionReviewRows(results, interview);
  const computed = summarizeQuestionRows(rows);
  const storedCommunication = Number(results?.communicationScore);
  return {
    ...computed,
    communicationScore:
      computed.communicationScore != null
        ? computed.communicationScore
        : Number.isFinite(storedCommunication) && storedCommunication > 0
          ? storedCommunication
          : computed.communicationScore,
    confidenceScore: results?.confidenceScore,
    hasVisualConfidence: results?.interviewSummary?.hasVisualConfidence,
    endedEarly: results?.endReason === "ENDED_EARLY" || results?.interviewSummary?.endedEarly,
  };
}

export function visualMetricPercent(visual, ...keys) {
  if (!visual) return null;
  for (const key of keys) {
    const parts = key.split(".");
    let value = visual;
    for (const part of parts) value = value?.[part];
    if (value != null && value !== "") return value;
  }
  return null;
}
