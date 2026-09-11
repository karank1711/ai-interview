function clamp(value, min = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function gradeFromScore(score) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export const EVALUATION_LABELS = {
  correct: "Correct",
  partially_correct: "Partially Correct",
  incorrect: "Incorrect",
  unanswered: "Unanswered",
  ungraded: "Not auto-graded"
};

export const SKILL_WEIGHTS = {
  technical: 0.35,
  communication: 0.25,
  problemSolving: 0.25,
  confidence: 0.15
};

const FILLERS = /^(um+|uh+|er+|ah+|like|yeah|okay|ok|hmm+)$/i;

export function transcriptCommunicationHint(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const fillers = words.filter((word) => FILLERS.test(word)).length;
  const fillerRatio = fillers / words.length;
  const lengthScore = words.length >= 50 ? 82 : words.length >= 24 ? 68 : words.length >= 12 ? 52 : 28;
  const fillerScore = clamp(100 - fillerRatio * 280);
  return clamp(lengthScore * 0.65 + fillerScore * 0.35);
}

const GRADE_KEYS = /^(correct|partially_correct|incorrect|unanswered|ungraded)$/i;

export function encodeAnswerFeedback(grade = {}) {
  const evaluation = String(grade.evaluation || "ungraded").toLowerCase();
  const payload = {
    feedback: String(grade.feedback || ""),
    mistake: String(grade.mistake || ""),
    idealAnswer: String(grade.idealAnswer || grade.ideal_answer || ""),
    communicationScore: Number.isFinite(Number(grade.communicationScore))
      ? Number(grade.communicationScore)
      : null,
    technicalScore: Number.isFinite(Number(grade.technicalScore)) ? Number(grade.technicalScore) : null,
    problemSolvingApplicable: grade.problemSolvingApplicable === true,
    problemSolvingScore: Number.isFinite(Number(grade.problemSolvingScore))
      ? Number(grade.problemSolvingScore)
      : null
  };
  return `${evaluation}:${JSON.stringify(payload)}`;
}

export function decodeAnswerFeedback(raw) {
  const text = String(raw || "").trim();
  const match = text.match(/^(correct|partially_correct|incorrect|unanswered|ungraded):\s*([\s\S]*)$/i);
  if (!match) {
    return {
      evaluation: "",
      feedback: text,
      mistake: "",
      idealAnswer: "",
      communicationScore: null,
      technicalScore: null,
      problemSolvingApplicable: false,
      problemSolvingScore: null,
      hasDetails: false
    };
  }
  const evaluation = match[1].toLowerCase();
  const rest = match[2].trim();
  if (rest.startsWith("{")) {
    try {
      const parsed = JSON.parse(rest);
      return {
        evaluation,
        feedback: String(parsed.feedback || ""),
        mistake: String(parsed.mistake || ""),
        idealAnswer: String(parsed.idealAnswer || parsed.ideal_answer || ""),
        communicationScore: Number.isFinite(Number(parsed.communicationScore))
          ? Number(parsed.communicationScore)
          : null,
        technicalScore: Number.isFinite(Number(parsed.technicalScore)) ? Number(parsed.technicalScore) : null,
        problemSolvingApplicable: parsed.problemSolvingApplicable === true,
        problemSolvingScore: Number.isFinite(Number(parsed.problemSolvingScore))
          ? Number(parsed.problemSolvingScore)
          : null,
        hasDetails: true
      };
    } catch {
      /* plain feedback */
    }
  }
  return {
    evaluation,
    feedback: rest,
    mistake: "",
    idealAnswer: "",
    communicationScore: null,
    technicalScore: null,
    problemSolvingApplicable: false,
    problemSolvingScore: null,
    hasDetails: false
  };
}

export function hasStoredGradeDetails(feedback) {
  const decoded = decodeAnswerFeedback(feedback);
  return Boolean(
    decoded.hasDetails &&
      decoded.evaluation &&
      GRADE_KEYS.test(decoded.evaluation)
  );
}

function average(values) {
  const nums = values.filter((value) => Number.isFinite(Number(value)));
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + Number(value), 0) / nums.length;
}

export function visualConfidenceScore(visual) {
  if (!visual || typeof visual !== "object") return null;
  const available = visual.available === true || Number(visual.sampleCount) > 0 || Number(visual.faceSamples) > 0;
  if (!available) return null;
  const attention = Number(
    visual.attentionTowardCameraPercent ?? visual.engagement?.facingCameraPercent ?? 0
  );
  const face = Number(visual.faceVisiblePercent ?? 0);
  const lookingAway = Number(
    visual.lookingAwayPercent ??
      visual.engagement?.lookingAwayPercent ??
      Math.max(0, 100 - attention)
  );
  const composure = Number(visual.visualConfidenceIndicator);
  const head = String(visual.headStability || visual.engagement?.headMovement || "");
  let headScore = 62;
  if (/low|stable|still/i.test(head)) headScore = 82;
  else if (/high|large|erratic/i.test(head)) headScore = 42;
  const offEvents = Number(visual.offScreenEvents || 0);
  const missing = Number(visual.faceMissingEvents || 0);
  const eventPenalty = Math.min(28, offEvents * 3 + missing * 2);
  return clamp(
    attention * 0.34 +
      face * 0.18 +
      (100 - lookingAway) * 0.16 +
      (Number.isFinite(composure) ? composure : 55) * 0.18 +
      headScore * 0.14 -
      eventPenalty
  );
}

function weightedOverall({ technical, communication, problemSolving, confidence, hasConfidence, hasProblemSolving }) {
  let weights = { ...SKILL_WEIGHTS };
  if (!hasProblemSolving) {
    const extra = weights.problemSolving;
    weights.problemSolving = 0;
    weights.technical += extra * 0.6;
    weights.communication += extra * 0.4;
  }
  if (!hasConfidence) {
    const extra = weights.confidence;
    weights.confidence = 0;
    const rest = weights.technical + weights.communication + weights.problemSolving;
    if (rest > 0) {
      weights.technical += extra * (weights.technical / rest);
      weights.communication += extra * (weights.communication / rest);
      weights.problemSolving += extra * (weights.problemSolving / rest);
    }
  }
  const total =
    technical * weights.technical +
    communication * weights.communication +
    problemSolving * weights.problemSolving +
    (hasConfidence ? confidence * weights.confidence : 0);
  return clamp(total);
}

export function buildInterviewSummary(questions, visualAnalysis, meta = {}) {
  const items = Array.isArray(questions) ? questions : [];
  const questionsAsked = items.length;
  let correct = 0;
  let partiallyCorrect = 0;
  let incorrect = 0;
  let unanswered = 0;
  let totalMarks = 0;
  let maxMarks = 0;
  const communicationScores = [];
  const technicalScores = [];
  const problemSolvingScores = [];

  items.forEach((item) => {
    const answerText = String(item.candidateAnswer || item.answer || "").trim();
    const key = String(item.evaluation || "").toLowerCase();
    const maxScore = Number(item.maxScore) > 0 ? Number(item.maxScore) : 100;
    if (!answerText) unanswered += 1;
    else if (key === "correct") {
      correct += 1;
      maxMarks += maxScore;
      totalMarks += Number(item.score) || 0;
    } else if (key === "partially_correct") {
      partiallyCorrect += 1;
      maxMarks += maxScore;
      totalMarks += Number(item.score) || 0;
    } else if (key === "incorrect") {
      incorrect += 1;
      maxMarks += maxScore;
      totalMarks += Number(item.score) || 0;
    }

    communicationScores.push(
      Number.isFinite(Number(item.communicationScore))
        ? Number(item.communicationScore)
        : !answerText
          ? 0
          : transcriptCommunicationHint(answerText)
    );
    if (Number.isFinite(Number(item.technicalScore))) {
      technicalScores.push(Number(item.technicalScore));
    } else if (key === "correct" || key === "partially_correct" || key === "incorrect") {
      technicalScores.push(Number(item.score) || 0);
    }
    if (item.problemSolvingApplicable === true && Number.isFinite(Number(item.problemSolvingScore))) {
      problemSolvingScores.push(Number(item.problemSolvingScore));
    }
  });

  const questionsAnswered = questionsAsked - unanswered;
  const gradedCount = correct + partiallyCorrect + incorrect;
  const ungraded = Math.max(0, questionsAnswered - gradedCount);
  const hasAnswerGrading = gradedCount > 0;
  const accuracyPercent = hasAnswerGrading && maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : null;
  const communicationScore = clamp(average(communicationScores));
  const technicalScore = hasAnswerGrading ? clamp(average(technicalScores)) : 0;
  const hasProblemSolving = hasAnswerGrading && problemSolvingScores.length > 0;
  const problemSolvingScore = hasProblemSolving ? clamp(average(problemSolvingScores)) : 0;
  const confidenceRaw = visualConfidenceScore(visualAnalysis);
  const hasConfidence = confidenceRaw != null;
  const confidenceScore = hasConfidence ? confidenceRaw : 0;
  const overallScore = accuracyPercent == null ? 0 : accuracyPercent;

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
    totalMarks: hasAnswerGrading ? totalMarks : 0,
    maxMarks: hasAnswerGrading ? maxMarks : 0,
    accuracyPercent: accuracyPercent == null ? 0 : accuracyPercent,
    overallScore,
    passFail: hasAnswerGrading ? overallScore >= 55 : false,
    grade: hasAnswerGrading ? gradeFromScore(overallScore) : "N/A",
    communicationScore,
    technicalScore,
    problemSolvingScore,
    confidenceScore,
    skillWeights: SKILL_WEIGHTS,
    hasVisualConfidence: hasConfidence,
    hasProblemSolving,
    endedEarly: String(meta.endReason || "").toUpperCase() === "ENDED_EARLY",
    strengths:
      gradedCount === 0
        ? questionsAnswered === 0
          ? ""
          : "Spoken answers were captured. Automatic grading results were not available for this session."
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
          ? "Review the transcripts; automatic grades were not saved for these answers."
          : unanswered > 0 || incorrect > 0
            ? `${incorrect} incorrect and ${unanswered} unanswered question(s) among the ${questionsAsked} asked.`
            : "Keep adding more technical depth where answers were only partially correct.",
    improvements:
      questionsAnswered === 0
        ? "Stay in the interview and give a complete spoken answer before ending."
        : gradedCount === 0
          ? "Open the question review to read the captured answers."
          : unanswered > 0
            ? "Answer every asked question with a complete spoken explanation."
            : "Tighten structure and cover missing points noted per question."
  };
}

export function buildResultAnalytics(questions, visualAnalysis, meta = {}) {
  const summary = buildInterviewSummary(questions, visualAnalysis, meta);
  return {
    overallScore: summary.overallScore,
    confidenceScore: summary.confidenceScore,
    communicationScore: summary.communicationScore,
    technicalScore: summary.technicalScore,
    problemSolvingScore: summary.problemSolvingScore,
    passFail: summary.passFail,
    grade: summary.grade,
    strengths: summary.strengths,
    weaknesses: summary.weaknesses,
    improvements: summary.improvements,
    summary: `Questions asked ${summary.questionsAsked}, answered ${summary.questionsAnswered}, unanswered ${summary.unanswered}. Correct ${summary.correct}, partial ${summary.partiallyCorrect}, incorrect ${summary.incorrect}. Answer accuracy ${summary.totalMarks}/${summary.maxMarks} (${summary.accuracyPercent}%). Overall ${summary.overallScore}%.`,
    interviewSummary: summary
  };
}
