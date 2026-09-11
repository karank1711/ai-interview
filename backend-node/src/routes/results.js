import { Router } from "express";
import { getResultForInterview, isUuid, listResults } from "../services/interviewStore.js";

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get("/history", asyncHandler(async (req, res) => {
  const started = Date.now();
  const page = Number(req.query.page || 0);
  const size = Number(req.query.size || 10);
  const results = await listResults({
    userId: req.user.id,
    page,
    size
  });
  if (process.env.NODE_ENV !== "production") {
    console.log(`[PERF] results/history db ${Date.now() - started}ms size=${size}`);
  }
  return res.json({ success: true, data: results });
}));

router.get("/:interviewId", asyncHandler(async (req, res) => {
  if (!isUuid(req.params.interviewId)) {
    return res.status(400).json({ success: false, message: "Invalid interview id" });
  }
  const result = await getResultForInterview(req.params.interviewId, req.user.id);
  if (!result) return res.status(404).json({ success: false, message: "Result not found" });
  return res.json({ success: true, data: result });
}));

export default router;
