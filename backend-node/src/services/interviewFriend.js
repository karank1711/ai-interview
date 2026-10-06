import { completeHuggingFaceChat } from "./huggingfaceQuestions.js";
import { getLatestResultForUser } from "./interviewStore.js";
import { chunkTtsText } from "./groqTts.js";
import { detectTtsLanguage } from "./speechLanguage.js";
import { chunkHindiTtsText } from "./sarvamTts.js";
import { detectVideoSearchIntent, searchYoutubeVideos, composeYoutubeQuery, isGenericResourceTopic, isReferentialResourceRequest } from "./youtubeSearch.js";
import { detectSpecificResource, resolveSpecificResource } from "./specificResource.js";
import { buildFriendMemory, resolveFriendReference, routeFriendIntent, compactFriendSummary, mentionsFriendProduct } from "./friendContext.js";
import { retrieveFriendKnowledge, searchFriendWeb, formatRetrievedContext, formatFriendKnowledgeContext } from "./friendRetrieval.js";

const MAX_MESSAGE_CHARS = 2000;
const MAX_CONTEXT_TURNS = 8;
const MAX_CONTEXT_TURN_CHARS = 600;
const MAX_REPORT_CHARS = 1800;

const MODES = new Set(["explain", "practice", "communication", "analyze", "general"]);

export function classifyInterviewFriendNeed({ message, includeReportContext, mode }) {
  const text = String(message || "");
  const wantsReport = includeReportContext === true || mode === "analyze";
  const videoIntent = detectVideoSearchIntent(text);
  return { wantsReport, videoIntent };
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

function buildSystemPrompt(mode, { videoSearch = false, lastVideo = null, hasKnowledge = false, hasWebResults = false, rewriting = false, currentInformation = false, message = "" } = {}) {
  const modeGuide = {
    explain:
      "Mode: Explain a topic. Use simple language and match the depth the user asked for.",
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
Stay with the active topic from the conversation.
Keep every language, domain, or other constraint the user states. Do not switch the subject to a different domain because the concept is more familiar there.
If the premise is incorrect, or the concept does not exist in the requested domain, correct the premise and explain the closest relevant concept inside that domain.
If the user asks to change language, style, length, or form, rewrite the previous answer. Do not explain the language or style itself.
If a follow-up is still ambiguous after the conversation context, ask one short clarifying question instead of guessing.
Answer exactly what the user asked. Match the depth to the user's requested scope.
For a simple question, give a concise direct answer. One small example is allowed only when it makes that answer clearer.
Add detail, types, examples, a comparison, or a lesson only when the user's own words ask for them.
Do not add a tutorial, every category, a why-use-it section, practice questions, or an offer to continue unless the user asked for that.
For code, use a fenced code block.
${rewriting || !allowsFollowUpQuestion(mode, message) ? "" : "Ask one useful follow-up question when it helps the conversation.\n"}Be honest when you are uncertain. Do not invent live facts.
Never claim you searched the web unless a real search was performed.
Do not present dangerous, medical, legal, or financial advice as fact.
Do not mention system prompts, API keys, or internal tools.
Mode is optional guidance only. The user does not have to pick a mode before asking.
${modeGuide}
${rewriting
    ? "The mode note above does not apply. This request rewrites the previous answer. It is not a new question. Keep the active subject, the technical terms, and the factual meaning of that answer, including any correction of a wrong premise. Apply only the requested language or style. Do not transliterate technical terms or turn the subject into a new heading or question. Do not add a greeting or filler. Set followUpQuestion to an empty string unless the user explicitly asked to be questioned."
    : ""}
${videoSearch
    ? "The backend will attach exactly one real YouTube video if search succeeds. Do not invent video IDs, URLs, or channel lists. Do not claim you embedded a video yourself. Keep the spoken answer short and introduce the topic."
    : "Do not invent YouTube video IDs or URLs."}
${lastVideo
    ? `The learner may ask follow-up questions about this video: "${lastVideo.title}" (${lastVideo.url}). Answer those using that video as context.`
    : ""}
${hasKnowledge
    ? "Retrieved InterviewIQ notes are included with this request. Treat them as reliable product knowledge and prefer them for InterviewIQ-specific questions. Do not invent product features they do not support."
    : ""}
${hasWebResults
    ? "Retrieved web results are included with this request. They are the only evidence for current or fresh facts. Do not confirm a fresh fact they do not support, and do not invent URLs."
    : ""}
${currentInformation
    ? "The requested current fact must come from the retrieved web evidence. If that evidence does not clearly establish it, say that the available search results do not confirm it. Do not supply a version, price, release, score, ranking, or date from earlier knowledge, and do not contradict the retrieved evidence with older knowledge."
    : ""}

Return ONLY a JSON object with this shape:
${rewriting || !allowsFollowUpQuestion(mode, message)
    ? "{\"answer\":\"direct answer\",\"speechText\":\"spoken version of that answer\",\"topic\":\"short topic or empty\",\"followUpQuestion\":\"\",\"needsWebSearch\":false}"
    : "{\"answer\":\"markdown-lite answer\",\"speechText\":\"short spoken version without markdown\",\"topic\":\"short topic or empty\",\"followUpQuestion\":\"one question\",\"needsWebSearch\":false}"
}`;
}

export function requestedAnswerScope(text) {
  const utterance = String(text || "");
  if (/\breal[- ]world\b/i.test(utterance) && /\bexamples?\b/i.test(utterance)) return "real_world_examples";
  if (/\b(teach me|from (?:the )?basics|from scratch|tutorial|step by step|walk me through)\b/i.test(utterance)) return "tutorial";
  if (/\b(types?|kinds?|categories|variations?)\b/i.test(utterance)) return "types";
  if (/\bexamples?\b/i.test(utterance)) return "examples";
  if (/\b(compare|comparison|versus|vs\.?|difference between)\b/i.test(utterance)) return "comparison";
  if (/\b(in detail|detailed|in depth|deeper|go deeper|comprehensive|thorough)\b/i.test(utterance)) return "detail";
  return "concise";
}

export function allowsFollowUpQuestion(mode, message) {
  if (mode === "practice" || mode === "analyze") return true;
  return /\b(?:ask me|quiz me|question me)\b/i.test(String(message || ""));
}

const SCOPE_TEXT = {
  concise: "Give a concise direct answer to the question that was asked. One small example is allowed only if it makes that answer clearer. Do not add a tutorial, every type or category, a why-use-it section, practice questions, or extra headings.",
  detail: "The user asked for detail. Give a fuller explanation of the same subject. Do not add requests they did not make.",
  types: "The user asked about types or categories. Focus the answer on those types.",
  examples: "The user asked for examples. Focus the answer on examples.",
  real_world_examples: "The user asked for real-world examples. Include real-world examples.",
  tutorial: "The user asked to be taught. A structured explanation from the basics is appropriate.",
  comparison: "The user asked for a comparison. Focus the answer on that comparison.",
};

export function friendAnswerInstructions({ resolution, previousAnswer = "", message = "", mode = "general" } = {}) {
  const lines = [
    "Follow the active topic from conversation context.",
    "Answer exactly what the user is asking.",
    "Match the answer depth to the user's requested scope.",
    "Prefer a concise direct answer unless the user asks for more.",
    "Do not invent extra requests.",
    SCOPE_TEXT[requestedAnswerScope(message)] || SCOPE_TEXT.concise,
    "Keep every explicit language, domain, or other constraint in the user's request.",
    "Do not replace the requested subject with a different subject from another domain.",
    "If the premise is incorrect or the concept does not exist in the requested domain, correct the premise and explain the closest relevant concept inside that domain.",
    "If the user asks to change language, style, length, or form, transform the previous answer instead of defining that language or style.",
    "If a follow-up is still ambiguous after the conversation context, ask one concise clarification instead of guessing.",
    "Do not invent unsupported facts.",
  ];
  if (resolution?.verify || resolution?.challenge) {
    lines.push("The user is verifying or challenging the previous answer. Do not define their words, and do not treat the follow-up as a new subject.");
  }
  if (resolution?.verify && resolution?.informationNeed) {
    lines.push(`Current request: ${resolution.informationNeed}.`);
    lines.push("Answer that current request from the web evidence. Do not repeat an earlier answer from memory.");
  }
  if (!allowsFollowUpQuestion(mode, message)) {
    lines.push("Do not end with a follow-up question or an offer to continue.");
  }
  if (resolution?.transform) {
    lines.push(`Active subject: ${resolution.topic || "the previous topic"}.`);
    lines.push(`Requested transformation: ${resolution.transformation || "Rewrite the previous answer."}`);
    lines.push("Rewrite the previous answer according to the requested language or style while keeping the same subject and meaning.");
    lines.push("Do not explain the language or style itself.");
    lines.push("Keep technical terms in their original form. Do not transliterate them or turn the subject into a new heading or question.");
    lines.push("Do not add a greeting or filler. Leave followUpQuestion empty unless the user explicitly asked to be questioned.");
    lines.push("If the previous answer corrected a false premise, keep that corrected meaning. Do not restore the incorrect premise.");
    const prior = clip(previousAnswer, MAX_CONTEXT_TURN_CHARS);
    if (prior) lines.push(`Previous answer: ${prior}`);
  } else if (resolution?.mode === "follow_up") {
    lines.push(`Continue this subject: ${resolution.topic || "the previous topic"}.`);
  } else if (resolution?.mode === "new" && resolution.topic) {
    lines.push(`Answer this subject, including every constraint it states: ${resolution.topic}.`);
  }
  return lines.join("\n");
}

function buildUserPrompt({ message, mode, reportContext, noReport, firstName, videoSearch, lastVideo }) {
  const parts = [];
  if (firstName) parts.push(`The learner's first name is ${firstName}.`);
  parts.push(`Optional mode hint: ${mode}.`);
  if (message) parts.push(`User message: ${message}`);
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
  searchWeb,
  searchVideos = searchYoutubeVideos,
}) {
  const trimmed = clip(message, MAX_MESSAGE_CHARS);
  if (!trimmed) {
    const error = new Error("Please enter a question or message.");
    error.statusCode = 400;
    throw error;
  }

  const activeMode = normalizeFriendMode(mode);
  const { wantsReport, videoIntent } = classifyInterviewFriendNeed({
    message: trimmed,
    includeReportContext,
    mode: activeMode,
  });

  const history = (Array.isArray(conversationContext) ? conversationContext : [])
    .slice(-16)
    .map((turn) => ({
      role: turn?.role === "assistant" ? "assistant" : "user",
      content: String(turn?.content || "").replace(/\s+/g, " ").trim().slice(0, 500),
    }))
    .filter((turn) => turn.content);
  const memory = buildFriendMemory(history);
  const resolution = resolveFriendReference(trimmed, memory);
  const intent = routeFriendIntent(trimmed, resolution);
  const effectiveText = resolution.resolvedText || trimmed;

  if (resolution.mode === "clarify") {
    const answer = resolution.item
      ? "Which playlist or course should I use for that?"
      : "Which subject should I use? Name the topic, or refer back to something we already discussed.";
    return withSpeechChunks({
      success: true,
      answer,
      speechText: answer,
      topic: "",
      followUpQuestion: "",
      needsWebSearch: false,
      videos: emptyVideos(),
    });
  }

  const casual = videoIntent.wanted || intent === "resource_request" || intent === "follow_up"
    ? null
    : matchCasualReply(trimmed, firstName);
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

  const itemFollowUp = intent === "resource_request"
    && resolution.item
    && resolution.query
    && (resolution.mode === "resource" || resolution.mode === "restore");
  if (itemFollowUp) {
    const videos = await searchVideos({
      query: resolution.query,
      topic: resolution.topic || resolution.query,
      excludeIds: Array.isArray(excludeVideoIds) ? excludeVideoIds : [],
      limit: 3,
      kind: "video",
      signal,
    }).catch(() => []);
    const list = toVideoList(videos).slice(0, 3);
    if (list.length) {
      const intro = resourceIntro({
        topic: resolution.topic,
        query: resolution.query,
        kind: "video",
      }, list.length);
      return withSpeechChunks({
        success: true,
        answer: intro.answer,
        speechText: intro.speechText,
        topic: clip(resolution.topic || resolution.query, 80),
        followUpQuestion: "",
        needsWebSearch: false,
        videos: list,
        videosExhausted: false,
      });
    }
    const label = resolution.resourceType || "item";
    const answer = `I searched for ${label} ${resolution.item} in ${resolution.topic || "the current resource"}, but I could not find a matching result.`;
    return withSpeechChunks({
      success: true,
      answer,
      speechText: answer,
      topic: clip(resolution.topic, 80),
      followUpQuestion: "",
      needsWebSearch: false,
      videos: emptyVideos(),
    });
  }

  let coveredResourceQuery = "";
  if (intent === "resource_request") {
    const specific = detectSpecificResource(effectiveText);
    if (specific.wanted) {
      try {
        const found = await resolveSpecificResource(specific, { signal });
        if (found?.videos?.length) return withSpeechChunks(found);
        if (specificSearchesYoutube(specific)) coveredResourceQuery = specific.query;
      } catch {
        /* fall through to the normal answer */
      }
    }
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
  const contextTurns = sanitizeConversationContext(history).slice(-6);
  const searchMessage = intent === "resource_request" ? effectiveText : trimmed;
  const searchIntent = intent === "resource_request" ? detectVideoSearchIntent(searchMessage) : videoIntent;
  const resolved = resolveVideoSearch({
    message: searchMessage,
    videoIntent: searchIntent,
    conversationContext: contextTurns,
    videoQuery: resolution.query || savedQuery,
  });
  const searchQuery = (intent === "resource_request" ? searchIntent : videoIntent).refresh
    ? composeYoutubeQuery(resolved.topic || savedQuery, searchIntent, searchIntent.kind || "video")
    : (resolved.query || (intent === "resource_request" ? effectiveText : ""));
  const searchLanguage = searchIntent.language || "";
  const resourceLimit = Math.min(3, Math.max(1, Number(searchIntent.limit) || 3));

  if (intent !== "follow_up" && intent !== "current_information" && searchIntent.wanted && searchQuery && !sameResourceSearchQuery(coveredResourceQuery, searchQuery)) {
    const videos = await searchYoutubeVideos({
      query: searchQuery,
      topic: resolved.topic || searchQuery,
      language: searchLanguage,
      difficulty: searchIntent.difficulty,
      excludeIds,
      limit: resourceLimit,
      kind: searchIntent.kind || "video",
      signal,
    }).catch(() => []);
    const list = toVideoList(videos).slice(0, resourceLimit);
    if (list.length) {
      const intro = resourceIntro({
        ...searchIntent,
        topic: resolved.topic || searchIntent.topic || resolution.topic,
        query: searchQuery,
      }, list.length);
      return withSpeechChunks({
        success: true,
        answer: intro.answer,
        speechText: intro.speechText,
        topic: clip(resolution.topic || resolved.topic || searchQuery, 80),
        followUpQuestion: "",
        needsWebSearch: false,
        videos: list,
        videosExhausted: false,
      });
    }
  }

  const loaded = await loadFriendAnswerContext({
    intent,
    effectiveText,
    topic: resolution.topic,
    searchQuery: resolution.informationNeed || "",
    fresh: Boolean(resolution.verify),
    signal,
    searchWeb,
  });
  const knowledge = loaded.knowledge;
  const web = loaded.web;
  const knowledgeContext = formatFriendKnowledgeContext(knowledge);
  const webContext = formatCurrentInformationContext(web, { currentInformation: intent === "current_information" });
  const workingMemory = compactFriendSummary(resolution.memory || memory);
  const previousAnswer = [...history].reverse().find((turn) => turn.role === "assistant")?.content || "";
  const currentInformation = intent === "current_information";
  if (currentInformation) {
    const domains = web.map((item) => item.domain || item.url).filter(Boolean).slice(0, 3);
    console.info(`[friend-web] intent=${intent} topic=${clip(resolution.informationSubject || resolution.topic, 80)} query=${clip(resolution.informationNeed || trimmed, 120)} results=${web.length} domains=${domains.join(",")} evidence=${web.length > 0} fresh=${Boolean(resolution.verify)}`);
  }
  if (currentInformation && !web.length) {
    const answer = UNVERIFIED_CURRENT_FACT;
    return withSpeechChunks({
      success: true,
      answer,
      speechText: answer,
      topic: clip(resolution.informationSubject || resolution.topic, 80),
      followUpQuestion: "",
      needsWebSearch: false,
      videos: emptyVideos(),
    });
  }

  const trustedLastVideo = lastVideo?.videoId && lastVideo?.title
    ? { videoId: String(lastVideo.videoId).slice(0, 24), title: clip(lastVideo.title, 160), url: clip(lastVideo.url, 180) }
    : null;

  const rewriting = Boolean(resolution.transform);
  const messages = [
    { role: "system", content: buildSystemPrompt(activeMode, { videoSearch: false, lastVideo: trustedLastVideo, hasKnowledge: Boolean(knowledgeContext), hasWebResults: web.length > 0, rewriting, currentInformation, message: trimmed }) },
    ...contextTurns,
    {
      role: "user",
      content: [
        rewriting ? friendAnswerInstructions({ resolution, previousAnswer, message: trimmed, mode: activeMode }) : "",
        buildUserPrompt({
          message: resolution.mode === "new" || rewriting ? trimmed : `${trimmed}\nResolved meaning: ${effectiveText}`,
          mode: activeMode,
          reportContext,
          noReport,
          firstName,
          videoSearch: false,
          lastVideo: trustedLastVideo,
        }),
        currentInformation ? `Current request: ${resolution.informationNeed || trimmed}\nActive subject: ${resolution.informationSubject || resolution.topic || "the previous subject"}` : "",
        workingMemory ? `Conversation memory:\n${workingMemory}` : "",
        rewriting ? "" : friendAnswerInstructions({ resolution, previousAnswer, message: trimmed, mode: activeMode }),
        knowledgeContext,
        webContext,
      ].filter(Boolean).join("\n\n"),
    },
  ];

  const raw = await completeHuggingFaceChat({
    messages,
    maxTokens: 700,
    temperature: rewriting ? 0.2 : 0.45,
    signal,
  });
  const payload = normalizeModelPayload(raw, raw, emptyVideos());
  if (!allowsFollowUpQuestion(activeMode, trimmed)) payload.followUpQuestion = "";
  if (currentInformation && web.length) {
    const guarded = enforceCurrentEvidence(payload.answer, web);
    if (guarded !== payload.answer) {
      return withSpeechChunks({ ...payload, answer: guarded, speechText: guarded });
    }
  }
  return payload;
}

function freshFactNumbers(text) {
  return String(text || "").match(/\b\d{2,}(?:\.\d+)*\b/g) || [];
}

function versionValues(text) {
  const values = new Set();
  for (const match of String(text || "").matchAll(/\b(\d{1,3}(?:\.\d+)+)\b/g)) values.add(match[1]);
  for (const match of String(text || "").matchAll(/\b(?:jdk|version|release|v)\s*(\d{2,3})\b/gi)) values.add(match[1]);
  return [...values];
}

function compareVersions(left, right) {
  const a = String(left).split(".").map((part) => Number(part) || 0);
  const b = String(right).split(".").map((part) => Number(part) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff) return diff;
  }
  return 0;
}

export function enforceCurrentEvidence(answer, web) {
  const results = (Array.isArray(web) ? web : []).filter((item) => item?.title && item?.url);
  const text = String(answer || "");
  if (!results.length) return text;
  const evidenceText = results.map((item) => `${item.title} ${item.snippet || ""}`).join("\n");
  const evidenceNumbers = new Set(freshFactNumbers(evidenceText));
  const answerNumbers = freshFactNumbers(text);
  const unsupported = answerNumbers.filter((value) => !evidenceNumbers.has(value));
  const evidenceVersions = versionValues(evidenceText);
  const answerVersions = versionValues(text);
  const newest = evidenceVersions.reduce((best, value) => (!best || compareVersions(value, best) > 0 ? value : best), "");
  const bareAnswerVersions = [...text.matchAll(/\b(\d{2,3})\b/g)]
    .map((match) => match[1])
    .filter((value) => !answerVersions.some((item) => item === value || item.startsWith(`${value}.`)));
  const usesOlderVersion = Boolean(newest) && [...answerVersions, ...bareAnswerVersions].some((value) => compareVersions(value, newest) < 0);
  const staleMemory = /knowledge cutoff|as of my (?:last )?knowledge|training data/i.test(text);
  if (answerNumbers.length > 0 && unsupported.length === 0 && !usesOlderVersion && !staleMemory) return text;
  const listed = results.map((item) => {
    const snippet = item.snippet && item.snippet !== item.title ? `: ${item.snippet.slice(0, 160)}` : "";
    return `- ${item.title} (${item.url})${snippet}`;
  }).join("\n");
  if (evidenceNumbers.size || evidenceVersions.length) {
    return `The retrieved results are the only basis for this current fact:\n\n${listed}\n\nIf these results do not state the same value, they disagree. I will not replace them with a different value from older knowledge.`;
  }
  return `The available search results do not confirm that current fact. I will not supply it from older knowledge.\n\n${listed}`;
}

export function formatCurrentInformationContext(web, { currentInformation = false } = {}) {
  const results = Array.isArray(web) ? web.filter((item) => item?.title && item?.url) : [];
  if (results.length) {
    const notes = formatRetrievedContext({ web: results });
    return `${notes}
These listed results are the only evidence available for current or fresh facts, such as versions, prices, scores, recent events, releases, news, dates, and rankings.
State a fresh fact as confirmed only when one of these results clearly states it.
Do not fill missing fresh details from memory, and do not guess values.
Never supply an older version, price, release, score, ranking, or date from earlier knowledge when these results do not state it.
Do not contradict these results with older knowledge.
If these results do not contain the requested fresh detail, say that the available search results do not confirm it.
If these results disagree, prefer the more authoritative and newer source. If the conflict cannot be resolved, say that the sources disagree and state what each result indicates. Do not invent a resolution.
Prefer newer evidence for latest, current, today, or recent facts. A years-old result is not automatically current. If a result has no date, do not claim an exact recency.
You may explain stable background only when it is not the requested fresh fact.
Cite only the URLs listed above. Do not invent sources or URLs.`;
  }
  if (!currentInformation) return "";
  return `No retrieved web evidence is included for this request.
Do not state a current or fresh fact as confirmed, including versions, prices, scores, recent events, releases, news, dates, and rankings.
Do not invent sources or URLs, and do not claim that a web search was performed.
You may still explain stable, non-time-sensitive parts from general knowledge.`;
}

function specificSearchesYoutube(specific) {
  if (!specific?.query || specific.directUrl) return false;
  return specific.type === "video" || specific.type === "playlist";
}

export const UNVERIFIED_CURRENT_FACT = "I could not verify that current information right now, so I will not guess it from older knowledge.";

export function sameResourceSearchQuery(left, right) {
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const prior = normalize(left);
  const next = normalize(right);
  return Boolean(prior) && prior === next;
}

export function shouldRetrieveFriendKnowledge(intent, text) {
  if (intent === "rag_required") return true;
  return intent === "follow_up" && mentionsFriendProduct(text);
}

export async function loadFriendAnswerContext({
  intent,
  effectiveText,
  topic,
  searchQuery = "",
  fresh = false,
  signal,
  retrieve = retrieveFriendKnowledge,
  searchWeb = searchFriendWeb,
}) {
  let knowledge = [];
  let web = [];
  const query = `${effectiveText || ""} ${topic || ""}`.replace(/\s+/g, " ").trim();
  const webQuery = String(searchQuery || effectiveText || topic || "").replace(/\s+/g, " ").trim();
  try {
    if (shouldRetrieveFriendKnowledge(intent, query)) {
      knowledge = await retrieve(query);
    } else if (intent === "current_information") {
      web = await searchWeb(webQuery, signal, fresh ? { fresh: true } : undefined);
    }
  } catch {
    knowledge = [];
    web = [];
  }
  return { knowledge: Array.isArray(knowledge) ? knowledge : [], web: Array.isArray(web) ? web : [] };
}

export const FRIEND_LIMITS = {
  MAX_MESSAGE_CHARS,
};
