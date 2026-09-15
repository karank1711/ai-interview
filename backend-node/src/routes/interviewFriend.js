import { Router } from "express";
import { synthesizeInterviewerSpeech, isTtsProviderFailure } from "../services/interviewerTts.js";
import { sendTtsAudio } from "../services/ttsAudio.js";
import { FRIEND_LIMITS, replyAsInterviewFriend, sanitizeFriendSpeechText } from "../services/interviewFriend.js";
import {
  createFriendConversation,
  getFriendConversation,
  listFriendConversations,
  updateFriendConversation,
} from "../services/friendConversationStore.js";

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const MAX_BODY_CHARS = 12000;
const MAX_TTS_CHARS = 900;

function abortSignalFromRequest(req, res) {
  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) controller.abort();
  };
  req.on("aborted", abort);
  res.on("close", () => {
    if (!res.writableEnded) abort();
  });
  return controller.signal;
}

function firstNameFromUser(user) {
  const raw = String(user?.name || user?.fullName || "").trim();
  if (raw) return raw.split(/\s+/)[0];
  const email = String(user?.email || "");
  return email.includes("@") ? email.split("@")[0] : "";
}

function bodyTooLarge(req) {
  try {
    return JSON.stringify(req.body || {}).length > MAX_BODY_CHARS;
  } catch {
    return true;
  }
}

router.get("/conversations", asyncHandler(async (req, res) => {
  const data = await listFriendConversations(req.user.id);
  return res.json({ success: true, data });
}));

router.post("/conversations", asyncHandler(async (req, res) => {
  const data = await createFriendConversation(req.user.id, req.body || {});
  return res.json({ success: true, data });
}));

router.get("/conversations/:id", asyncHandler(async (req, res) => {
  const data = await getFriendConversation(req.params.id, req.user.id);
  if (!data) return res.status(404).json({ success: false, message: "Conversation not found." });
  return res.json({ success: true, data });
}));

router.put("/conversations/:id", asyncHandler(async (req, res) => {
  const data = await updateFriendConversation(req.params.id, req.user.id, req.body || {});
  if (!data) return res.status(404).json({ success: false, message: "Conversation not found." });
  return res.json({ success: true, data });
}));

router.post("/message", asyncHandler(async (req, res) => {
  if (bodyTooLarge(req)) {
    return res.status(413).json({ success: false, message: "That request is too large. Shorten the message and try again." });
  }
  const message = String(req.body?.message || "");
  if (!message.trim()) {
    return res.status(400).json({ success: false, message: "Please enter a question or message." });
  }
  if (message.length > FRIEND_LIMITS.MAX_MESSAGE_CHARS) {
    return res.status(400).json({
      success: false,
      message: `Please keep your message under ${FRIEND_LIMITS.MAX_MESSAGE_CHARS} characters.`,
    });
  }

  try {
    const data = await replyAsInterviewFriend({
      userId: req.user.id,
      firstName: firstNameFromUser(req.user),
      message,
      conversationContext: req.body?.conversationContext,
      mode: req.body?.mode,
      includeReportContext: req.body?.includeReportContext === true,
      lastVideo: req.body?.lastVideo,
      excludeVideoIds: req.body?.excludeVideoIds,
      videoQuery: req.body?.videoQuery,
      signal: abortSignalFromRequest(req, res),
    });
    return res.json(data);
  } catch (error) {
    if (error?.name === "AbortError") {
      return res.status(499).json({ success: false, message: "Request cancelled." });
    }
    const status = error.statusCode || 502;
    console.error("[INTERVIEW-FRIEND]", { status, message: String(error.message || "").slice(0, 160) });
    return res.status(status).json({
      success: false,
      message: error.message || "Interview Friend could not answer right now. Please try again.",
    });
  }
}));

router.post("/tts", asyncHandler(async (req, res) => {
  const text = sanitizeFriendSpeechText("", req.body?.text).slice(0, MAX_TTS_CHARS);
  if (!text) {
    return res.status(400).json({ success: false, message: "Speech text is required." });
  }
  try {
    const audio = await synthesizeInterviewerSpeech(text, { signal: abortSignalFromRequest(req, res) });
    return sendTtsAudio(res, audio);
  } catch (error) {
    const status = error.statusCode || 502;
    const quota = error.code === "TTS_UNAVAILABLE" || isTtsProviderFailure(status, error.message);
    console.error("[INTERVIEW-FRIEND-TTS]", { status, code: error.code || "" });
    return res.status(quota ? 429 : status).json({
      success: false,
      textOnly: true,
      voiceAvailable: false,
      audioError: true,
      message: "Audio is temporarily unavailable. You can still read the response.",
    });
  }
}));

export default router;
