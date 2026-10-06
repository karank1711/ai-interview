const FUNCTION_WORDS = new Set([
  "a", "an", "the", "me", "my", "you", "your", "please", "can", "could", "would", "should",
  "give", "get", "show", "send", "do", "for", "of", "on", "to", "in", "with", "and", "or",
  "is", "are", "about", "regarding", "mujhe", "muje", "bhejo", "karo", "dena",
  "what", "whats", "why", "how", "when", "who", "which",
  "ka", "ki", "ke", "hai", "hain", "kya", "se", "pe", "par", "pr", "ko", "mein", "bhi", "na", "toh",
]);

const ANAPHORA = new Set([
  "it", "its", "this", "that", "these", "those", "one",
  "iska", "iski", "iske", "uska", "uski", "uske", "ye", "yeh", "woh", "wo",
  "wala", "wali", "wale", "previous", "next", "same", "continue", "again",
]);

const RESOURCE_LABELS = new Set([
  "lecture", "lectures", "playlist", "playlists", "video", "videos",
  "tutorial", "tutorials", "episode", "episodes", "part", "parts",
]);

const ACTS = new Set([
  "explain", "explanation", "example", "examples", "code", "complexity",
  "drawback", "drawbacks", "summarize", "summary", "define", "compare",
  "implement", "implementation", "snippet", "program",
  "make", "shorten", "rephrase", "rewrite", "translate", "repeat", "convert",
  "simplify", "elaborate", "expand", "clarify", "restate", "paraphrase",
  "describe", "say", "tell", "write", "recap",
  "batao", "btao", "batana", "bolo", "karke", "dekho", "dekh",
]);

const MANNER = new Set([
  "simply", "simple", "simpler", "briefly", "brief", "clearly", "easier",
  "short", "shorter", "detailed", "detail", "deeper", "concise", "longer",
  "plainly", "slowly", "more", "less", "further",
]);

const STYLE_RELATIONS = new Set(["in", "into", "using", "as", "via", "to"]);

const LOOKUP = new Set([
  "search", "lookup", "look", "verify", "verification", "confirm", "confirmation",
  "check", "recheck", "online", "internet", "web", "double", "up",
]);

const FRESH_WORDS = new Set([
  "latest", "newest", "recent", "current", "new", "today", "tonight", "yesterday",
  "breaking", "live", "now", "recently", "updated", "right",
]);

const VOLATILE_WORDS = new Set([
  "version", "versions", "release", "releases", "price", "prices", "pricing", "cost", "costs",
  "news", "score", "scores", "result", "results", "winner", "winners", "weather", "ceo", "ceos",
  "update", "updates", "standing", "standings", "ranking", "rankings", "headline", "headlines",
  "event", "events", "availability", "announcement", "announcements", "status", "changelog",
  "released", "available", "announced",
]);

const CASUAL_WORDS = new Set(["ok", "okay", "yes", "no", "yeah", "yep", "thanks", "thank", "hi", "hello", "hey"]);

const REWRITE_ACTS = new Set([
  "translate", "rephrase", "rewrite", "simplify", "paraphrase", "restate", "shorten",
]);

const LANGS = new Set([
  "java", "python", "javascript", "js", "typescript", "ts", "cpp", "c", "react",
]);

function emptyMemory() {
  return {
    activeTopic: "",
    activeEntity: "",
    resourceType: "",
    currentItem: null,
    lastIntent: "",
    lastSearchQuery: "",
    informationNeed: "",
    informationSubject: "",
    recentTopics: [],
  };
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function clip(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function isQuestion(text) {
  return /^(what|why|how|when|who|which|define)\b/i.test(String(text || "").trim());
}

const INDEX_GLUE = new Set(["no", "number", "num"]);

function bareIndex(text, tokens) {
  if (isQuestion(text)) return null;
  const nums = tokens.filter((token) => /^\d{1,3}$/.test(token));
  if (nums.length !== 1) return null;
  const meaningful = tokens.filter((token) => (
    !/^\d{1,3}$/.test(token)
    && !FUNCTION_WORDS.has(token)
    && !ANAPHORA.has(token)
    && !RESOURCE_LABELS.has(token)
    && !ACTS.has(token)
    && !INDEX_GLUE.has(token)
  ));
  if (meaningful.length > 0) return null;
  return Number(nums[0]);
}

function mentionedNumber(text, tokens) {
  if (isQuestion(text)) return null;
  const nums = tokens.filter((token) => /^\d{1,3}$/.test(token));
  if (nums.length !== 1) return null;
  return Number(nums[0]);
}

function contentTokens(tokens) {
  return tokens.filter((token) => (
    !FUNCTION_WORDS.has(token)
    && !ANAPHORA.has(token)
    && !RESOURCE_LABELS.has(token)
    && !/^\d{1,3}$/.test(token)
  ));
}

function subjectPhrase(text) {
  const phrase = String(text || "")
    .replace(/^(please\s+)?((can|could|would)\s+you\s+)?/i, "")
    .replace(/^(what is|what's|whats|how does|how do|tell me about|define|explain|give me|show me|send me|get me|play)\s+/i, "")
    .replace(/^(?:(?:to\s+)?me|my|please|just)\s+/i, "")
    .replace(/[?.!]+$/g, "");
  return clip(phrase, 120);
}

function formatResource(memory, item, label) {
  const stored = memory.resourceType || "";
  const type = label || (item && stored === "playlist" ? "lecture" : stored) || "lecture";
  const core = clip(memory.activeTopic || memory.lastSearchQuery || memory.activeEntity, 120);
  if (!core) return "";
  return clip(item ? `${core} ${type} ${item}` : `${core} ${type}`, 180);
}

function cleanResourceTopic(topic) {
  return clip(String(topic || "")
    .replace(/\b(?:youtube|playlist|playlists|video|videos|lecture|lectures|tutorial|tutorials|episode|episodes|part|parts|a|an|the|no|number|num)\b/gi, " ")
    .replace(/\b\d{1,3}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim(), 120);
}

function snapshot(memory) {
  if (!memory.activeTopic && !memory.lastSearchQuery) return null;
  return {
    activeTopic: memory.activeTopic,
    activeEntity: memory.activeEntity,
    resourceType: memory.resourceType,
    currentItem: memory.currentItem,
    lastSearchQuery: memory.lastSearchQuery,
  };
}

function styleRemainder(tokens) {
  for (let index = 0; index < tokens.length; index += 1) {
    if (!STYLE_RELATIONS.has(tokens[index])) continue;
    const before = tokens.slice(0, index);
    const beforeSubject = before.filter((token) => (
      !FUNCTION_WORDS.has(token)
      && !ANAPHORA.has(token)
      && !ACTS.has(token)
      && !MANNER.has(token)
      && !RESOURCE_LABELS.has(token)
      && !/^\d{1,3}$/.test(token)
    ));
    if (beforeSubject.length) continue;
    const after = tokens.slice(index + 1).filter((token) => !FUNCTION_WORDS.has(token) && !ANAPHORA.has(token));
    if (after.length) return after;
  }
  return null;
}

function rewriteRequest(tokens) {
  const style = styleRemainder(tokens);
  const styleTokens = new Set(style || []);
  const subjects = tokens.filter((token) => (
    !FUNCTION_WORDS.has(token)
    && !ANAPHORA.has(token)
    && !ACTS.has(token)
    && !MANNER.has(token)
    && !RESOURCE_LABELS.has(token)
    && !styleTokens.has(token)
    && !/^\d{1,3}$/.test(token)
  ));
  if (subjects.length) return false;
  if (style) return true;
  if (tokens.some((token) => MANNER.has(token))) return true;
  return tokens.some((token) => REWRITE_ACTS.has(token));
}

function needsMissingContext(raw, tokens) {
  if (tokens.some((token) => RESOURCE_LABELS.has(token))) return false;
  if (/\b(youtube|playlist|tutorial)\b/i.test(raw)) return false;
  const style = styleRemainder(tokens);
  const styleTokens = new Set(style || []);
  const subjects = tokens.filter((token) => (
    !FUNCTION_WORDS.has(token)
    && !ANAPHORA.has(token)
    && !ACTS.has(token)
    && !MANNER.has(token)
    && !RESOURCE_LABELS.has(token)
    && !styleTokens.has(token)
    && !/^\d{1,3}$/.test(token)
  ));
  if (subjects.length) return false;
  if (style) return true;
  if (tokens.some((token) => ANAPHORA.has(token))) return true;
  return tokens.some((token) => ACTS.has(token) || MANNER.has(token));
}

function leftoverSubjects(tokens) {
  return tokens.filter((token) => (
    !FUNCTION_WORDS.has(token)
    && !ANAPHORA.has(token)
    && !ACTS.has(token)
    && !MANNER.has(token)
    && !LOOKUP.has(token)
    && !FRESH_WORDS.has(token)
    && !VOLATILE_WORDS.has(token)
    && !RESOURCE_LABELS.has(token)
    && !CASUAL_WORDS.has(token)
    && !/^\d{1,3}$/.test(token)
  ));
}

function isLookupFollowUp(tokens) {
  return tokens.some((token) => LOOKUP.has(token)) && leftoverSubjects(tokens).length === 0;
}

function isShortChallenge(raw, tokens) {
  if (isQuestion(raw) || tokens.length === 0 || tokens.length > 4) return false;
  if (tokens.some((token) => ACTS.has(token) && !LOOKUP.has(token))) return false;
  const leftover = leftoverSubjects(tokens);
  if (!leftover.length || leftover.length > 2) return false;
  return leftover.some((token) => !CASUAL_WORDS.has(token));
}

function pivotSubject(text) {
  const match = String(text || "").trim().match(/^(?:and\s+)?(?:what|how)\s+about\s+(.+?)\s*[?.!]*$/i);
  if (!match) return "";
  const subject = clip(match[1].replace(/^(?:the|a|an)\s+/i, ""), 80);
  if (!subject || /^(it|this|that|them|these|those)$/i.test(subject)) return "";
  return subject;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceSubject(need, previousSubject, nextSubject) {
  const base = clip(need, 160);
  const prior = clip(previousSubject, 80);
  if (prior && base.toLowerCase().includes(prior.toLowerCase())) {
    return clip(base.replace(new RegExp(`\\b${escapeRegExp(prior)}\\b`, "i"), nextSubject), 160);
  }
  return clip(`${base} ${nextSubject}`, 160);
}

export function currentFactQuery(text) {
  const kept = tokenize(text).filter((token) => !FUNCTION_WORDS.has(token) && !LOOKUP.has(token) && !ACTS.has(token));
  return clip(kept.join(" "), 160);
}

function factSubject(text) {
  return clip(leftoverSubjects(tokenize(text)).join(" "), 80);
}

function verificationTurn(memory, raw) {
  return {
    mode: "follow_up",
    topic: memory.informationSubject || memory.activeTopic,
    entity: memory.informationSubject || memory.activeEntity,
    resourceType: memory.resourceType,
    item: memory.currentItem,
    query: memory.informationNeed,
    intent: "current_information",
    transform: false,
    transformation: "",
    verify: true,
    challenge: true,
    informationNeed: memory.informationNeed,
    informationSubject: memory.informationSubject,
    resolvedText: memory.informationNeed || memory.activeTopic || raw,
  };
}

function pivotTurn(memory, subject) {
  const need = replaceSubject(memory.informationNeed, memory.informationSubject, subject);
  return {
    mode: "new",
    topic: subject,
    entity: subject,
    resourceType: "",
    item: null,
    query: need,
    intent: "current_information",
    transform: false,
    verify: false,
    challenge: false,
    informationNeed: need,
    informationSubject: subject,
    resolvedText: need,
  };
}

function matchPrior(content, memory) {
  if (!content.length) return null;
  const pools = [...memory.recentTopics];
  const current = snapshot(memory);
  if (current) pools.push(current);
  let best = null;
  let bestScore = 0;
  for (const item of pools) {
    const hay = `${item.activeEntity} ${item.activeTopic}`.toLowerCase();
    const score = content.filter((token) => token.length > 2 && hay.includes(token)).length;
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

function followUp(memory, raw, transform) {
  return {
    mode: "follow_up",
    topic: memory.activeTopic,
    entity: memory.activeEntity,
    resourceType: memory.resourceType,
    item: memory.currentItem,
    query: memory.lastSearchQuery,
    intent: "follow_up",
    transform,
    transformation: transform ? raw : "",
    verify: false,
    challenge: false,
    informationNeed: memory.informationNeed || "",
    informationSubject: memory.informationSubject || "",
    resolvedText: `Regarding ${memory.activeTopic || memory.lastSearchQuery}: ${raw}`,
  };
}

function interpret(text, memory) {
  const raw = clip(text, 500);
  const tokens = tokenize(raw);
  const labels = tokens.filter((token) => RESOURCE_LABELS.has(token));
  const anaphora = tokens.filter((token) => ANAPHORA.has(token));
  const content = contentTokens(tokens);
  const index = bareIndex(raw, tokens);
  const number = mentionedNumber(raw, tokens);
  const prior = matchPrior(content, memory);
  const label = labels[0] || "";
  const transform = rewriteRequest(tokens);

  if (prior && (number || labels.length || anaphora.length) && !isQuestion(raw)) {
    const item = number ?? (anaphora.includes("previous") && prior.currentItem ? prior.currentItem - 1 : null)
      ?? (anaphora.includes("next") && prior.currentItem ? prior.currentItem + 1 : prior.currentItem);
    const query = formatResource(prior, item, label);
    return {
      mode: "restore",
      topic: prior.activeTopic,
      entity: prior.activeEntity,
      resourceType: label || prior.resourceType || "lecture",
      item,
      query,
      intent: "resource_request",
      resolvedText: query || raw,
    };
  }

  const hasContext = Boolean(memory.activeTopic || memory.lastSearchQuery);
  const resourceActive = Boolean(memory.resourceType) || memory.lastIntent === "resource_request";
  if (hasContext && !isQuestion(raw) && (index || (anaphora.length && content.length === 0) || (labels.length && content.length === 0))) {
    const directional = anaphora.includes("previous") && memory.currentItem
      ? memory.currentItem - 1
      : anaphora.includes("next") && memory.currentItem
        ? memory.currentItem + 1
        : null;
    const item = index ?? directional;
    if (item && resourceActive) {
      const query = formatResource(memory, item, label);
      return {
        mode: "resource",
        topic: memory.activeTopic,
        entity: memory.activeEntity,
        resourceType: label || (memory.resourceType === "playlist" ? "lecture" : memory.resourceType) || "lecture",
        item,
        query,
        intent: "resource_request",
        resolvedText: query || raw,
      };
    }
    if (labels.length && item && !resourceActive) {
      return {
        mode: "clarify",
        topic: "",
        entity: "",
        resourceType: "",
        item,
        query: "",
        intent: "clarify",
        transform: false,
        resolvedText: raw,
      };
    }
    return followUp(memory, raw, transform);
  }

  const substantive = content.filter((token) => !ACTS.has(token) && !LANGS.has(token) && !MANNER.has(token));
  if (hasContext && !isQuestion(raw) && content.length > 0 && substantive.length === 0) {
    return followUp(memory, raw, transform);
  }

  if (hasContext && isQuestion(raw) && anaphora.length && !prior) {
    return followUp(memory, raw, transform);
  }

  if (hasContext && !isQuestion(raw) && transform) {
    return followUp(memory, raw, true);
  }

  const pivoted = pivotSubject(raw);
  if (hasContext && pivoted && memory.informationNeed) {
    return pivotTurn(memory, pivoted);
  }

  if (hasContext && isLookupFollowUp(tokens) && memory.informationNeed) {
    return verificationTurn(memory, raw);
  }

  if (hasContext && isShortChallenge(raw, tokens)) {
    if (memory.informationNeed) return verificationTurn(memory, raw);
    return { ...followUp(memory, raw, false), challenge: true };
  }

  if (!hasContext && needsMissingContext(raw, tokens)) {
    return {
      mode: "clarify",
      topic: "",
      entity: "",
      resourceType: "",
      item: null,
      query: "",
      intent: "clarify",
      transform: false,
      resolvedText: raw,
    };
  }

  let topic = clip(subjectPhrase(raw) || content.join(" ") || raw, 120);
  const entity = content.find((token) => token.length > 2 && !LANGS.has(token) && !ACTS.has(token) && token !== "youtube" && !INDEX_GLUE.has(token)) || "";
  const resourceType = label;
  const intent = resourceType || /\b(youtube|playlist|tutorial)\b/i.test(raw) ? "resource_request" : "normal_qa";
  if (resourceType) {
    topic = cleanResourceTopic(topic);
  }
  if (intent === "resource_request" && number && !topic && !resourceActive) {
    return {
      mode: "clarify",
      topic: "",
      entity: "",
      resourceType: "",
      item: number,
      query: "",
      intent: "clarify",
      transform: false,
      resolvedText: raw,
    };
  }
  const current = intent === "normal_qa" && requestsCurrentInformation(raw);
  let informationNeed = "";
  let informationSubject = "";
  if (current) {
    informationSubject = factSubject(raw);
    informationNeed = currentFactQuery(raw);
    const carried = !memory.informationNeed && memory.activeTopic && memory.activeTopic.split(" ").length <= 4
      ? memory.activeTopic
      : "";
    if (!informationSubject && carried && !requestsCurrentInformation(carried)) {
      informationSubject = carried;
      if (!informationNeed.toLowerCase().includes(carried.toLowerCase())) {
        informationNeed = clip(`${informationNeed} ${carried}`, 160);
      }
    }
  }
  const query = intent === "resource_request"
    ? clip(`${topic} ${resourceType || "video"}${number ? ` ${number}` : ""}`.replace(/\s+/g, " "), 180)
    : raw;
  return {
    mode: "new",
    topic: topic || clip(raw, 120),
    entity,
    resourceType,
    item: resourceType ? number : null,
    query,
    intent: current ? "current_information" : intent,
    transform: false,
    verify: false,
    challenge: false,
    informationNeed,
    informationSubject,
    resolvedText: intent === "resource_request" ? query : raw,
  };
}

function commit(memory, turn) {
  const next = {
    ...memory,
    recentTopics: memory.recentTopics.slice(-4),
  };
  if (turn.mode === "new" && turn.topic && turn.topic !== memory.activeTopic) {
    const saved = snapshot(memory);
    if (saved) next.recentTopics = [...next.recentTopics, saved].slice(-4);
  }
  const base = turn.mode === "restore" ? {
    activeTopic: turn.topic,
    activeEntity: turn.entity,
    resourceType: turn.resourceType,
    currentItem: turn.item,
    lastSearchQuery: turn.query,
  } : null;
  const carryNeed = turn.mode === "follow_up" || turn.verify;
  const informationNeed = turn.informationNeed || (carryNeed ? next.informationNeed : "");
  const informationSubject = turn.informationSubject || (carryNeed ? next.informationSubject : "");
  const leavesResource = turn.mode === "new" && turn.intent !== "resource_request";
  return {
    activeTopic: turn.topic || base?.activeTopic || next.activeTopic,
    activeEntity: turn.entity || base?.activeEntity || next.activeEntity,
    resourceType: leavesResource ? (turn.resourceType || "") : (turn.resourceType || next.resourceType),
    currentItem: leavesResource ? (turn.item ?? null) : (turn.item ?? next.currentItem),
    lastIntent: turn.intent || next.lastIntent,
    lastSearchQuery: turn.query || next.lastSearchQuery,
    informationNeed,
    informationSubject,
    recentTopics: next.recentTopics,
  };
}

export function buildFriendMemory(turns) {
  let memory = emptyMemory();
  for (const turn of Array.isArray(turns) ? turns : []) {
    if (turn?.role !== "user" || !turn.content) continue;
    memory = commit(memory, interpret(turn.content, memory));
  }
  return memory;
}

export function resolveFriendReference(message, memory) {
  const safe = memory || emptyMemory();
  const turn = interpret(message, safe);
  return { ...turn, memory: commit(safe, turn) };
}

const FRESHNESS = "latest|newest|most recent|current|right now|up[- ]to[- ]date|breaking|live|new";
const VOLATILE_FACT = "versions?|releases?|prices?|pricing|costs?|news|scores?|results?|winners?|weather|ceos?|updates?|standings|rankings?|headlines?|events?";
const TIME_SCOPE = "today|tonight|yesterday|this morning|this evening|this week|last night";
const TIMED_EVENT = "match|game|games|score|result|winner|election|race|news";
const WORD_GAP = "(?:\\W+\\w+){0,4}\\W+";
const FRESH_FACT_RE = new RegExp(
  `\\b(?:${FRESHNESS})\\b${WORD_GAP}\\b(?:${VOLATILE_FACT})\\b|\\b(?:${VOLATILE_FACT})\\b${WORD_GAP}\\b(?:${FRESHNESS})\\b`,
  "i"
);
const TIMED_EVENT_RE = new RegExp(`\\b(?:${TIME_SCOPE})\\b${WORD_GAP}\\b(?:${TIMED_EVENT})\\b|\\b(?:${TIMED_EVENT})\\b${WORD_GAP}\\b(?:${TIME_SCOPE})\\b`, "i");
const DIRECT_CURRENT_RE = /\b(?:who won|breaking news|live score|stock price)\b/i;
const HAPPENED_NOW_RE = new RegExp(`\\bwhat happened\\b${WORD_GAP}\\b(?:${TIME_SCOPE})\\b|\\b(?:${TIME_SCOPE})\\b${WORD_GAP}\\bwhat happened\\b`, "i");
const AS_OF_RE = /\bas of (?:today|now|yesterday|this week)\b/i;
const RELEASE_STATE_RE = /\b(?:has|have|is|was)\b(?:\W+\w+){0,6}\W+\b(?:released|available|announced|launched)\b|\b(?:released|available|announced)\s+yet\b/i;
const STILL_RE = /\b(?:is|are|does|do|has|have)\b(?:\W+\w+){0,5}\W+\bstill\b|\bstill\b(?:\W+\w+){0,4}\W+\b(?:available|supported|current|active|released)\b/i;
const CURRENT_ROLE_RE = /\bwho is currently\b|\bwhat is the current\b|\bwhen was the latest\b|\bwhat changed recently\b|\brecent announcement\b|\bcurrent availability\b|\bcurrent status\b/i;
const PRODUCT_RE = /\b(interviewiq|interview friend|face analysis|facial analysis|mediapipe)\b/i;

function requestsCurrentInformation(text) {
  const utterance = String(text || "");
  if (!utterance.trim()) return false;
  return DIRECT_CURRENT_RE.test(utterance)
    || HAPPENED_NOW_RE.test(utterance)
    || AS_OF_RE.test(utterance)
    || FRESH_FACT_RE.test(utterance)
    || TIMED_EVENT_RE.test(utterance)
    || RELEASE_STATE_RE.test(utterance)
    || STILL_RE.test(utterance)
    || CURRENT_ROLE_RE.test(utterance);
}

export function mentionsFriendProduct(text) {
  return PRODUCT_RE.test(String(text || ""));
}

export function routeFriendIntent(message, resolution) {
  const utterance = String(message || "");
  if (resolution?.mode === "clarify") return "clarify";
  if (resolution?.intent === "resource_request" || resolution?.mode === "resource" || resolution?.mode === "restore") {
    return "resource_request";
  }
  if (resolution?.verify && resolution?.informationNeed) return "current_information";
  if (resolution?.mode === "follow_up" && !requestsCurrentInformation(utterance)) return "follow_up";
  if (requestsCurrentInformation(utterance) || resolution?.intent === "current_information") return "current_information";
  if (PRODUCT_RE.test(utterance) || PRODUCT_RE.test(resolution?.topic || "")) return "rag_required";
  return "normal_qa";
}

export function compactFriendSummary(memory) {
  if (!memory) return "";
  const topics = (memory.recentTopics || [])
    .map((item) => item.activeTopic)
    .filter(Boolean)
    .slice(-3);
  return [
    memory.activeTopic ? `Active topic: ${memory.activeTopic}` : "",
    memory.informationNeed ? `Information need: ${memory.informationNeed}` : "",
    memory.activeEntity ? `Entity: ${memory.activeEntity}` : "",
    memory.resourceType ? `Resource: ${memory.resourceType}${memory.currentItem ? ` ${memory.currentItem}` : ""}` : "",
    memory.lastSearchQuery ? `Last resource query: ${memory.lastSearchQuery}` : "",
    topics.length ? `Earlier topics: ${topics.join(" | ")}` : "",
  ].filter(Boolean).join("\n");
}
