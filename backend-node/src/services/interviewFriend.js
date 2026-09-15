import { completeHuggingFaceChat } from "./huggingfaceQuestions.js";
import { getLatestResultForUser } from "./interviewStore.js";
import { chunkTtsText } from "./groqTts.js";
import { detectTtsLanguage } from "./speechLanguage.js";
import { chunkHindiTtsText } from "./sarvamTts.js";
import { detectVideoSearchIntent, searchYoutubeVideos, composeYoutubeQuery, isGenericResourceTopic, isReferentialResourceRequest } from "./youtubeSearch.js";

const MAX_MESSAGE_CHARS = 2000;
const MAX_CONTEXT_TURNS = 8;
const MAX_CONTEXT_TURN_CHARS = 600;
const MAX_REPORT_CHARS = 1800;

const MODES = new Set(["explain", "practice", "communication", "analyze", "general"]);

const CURRENT_INFO_RE =
  /\b(latest|breaking news|today'?s|today\b|right now|current (price|weather|news|score|events?)|live score|stock price|weather (in|today)|who won|this (morning|evening|week)|as of (today|now))\b/i;

export function classifyInterviewFriendNeed({ message, includeReportContext, mode }) {
  const text = String(message || "");
  const wantsReport = includeReportContext === true || mode === "analyze";
  const videoIntent = detectVideoSearchIntent(text);
  const needsWebSearch = !videoIntent.wanted && CURRENT_INFO_RE.test(text);
  return { wantsReport, needsWebSearch, videoIntent };
}

export function normalizeFriendMode(mode) {
  const key = String(mode || "general").trim().toLowerCase();
  if (MODES.has(key)) return key;
  return "general";
}

function clip(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function clipMarkdown(value, max) {
  const text = String(value || "")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  return text.slice(0, max);
}

function pullJsonStringField(raw, key) {
  const match = String(raw || "").match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (!match) return "";
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1]
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"');
  }
}

function extractModelAnswer(rawText, fallbackAnswer) {
  const parsed = extractJsonObject(rawText);
  if (typeof parsed?.answer === "string" && parsed.answer.trim()) {
    return clipMarkdown(parsed.answer, 4000);
  }
  const pulled = pullJsonStringField(rawText, "answer");
  if (pulled.trim()) return clipMarkdown(pulled, 4000);
  const trimmed = String(rawText || "").trim();
  if (/^\s*\{/.test(trimmed) && /"(?:speechText|followUpQuestion|topic|answer)"\s*:/.test(trimmed)) {
    const fallback = String(fallbackAnswer || "").trim();
    if (fallback && !/^\s*\{/.test(fallback)) return clipMarkdown(fallback, 4000);
    return "";
  }
  return clipMarkdown(fallbackAnswer || rawText, 4000);
}

function emptyVideos() {
  return [];
}

export function sanitizeConversationContext(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-MAX_CONTEXT_TURNS)
    .map((turn) => ({
      role: turn?.role === "assistant" ? "assistant" : "user",
      content: clip(turn?.content, MAX_CONTEXT_TURN_CHARS),
    }))
    .filter((turn) => turn.content);
}

function extractJsonObject(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function sanitizeFriendSpeechText(answer, speechText) {
  const source = String(speechText || answer || "");
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\{[\s\S]*?\}/g, " ")
    .replace(/\[[\s\S]*?\]/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\\n/gi, " ")
    .replace(/\\+/g, " ")
    .replace(/[#*_`>~]/g, " ")
    .replace(/["]/g, " ")
    .replace(/[\\/<>{}[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

function toSpeechText(answer, speechText) {
  return sanitizeFriendSpeechText(answer, speechText);
}

export function matchCasualReply(message, firstName = "") {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 80) return null;
  const t = text.toLowerCase().replace(/[!.?,-]+/g, " ").replace(/\s+/g, " ").trim();
  const name = String(firstName || "").trim();
  const hi = name ? ` ${name}` : "";
  if (/^(thank you|thanks|thankyou|thx|ty|thanks a lot|thank you so much|shukriya|dhanyavad|dhanyavaad)$/.test(t)) {
    return {
      answer: "You're welcome! Let me know if you need anything else.",
      speechText: "You're welcome! Let me know if you need anything else.",
    };
  }
  if (/^(hello|hi|hey|hiya|namaste|namaskar)$/.test(t) || /^(hello|hi|hey|namaste)( there)?$/.test(t)) {
    return {
      answer: name ? `Hi ${name}! How can I help you?` : "Hi! How can I help you?",
      speechText: name ? `Hi ${name}! How can I help you?` : "Hi! How can I help you?",
    };
  }
  if (/^(how are you|how r you|how are u|kaise ho|kya haal hai)$/.test(t)) {
    return {
      answer: name
        ? `I'm doing well, ${name}. Thanks for asking! How can I help you today?`
        : "I'm doing well, thanks for asking! How can I help you today?",
      speechText: name
        ? `I'm doing well, ${name}. Thanks for asking! How can I help you today?`
        : "I'm doing well, thanks for asking! How can I help you today?",
    };
  }
  if (/^(ok|okay|k|kk|alright|sure)$/.test(t)) {
    return { answer: "Okay. What would you like to do next?", speechText: "Okay. What would you like to do next?" };
  }
  if (/^(great|nice|cool|awesome|good)$/.test(t)) {
    return { answer: "Glad to hear that. I'm here if you want to learn more.", speechText: "Glad to hear that. I'm here if you want to learn more." };
  }
  if (/^(bye|goodbye|see you|see ya|good night|goodnight|alvida)$/.test(t)) {
    return {
      answer: name ? `Bye${hi}! Come back anytime if you want to practice.` : "Bye! Come back anytime if you want to practice.",
      speechText: name ? `Bye${hi}! Come back anytime if you want to practice.` : "Bye! Come back anytime if you want to practice.",
    };
  }
  return null;
}

function resourceIntro(intent, count) {
  const topic = String(intent.topic || "")
    .replace(/\b(playlist|channel|tutorial|complete|hindi|english)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || "this topic";
  const lang = intent.language === "hi" ? "Hindi" : intent.language === "en" ? "English" : "";
  const beginnerScratch = intent.difficulty === "beginner" || /\bfrom scratch\b/i.test(topic);
  const diff = beginnerScratch ? "beginner-friendly " : intent.difficulty === "advanced" ? "advanced " : "";
  const langBit = lang ? `${lang} ` : "";
  if (intent.kind === "playlist") {
    if (!count) {
      const text = `I could not find a matching playlist for ${topic}.`;
      return { answer: text, speechText: text };
    }
    const teaches = /\bfrom scratch\b/i.test(topic)
      ? `that teaches ${topic}`
      : `for ${topic}`;
    const text = count === 1
      ? `I found a ${diff}${langBit}playlist ${teaches}.`
      : `Here are ${count} ${diff}${langBit}playlists ${teaches}.`;
    return { answer: text.replace(/\s+/g, " ").trim(), speechText: text.replace(/\s+/g, " ").trim() };
  }
  const kindLabel = intent.kind === "channel" ? "channels" : "videos";
  if (!count) {
    return {
      answer: `I could not find matching ${kindLabel} for ${topic}. Try a slightly different topic.`,
      speechText: `I could not find matching ${kindLabel} for ${topic}.`,
    };
  }
  if (count === 1) {
    const text = `Here is a good ${langBit}resource for ${topic}.`;
    return { answer: text, speechText: text };
  }
  const text = `Here are ${count} good ${langBit}resources for ${topic}.`;
  return { answer: text, speechText: text };
}

function toVideoList(videos) {
  return Array.isArray(videos) ? videos.slice(0, 3) : emptyVideos();
}

const TOPIC_PREFIXES = ["javascript", "typescript", "python", "java", "react", "node", "html", "css", "sql"];

function topicFromUserUtterance(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const intent = detectVideoSearchIntent(raw);
  if (intent.wanted) {
    if (intent.uncertain || intent.referential || isGenericResourceTopic(intent.topic) || isReferentialResourceRequest(raw)) {
      return "";
    }
    return clip(intent.topic, 80);
  }
  let t = raw
    .replace(/^(please\s+)?((can|could|would)\s+you\s+)?/i, "")
    .replace(/^(explain|describe|teach me|teach|define|what are|what is|what's|whats|tell me about|help me (with|understand)|how does|how do)\s+/i, "")
    .replace(/\s+(please|in simple (terms|language)|simply|briefly)\s*/gi, " ")
    .replace(/[?.!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.length > 80) return "";
  if (isGenericResourceTopic(t)) return "";
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|yes|no)$/i.test(t)) return "";
  return t;
}

function topicFromAssistant(text) {
  const source = String(text || "").replace(/```[\s\S]*?```/g, " ").trim();
  const lines = source
    .split(/\n/)
    .map((line) => line.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean);
  const heading = lines.find((line) => (
    line.length > 2
    && line.length <= 72
    && !/[.!?]$/.test(line)
    && !/^(here is|here are|i found|i cannot|i do not)/i.test(line)
  ));
  if (heading && !isGenericResourceTopic(heading)) return heading.slice(0, 80);
  return "";
}

function enrichTopicWithAssistant(topic, assistantText) {
  let next = String(topic || "").trim();
  const hay = String(assistantText || "");
  if (!next) return topicFromAssistant(hay);
  for (const prefix of TOPIC_PREFIXES) {
    if (new RegExp(`\\b${prefix}\\b`, "i").test(hay) && !new RegExp(`\\b${prefix}\\b`, "i").test(next)) {
      next = `${prefix} ${next}`;
      break;
    }
  }
  return next;
}

function resolveDiscussedTopic(conversationContext, savedQuery) {
  const turns = Array.isArray(conversationContext) ? conversationContext : [];
  let userTopic = "";
  let lastAssistant = "";
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (!userTopic && turn?.role === "user") {
      userTopic = topicFromUserUtterance(turn.content);
    }
    if (!lastAssistant && turn?.role === "assistant") {
      lastAssistant = String(turn.content || "");
    }
    if (userTopic && lastAssistant) break;
  }
  const enriched = enrichTopicWithAssistant(userTopic, lastAssistant);
  if (enriched && !isGenericResourceTopic(enriched)) return clip(enriched, 80);
  const saved = String(savedQuery || "").replace(/\s+/g, " ").trim();
  if (saved && !isGenericResourceTopic(saved)) return clip(saved, 80);
  return "";
}

function resolveVideoSearch({ message, videoIntent, conversationContext, videoQuery }) {
  const discussed = resolveDiscussedTopic(conversationContext, videoQuery);
  const explicit = String(videoIntent.topic || "").trim();
  const useDiscussed = videoIntent.referential || videoIntent.uncertain || isReferentialResourceRequest(message) || isGenericResourceTopic(explicit) || !videoIntent.query;
  const topic = (!useDiscussed && explicit) ? explicit : (discussed || explicit);
  const query = composeYoutubeQuery(topic, videoIntent, videoIntent.kind || "video") || (!useDiscussed ? String(videoIntent.query || "").trim() : "");
  return {
    topic: isGenericResourceTopic(topic) ? "" : topic,
    query,
  };
}

function buildSystemPrompt(mode, { videoSearch = false, lastVideo = null } = {}) {
  const modeGuide = {
    explain:
      "Mode: Explain a topic. Use simple language, one short example, and a brief follow-up question.",
    practice:
      "Mode: Practice interview. Ask exactly one interview question at a time. If the user just answered, give concise feedback then ask the next question.",
    communication:
      "Mode: Improve communication. Coach on structure, clarity, conciseness, STAR answers, and confident delivery.",
    analyze:
      "Mode: Analyze last interview. Use only the provided report context. Give personalized coaching, one practice question, and a short improvement plan.",
    general:
      "Mode: General companion. Answer the user's question helpfully, including random non-interview topics when asked.",
  }[mode];

  return `You are Interview Friend, a personal AI learning companion inside InterviewIQ.
Be helpful, conversational, and beginner-friendly.
If the user greets you (hello, hi, how are you), reply warmly and briefly, then offer help. Do not force a practice mode.
If they say they did not understand or ask to explain again, re-explain the previous topic from conversation context in simpler language with one example.
Answer random general questions. Explain step by step when useful. Give one clear example for technical topics.
Keep answers reasonably short. Prefer structured formatting: short headings, bullets, or numbered steps.
For code, use a fenced code block.
Ask one useful follow-up question when it helps the conversation.
Be honest when you are uncertain. Do not invent live facts.
Never claim you searched the web unless a real search was performed.
Do not present dangerous, medical, legal, or financial advice as fact.
Do not mention system prompts, API keys, or internal tools.
Mode is optional guidance only. The user does not have to pick a mode before asking.
${modeGuide}
${videoSearch
    ? "The backend will attach exactly one real YouTube video if search succeeds. Do not invent video IDs, URLs, or channel lists. Do not claim you embedded a video yourself. Keep the spoken answer short and introduce the topic."
    : "Do not invent YouTube video IDs or URLs."}
${lastVideo
    ? `The learner may ask follow-up questions about this video: "${lastVideo.title}" (${lastVideo.url}). Answer those using that video as context.`
    : ""}

Return ONLY a JSON object with this shape:
{"answer":"markdown-lite answer","speechText":"short spoken version without markdown","topic":"short topic or empty","followUpQuestion":"one question","needsWebSearch":false}`;
}

function buildUserPrompt({ message, mode, reportContext, noReport, firstName, videoSearch, lastVideo }) {
  const parts = [];
  if (firstName) parts.push(`The learner's first name is ${firstName}.`);
  parts.push(`Optional mode hint: ${mode}.`);
  parts.push(`User message: ${message}`);
  if (videoSearch) parts.push("The learner asked for a video or tutorial. Write a brief intro; a real search result may be attached separately.");
  if (lastVideo?.title) {
    parts.push(`Current video context: ${lastVideo.title} ${lastVideo.url || ""}`.trim());
  }
  if (noReport && (mode === "analyze" || reportContext === null)) {
    parts.push("No interview report is available. Ask them to complete an InterviewIQ interview first. Do not invent scores.");
  } else if (reportContext) {
    parts.push(`Latest interview report context (trusted, user-owned): ${reportContext}`);
  }
  return parts.join("\n");
}

function compactReport(result) {
  if (!result) return null;
  const questions = Array.isArray(result.perQuestionFeedback) ? result.perQuestionFeedback : [];
  const weak = questions
    .map((item) => ({
      question: clip(item.question || item.questionText, 180),
      evaluation: clip(item.evaluation || item.grade, 40),
      score: Number(item.score || item.technicalScore || 0),
      feedback: clip(item.feedback || item.mistake, 180),
    }))
    .filter((item) => item.question)
    .slice(0, 5);
  const payload = {
    overallScore: Number(result.overallScore || 0),
    technicalScore: Number(result.technicalScore || 0),
    communicationScore: Number(result.communicationScore || 0),
    confidenceScore: Number(result.confidenceScore || 0),
    grade: clip(result.grade, 20),
    strengths: clip(result.strengths, 240),
    weaknesses: clip(result.weaknesses, 240),
    improvements: clip(result.improvements, 240),
    summary: clip(result.summary, 280),
    weakAnswers: weak,
  };
  return JSON.stringify(payload).slice(0, MAX_REPORT_CHARS);
}

export function currentEventsLimitation() {
  return {
    success: true,
    answer:
      "I cannot look up live information such as today's news, prices, weather, or scores. Interview Friend does not have web search connected, so I will not invent current facts.\n\nAsk a general or interview topic instead, and I can explain it, quiz you, or coach your answers.",
    speechText:
      "I cannot look up live news, prices, or weather because web search is not connected. Ask a general topic and I can explain it.",
    topic: "",
    followUpQuestion: "What topic would you like me to explain instead?",
    needsWebSearch: true,
    videos: emptyVideos(),
  };
}

export function noReportResponse() {
  return {
    success: true,
    answer:
      "I do not have a previous InterviewIQ report for you yet.\n\nComplete an interview from the Interview page first. After you finish, come back here and choose **Analyze my last interview** for personalized coaching.",
    speechText:
      "I do not have a previous interview report yet. Complete an interview first, then I can coach you from your results.",
    topic: "interview report",
    followUpQuestion: "Would you like a practice interview question while you wait?",
    needsWebSearch: false,
    videos: emptyVideos(),
  };
}

function withSpeechChunks(payload) {
  const speechText = toSpeechText(payload.answer, payload.speechText);
  const ttsLanguage = detectTtsLanguage(speechText);
  return {
    ...payload,
    speechText,
    speechChunks: ttsLanguage === "hi" ? chunkHindiTtsText(speechText) : chunkTtsText(speechText),
  };
}

function normalizeModelPayload(rawText, fallbackAnswer, videos = []) {
  const parsed = extractJsonObject(rawText);
  const answer = extractModelAnswer(rawText, fallbackAnswer) || "I could not form a reply. Please try again.";
  return withSpeechChunks({
    success: true,
    answer,
    speechText: toSpeechText(answer, parsed?.speechText || pullJsonStringField(rawText, "speechText")),
    topic: clip(parsed?.topic || pullJsonStringField(rawText, "topic"), 80),
    followUpQuestion: clip(parsed?.followUpQuestion || pullJsonStringField(rawText, "followUpQuestion"), 240),
    needsWebSearch: false,
    videos: Array.isArray(videos) ? videos.slice(0, 3) : emptyVideos(),
    videosExhausted: false,
  });
}

export async function replyAsInterviewFriend({
  userId,
  firstName,
  message,
  conversationContext,
  mode,
  includeReportContext,
  lastVideo,
  excludeVideoIds,
  videoQuery,
  signal,
}) {
  const trimmed = clip(message, MAX_MESSAGE_CHARS);
  if (!trimmed) {
    const error = new Error("Please enter a question or message.");
    error.statusCode = 400;
    throw error;
  }

  const activeMode = normalizeFriendMode(mode);
  const { wantsReport, needsWebSearch, videoIntent } = classifyInterviewFriendNeed({
    message: trimmed,
    includeReportContext,
    mode: activeMode,
  });

  if (needsWebSearch) {
    return withSpeechChunks(currentEventsLimitation());
  }

  const casual = videoIntent.wanted ? null : matchCasualReply(trimmed, firstName);
  if (casual) {
    return withSpeechChunks({
      success: true,
      answer: casual.answer,
      speechText: casual.speechText,
      topic: "",
      followUpQuestion: "",
      needsWebSearch: false,
      videos: emptyVideos(),
    });
  }

  let reportContext = null;
  let noReport = false;
  if (wantsReport) {
    const result = await getLatestResultForUser(userId);
    if (!result) {
      noReport = true;
      if (activeMode === "analyze") return withSpeechChunks(noReportResponse());
    } else {
      reportContext = compactReport(result);
    }
  }

  const excludeIds = Array.isArray(excludeVideoIds)
    ? excludeVideoIds.map((id) => String(id || "")).filter(Boolean).slice(0, 40)
    : [];
  const savedQuery = clip(videoQuery, 180);
  const contextTurns = sanitizeConversationContext(conversationContext);
  const resolved = resolveVideoSearch({
    message: trimmed,
    videoIntent,
    conversationContext: contextTurns,
    videoQuery: savedQuery,
  });
  const searchQuery = videoIntent.refresh
    ? composeYoutubeQuery(resolved.topic || savedQuery, videoIntent, videoIntent.kind || "video")
    : resolved.query;
  const searchLanguage = videoIntent.language || "";
  const resourceLimit = Math.min(3, Math.max(1, Number(videoIntent.limit) || 3));

  if (videoIntent.wanted) {
    const videos = searchQuery
      ? await searchYoutubeVideos({
        query: searchQuery,
        topic: resolved.topic || searchQuery,
        language: searchLanguage,
        difficulty: videoIntent.difficulty,
        excludeIds,
        limit: resourceLimit,
        kind: videoIntent.kind || "video",
        signal,
      })
      : [];
    const list = toVideoList(videos).slice(0, resourceLimit);
    const intro = resourceIntro({
      ...videoIntent,
      topic: resolved.topic || videoIntent.topic,
      query: searchQuery,
    }, list.length);
    return withSpeechChunks({
      success: true,
      answer: intro.answer,
      speechText: intro.speechText,
      topic: clip(resolved.topic || searchQuery, 80),
      followUpQuestion: list.length ? "Would you like another set, or shall I explain the topic?" : "What topic should I search instead?",
      needsWebSearch: false,
      videos: list,
      videosExhausted: list.length === 0,
    });
  }

  const trustedLastVideo = lastVideo?.videoId && lastVideo?.title
    ? { videoId: String(lastVideo.videoId).slice(0, 24), title: clip(lastVideo.title, 160), url: clip(lastVideo.url, 180) }
    : null;

  const messages = [
    { role: "system", content: buildSystemPrompt(activeMode, { videoSearch: false, lastVideo: trustedLastVideo }) },
    ...contextTurns,
    {
      role: "user",
      content: buildUserPrompt({
        message: trimmed,
        mode: activeMode,
        reportContext,
        noReport,
        firstName,
        videoSearch: false,
        lastVideo: trustedLastVideo,
      }),
    },
  ];

  const raw = await completeHuggingFaceChat({
    messages,
    maxTokens: 700,
    temperature: 0.45,
    signal,
  });
  return normalizeModelPayload(raw, raw, emptyVideos());
}

export const FRIEND_LIMITS = {
  MAX_MESSAGE_CHARS,
};
