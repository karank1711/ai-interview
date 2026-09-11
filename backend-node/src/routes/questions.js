import { Router } from "express";
import {
  buildStoredQuestion,
  generateInterviewQuestion,
  plannedInterviewQuestionCount,
} from "../services/huggingfaceQuestions.js";
import { getInterviewForUser, isUuid } from "../services/interviewStore.js";

const router = Router();

router.get("/generate", async (req, res, next) => {
  try {
    const count = Math.max(1, Math.min(Number(req.query.count || 5) || 5, plannedInterviewQuestionCount()));
    const course = String(req.query.course || req.query.category || "BTECH").toUpperCase();
    const level = req.query.level || "INTERMEDIATE";
    const type = req.query.type || "TECHNICAL";
    const interviewId = req.query.interviewId;

    if (interviewId) {
      if (!isUuid(interviewId)) {
        return res.status(400).json({ success: false, message: "Invalid interview id" });
      }
      const interview = await getInterviewForUser(interviewId, req.user.id);
      if (interview?.questions?.length) {
        return res.json({ success: true, data: interview.questions });
      }
    }

    const questions = [];
    for (let index = 0; index < count; index += 1) {
      const questionText = await generateInterviewQuestion({
        course,
        level,
        type,
        questionNumber: index + 1,
        plannedCount: count,
        previousQuestions: questions.map((item) => item.questionText),
        previousQuestion: questions[questions.length - 1]?.questionText || "",
      });
      questions.push(buildStoredQuestion({ questionText, course, level, type }));
    }

    return res.json({ success: true, data: questions });
  } catch (error) {
    const status = error.statusCode || 502;
    return res.status(status).json({
      success: false,
      message: error.message || "Could not generate interview questions.",
    });
  }
});

export default router;
