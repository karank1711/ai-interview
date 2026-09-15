import { env } from "../config/env.js";

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const SEARCH_TIMEOUT_MS = 8000;

const VIDEO_INTENT_RE =
  /\b(youtube|yt\b|video|videos|playlist|playlists|channel|channels|tutorial|tutorials|screencast|clip|watch|course|courses|resource|resources)\b/i;
const HINGLISH_RESOURCE_RE =
  /\b(playlist|playlists?|youtube|video|videos?|channel|tutorial|course|resources?|dikhao|dikhaao)\b/i;
const EXPLAIN_LANGUAGE_RE =
  /\b(explain|teach|show|learn|describe)\b[\s\S]{0,100}\b(?:in\s+)?(hindi|english|tamil|telugu|kannada|malayalam|marathi|bengali|spanish|french|german|arabic|urdu|japanese|korean|chinese|हिंदी|हिन्दी)\b/i;
const REFRESH_VIDEO_RE =
  /\b((show me |give me )?(another|different|next|other) videos?|more videos?|not like (this|that|these) videos?|(this|that|these) videos? (is|are) n[o']?t good|replace (the|these) videos?)\b/i;

export function detectRefreshVideoIntent(message) {
  return REFRESH_VIDEO_RE.test(String(message || ""));
}

const LANGUAGE_HINTS = [
  { key: "hi", labels: ["hindi", "हिंदी", "हिन्दी"], relevance: "hi" },
  { key: "ta", labels: ["tamil"], relevance: "ta" },
  { key: "te", labels: ["telugu"], relevance: "te" },
  { key: "kn", labels: ["kannada"], relevance: "kn" },
  { key: "ml", labels: ["malayalam"], relevance: "ml" },
  { key: "mr", labels: ["marathi"], relevance: "mr" },
  { key: "bn", labels: ["bengali", "bangla"], relevance: "bn" },
  { key: "es", labels: ["spanish"], relevance: "es" },
  { key: "fr", labels: ["french"], relevance: "fr" },
  { key: "de", labels: ["german"], relevance: "de" },
  { key: "ar", labels: ["arabic"], relevance: "ar" },
  { key: "ur", labels: ["urdu"], relevance: "ur" },
  { key: "ja", labels: ["japanese"], relevance: "ja" },
  { key: "ko", labels: ["korean"], relevance: "ko" },
  { key: "zh", labels: ["chinese", "mandarin"], relevance: "zh-Hans" },
  { key: "en", labels: ["english"], relevance: "en" },
];

function normalizeIntentText(message) {
  return String(message || "")
    .replace(/play\s*lists?/gi, "playlist")
    .replace(/\s+/g, " ")
    .trim();
}

const PLAYLIST_KIND_RE =
  /\b(playlist|full course|complete course|complete playlist|puri playlist|poori playlist|series)\b/i;
const CHANNEL_KIND_RE = /\b(channels?|best channels)\b/i;
const VIDEO_KIND_RE = /\b(videos?|clips?)\b/i;
const COURSE_KIND_RE = /\b(tutorials?|courses?|resources?)\b/i;

export function detectVideoSearchIntent(message) {
  const original = String(message || "").trim();
  const text = normalizeIntentText(original);
  if (!text) {
    return { wanted: false, refresh: false, language: "", difficulty: "", query: "", topic: "", kind: "video", limit: 3 };
  }
  const refresh = detectRefreshVideoIntent(text);
  const wanted = refresh || VIDEO_INTENT_RE.test(text) || HINGLISH_RESOURCE_RE.test(text) || PLAYLIST_KIND_RE.test(text) || EXPLAIN_LANGUAGE_RE.test(text);
  if (!wanted) {
    return { wanted: false, refresh: false, language: "", difficulty: "", query: "", topic: "", kind: "video", limit: 3 };
  }
  const lower = text.toLowerCase();
  const kind = detectResourceKind(lower);
  const limit = resourceLimitForKind(kind, original.toLowerCase());
  const extracted = extractResourceTopic(text);
  let language = extracted.language || detectLanguage(text);
  if (!language && /\b(mujhe|batao|samajh|sikh|hindi|acchi|achhi|chahiye|chahie|jisne|karvaya)\b/i.test(lower)) {
    language = "hi";
  }
  const difficulty = extracted.difficulty || detectDifficulty(text);
  const referential = isReferentialResourceRequest(text);
  const topic = referential || extracted.uncertain || isGenericResourceTopic(extracted.topic) ? "" : extracted.topic;
  return {
    wanted: true,
    refresh,
    language,
    difficulty,
    topic,
    query: refresh || !topic ? "" : buildYoutubeQuery(text, kind),
    kind,
    limit,
    uncertain: extracted.uncertain || referential || !topic,
    referential,
  };
}

function detectResourceKind(lower) {
  if (PLAYLIST_KIND_RE.test(lower)) return "playlist";
  if (CHANNEL_KIND_RE.test(lower)) return "channel";
  if (VIDEO_KIND_RE.test(lower)) return "video";
  if (COURSE_KIND_RE.test(lower)) {
    if (/\b(complete|full|beginner se advanced|beginner to advanced)\b/i.test(lower)) return "playlist";
    return "video";
  }
  return "video";
}

function resourceLimitForKind(kind, originalLower) {
  if (kind === "channel") return 3;
  if (kind === "playlist") {
    if (
      /\bplay\s*lists\b/i.test(originalLower)
      || /\bbest playlists?\b/i.test(originalLower)
      || /\brecommendations?\b/i.test(originalLower)
    ) {
      return 3;
    }
    return 1;
  }
  if (/\b(one|1|single|ek)\b.{0,24}\b(video|tutorial)\b/i.test(originalLower)
    || /\b(best video|ek video|one video|single video)\b/i.test(originalLower)) {
    return 1;
  }
  return 3;
}

function detectLanguage(text) {
  const lower = text.toLowerCase();
  for (const item of LANGUAGE_HINTS) {
    if (item.labels.some((label) => lower.includes(label))) return item.key;
  }
  return "";
}

function detectDifficulty(text) {
  const lower = String(text || "").toLowerCase();
  if (/\b(simple|simply|beginner|basics?|easy|intro|introduction|for kids|from scratch|scratch|zero se|shuru se)\b/i.test(lower)) {
    return "beginner";
  }
  if (/\b(advanced|in[- ]depth|expert|detailed)\b/i.test(lower)) return "advanced";
  return "intermediate";
}

const FILLER_PHRASES = [
  "suggest karo",
  "ek acchi",
  "ek achhi",
  "koi acchi",
  "koi achhi",
  "ek do",
  "de do",
  "karvaya hun",
  "karvaya hoon",
  "karvaya ho",
  "karva rakha ho",
  "karva rakha",
  "karna hai",
  "samajhna hai",
  "sikhana hai",
  "can you",
  "could you",
  "give me",
  "show me",
  "i want",
  "i need",
  "find me",
];

const FILLER_WORDS = new Set([
  "ek", "do", "koi", "acchi", "achhi", "mujhe", "please", "batao", "chahiye", "chahie",
  "de", "karo", "jisne", "jisme", "jisko", "jo", "hun", "hoon", "ho", "hai", "hain",
  "se", "ki", "ka", "ke", "mein", "main", "yeh", "woh", "wala", "wali", "karvaya",
  "karva", "rakha", "karna", "samajhna", "sikhana", "dikhao", "dikhaao", "watch",
  "a", "an", "the", "me", "my", "your", "our", "some", "any", "one", "good",
  "best", "nice", "related", "regarding", "about", "around", "for", "on", "to",
  "with", "from", "of", "in", "and", "or", "this", "that", "these", "those", "it",
  "its", "topic", "subject", "thing", "one", "suggest", "suggested", "suggestion",
  "recommend", "recommended", "recommendation", "recommendations", "want", "need",
  "like", "would", "could", "should", "can", "you", "regarding",
]);

const GENERIC_TOPIC_RE =
  /^(programming|coding|code|tech|technology|computer|computers|software|latest|latest tech|latest tech videos?|programming videos?|coding videos?|tech videos?|videos?|tutorials?|resources?|courses?|youtube|topic|this|that|it)$/i;

export function isGenericResourceTopic(topic) {
  const t = String(topic || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!t) return true;
  if (GENERIC_TOPIC_RE.test(t)) return true;
  if (/^(this|that|the|same)\s+(topic|one|subject|thing)$/.test(t)) return true;
  if (/^(latest|popular|trending)\s+(tech|programming|coding|youtube)?(\s+videos?)?$/.test(t)) return true;
  return false;
}

export function isReferentialResourceRequest(message) {
  const text = String(message || "");
  if (/\b(this topic|that topic|the (same )?topic|this subject|that subject|same topic|this one|that one|regarding (this|it|that)|about (this|it|that)|on (this|it|that)|for (this|it|that)|us topic|is topic|iske baare|ispe|uspe)\b/i.test(text)) {
    return true;
  }
  const extracted = extractResourceTopic(text);
  return VIDEO_INTENT_RE.test(text) && extracted.uncertain;
}

const KEEP_TERMS = [
  "web development",
  "from scratch",
  "machine learning",
  "data structures",
  "computer science",
  "front end",
  "frontend",
  "back end",
  "backend",
  "full stack",
  "fullstack",
  "html",
  "css",
  "javascript",
  "typescript",
  "react",
  "mern",
  "node",
  "python",
  "java",
  "dsa",
  "sql",
  "beginner",
  "advanced",
];

export function extractResourceTopic(message) {
  let text = normalizeIntentText(message).toLowerCase();
  text = text
    .replace(/\b(scratch|zero|shuru|basics?)\s+se(?:\s+karvaya(?:\s+hun|\s+hoon|\s+ho)?)?/gi, " from scratch ")
    .replace(/\bfrom\s+scratch\b/gi, " from scratch ");

  for (const phrase of FILLER_PHRASES) {
    text = text.replace(new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "gi"), " ");
  }

  text = text
    .replace(VIDEO_INTENT_RE, " ")
    .replace(HINGLISH_RESOURCE_RE, " ")
    .replace(PLAYLIST_KIND_RE, " ")
    .replace(/\b(hindi|english|हिंदी|हिन्दी)\b/gi, " ")
    .replace(/[.,!?;:'"]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const kept = [];
  const seen = new Set();
  for (const term of KEEP_TERMS) {
    const re = new RegExp(`\\b${term.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (re.test(text) && !seen.has(term)) {
      seen.add(term);
      kept.push(term);
      text = text.replace(re, " ");
    }
  }

  const leftovers = text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && !FILLER_WORDS.has(token) && token.length > 1 && !/^\d+$/.test(token));

  const topic = [...kept, ...leftovers]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const uncertain = !topic || isGenericResourceTopic(topic);
  return {
    topic: uncertain ? "" : topic,
    language: detectLanguage(message) || (/\b(mujhe|acchi|achhi|jisne|chahiye|batao|karvaya)\b/i.test(message) ? "hi" : ""),
    difficulty: detectDifficulty(`${message} ${topic}`),
    uncertain,
  };
}

export function buildYoutubeQuery(message, kind = "video") {
  const extracted = extractResourceTopic(message);
  return composeYoutubeQuery(extracted.topic, extracted, kind);
}

export function composeYoutubeQuery(topic, extracted = {}, kind = "video") {
  const clean = String(topic || "").replace(/\s+/g, " ").trim();
  if (!clean || isGenericResourceTopic(clean)) return "";
  const language = extracted.language || "";
  const langLabel = LANGUAGE_HINTS.find((item) => item.key === language)?.labels[0] || "";
  const parts = [clean];
  if (extracted.difficulty === "beginner" && !/\bbeginner\b/i.test(clean) && !/\bfrom scratch\b/i.test(clean)) {
    parts.push("beginner");
  }
  if (extracted.difficulty === "advanced" && !/\badvanced\b/i.test(clean)) {
    parts.push("advanced");
  }
  if (langLabel && !new RegExp(`\\b${langLabel}\\b`, "i").test(clean)) parts.push(langLabel);
  if (kind === "playlist") parts.push("complete playlist");
  else if (kind === "channel") parts.push("channel");
  else if (!/\b(explained|tutorial)\b/i.test(clean)) parts.push("explained");
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 180);
}

function resourceId(raw) {
  return String(raw?.videoId || raw?.playlistId || raw?.channelId || "").trim();
}

function normalizeVideo(raw) {
  const kind = String(raw?.kind || (raw?.playlistId ? "playlist" : raw?.channelId ? "channel" : "video"));
  const title = String(raw?.title || "").replace(/\s+/g, " ").trim();
  if (!title) return null;
  const channel = String(raw?.channel || "").replace(/\s+/g, " ").trim();
  const description = String(raw?.description || "").replace(/\s+/g, " ").trim().slice(0, 280);
  const reason = String(raw?.reason || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (kind === "playlist") {
    const playlistId = String(raw?.playlistId || "").trim();
    if (!playlistId) return null;
    return {
      kind: "playlist",
      videoId: playlistId,
      playlistId,
      title: title.slice(0, 160),
      thumbnail: String(raw?.thumbnail || "").trim(),
      channel: channel.slice(0, 80),
      description,
      reason: reason || "Full playlist for this topic.",
      itemCount: Number(raw?.itemCount) > 0 ? Number(raw.itemCount) : 0,
      url: `https://www.youtube.com/playlist?list=${playlistId}`,
      embedUrl: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(playlistId)}`,
    };
  }
  if (kind === "channel") {
    const channelId = String(raw?.channelId || "").trim();
    if (!channelId) return null;
    return {
      kind: "channel",
      videoId: channelId,
      channelId,
      title: title.slice(0, 160),
      thumbnail: String(raw?.thumbnail || "").trim(),
      channel: (channel || title).slice(0, 80),
      description,
      reason: reason || "Useful channel for this topic.",
      url: `https://www.youtube.com/channel/${channelId}`,
      embedUrl: "",
    };
  }
  const videoId = String(raw?.videoId || "").trim();
  if (!VIDEO_ID_RE.test(videoId)) return null;
  return {
    kind: "video",
    videoId,
    title: title.slice(0, 160),
    thumbnail: String(raw?.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`).trim(),
    channel: channel.slice(0, 80),
    description,
    reason: reason || "Matches the requested topic.",
    url: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0`,
  };
}

function scoreVideo(video, { query, language, difficulty }) {
  const hay = `${video.title} ${video.channel} ${video.description}`.toLowerCase();
  const tokens = String(query || "").toLowerCase().split(/\s+/).filter((token) => token.length > 2);
  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) score += 3;
  }
  const lang = LANGUAGE_HINTS.find((item) => item.key === language);
  if (lang && lang.labels.some((label) => hay.includes(label))) score += 8;
  if (difficulty === "beginner" && /\b(beginner|basics|simple|introduction|explained)\b/i.test(hay)) score += 4;
  if (difficulty === "advanced" && /\b(advanced|deep dive|complete)\b/i.test(hay)) score += 3;
  if (/\b(shorts?|#shorts)\b/i.test(hay)) score -= 6;
  return score;
}

function pickTop(videos, hints, { excludeIds = [], limit = 3 } = {}) {
  const blocked = new Set((excludeIds || []).map((id) => String(id)));
  const cap = Math.min(3, Math.max(1, Number(limit) || 3));
  return (videos || [])
    .map(normalizeVideo)
    .filter(Boolean)
    .filter((video) => !blocked.has(resourceId(video)))
    .map((video) => ({ video, score: scoreVideo(video, hints) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, cap)
    .map((item) => item.video);
}

function pickBest(videos, hints) {
  return pickTop(videos, hints, { limit: 1 })[0] || null;
}

async function searchViaDataApi(query, language, signal, kind = "video") {
  const type = kind === "playlist" ? "playlist" : kind === "channel" ? "channel" : "video";
  const params = new URLSearchParams({
    part: "snippet",
    type,
    maxResults: "15",
    q: query,
    safeSearch: "moderate",
    key: env.youtubeApiKey,
  });
  const lang = LANGUAGE_HINTS.find((item) => item.key === language);
  if (lang?.relevance) params.set("relevanceLanguage", lang.relevance);
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal });
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.items || []).map((item) => ({
    kind: type,
    videoId: item?.id?.videoId,
    playlistId: item?.id?.playlistId,
    channelId: item?.id?.channelId || item?.snippet?.channelId,
    title: item?.snippet?.title,
    thumbnail:
      item?.snippet?.thumbnails?.medium?.url
      || item?.snippet?.thumbnails?.high?.url
      || item?.snippet?.thumbnails?.default?.url,
    channel: item?.snippet?.channelTitle,
    description: item?.snippet?.description,
  }));
}

function parseItemCount(raw) {
  const n = Number(String(raw || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function pushPlaylist(found, raw) {
  const playlistId = String(raw?.playlistId || "").trim();
  if (!playlistId) return;
  found.push({
    kind: "playlist",
    playlistId,
    title: raw.title || "",
    thumbnail: raw.thumbnail || "",
    channel: raw.channel || "",
    description: raw.description || "",
    itemCount: parseItemCount(raw.itemCount),
  });
}

function collectVideoRenderers(node, found) {
  if (!node || found.length >= 24) return;
  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, found);
    return;
  }
  if (typeof node !== "object") return;
  const renderer = node.videoRenderer || node.compactVideoRenderer;
  if (renderer?.videoId) {
    found.push({
      kind: "video",
      videoId: renderer.videoId,
      title: renderer.title?.runs?.map((run) => run.text).join("") || renderer.title?.simpleText,
      thumbnail: renderer.thumbnail?.thumbnails?.slice(-1)?.[0]?.url,
      channel:
        renderer.ownerText?.runs?.[0]?.text
        || renderer.shortBylineText?.runs?.[0]?.text
        || "",
      description:
        renderer.descriptionSnippet?.runs?.map((run) => run.text).join("")
        || "",
    });
  }
  const playlist = node.playlistRenderer || node.gridPlaylistRenderer;
  if (playlist?.playlistId) {
    pushPlaylist(found, {
      playlistId: playlist.playlistId,
      title: playlist.title?.runs?.map((run) => run.text).join("") || playlist.title?.simpleText,
      thumbnail: playlist.thumbnails?.[0]?.thumbnails?.slice(-1)?.[0]?.url
        || playlist.thumbnailRenderer?.playlistVideoThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url,
      channel: playlist.shortBylineText?.runs?.[0]?.text || playlist.longBylineText?.runs?.[0]?.text || "",
      itemCount: playlist.videoCount || playlist.videoCountShort?.simpleText,
    });
  }
  const lockup = node.lockupViewModel;
  if (lockup && /PLAYLIST/i.test(String(lockup.contentType || ""))) {
    pushPlaylist(found, {
      playlistId: lockup.contentId,
      title: lockup.metadata?.lockupMetadataViewModel?.title?.content,
      thumbnail: lockup.contentImage?.thumbnailViewModel?.image?.sources?.slice(-1)?.[0]?.url,
      channel: lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content,
      itemCount: lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[1]?.metadataParts?.[0]?.text?.content,
    });
  }
  const channel = node.channelRenderer;
  if (channel?.channelId) {
    found.push({
      kind: "channel",
      channelId: channel.channelId,
      title: channel.title?.simpleText || channel.title?.runs?.map((run) => run.text).join(""),
      thumbnail: channel.thumbnail?.thumbnails?.slice(-1)?.[0]?.url,
      channel: channel.title?.simpleText || "",
      description: channel.descriptionSnippet?.runs?.map((run) => run.text).join("") || "",
    });
  }
  for (const value of Object.values(node)) collectVideoRenderers(value, found);
}

async function searchViaYoutubeResults(query, signal, kind = "video") {
  const params = new URLSearchParams({ search_query: query });
  if (kind === "video") params.set("sp", "EgIQAQ==");
  if (kind === "playlist") params.set("sp", "EgIQAw==");
  if (kind === "channel") params.set("sp", "EgIQAg==");
  const url = `https://www.youtube.com/results?${params.toString()}`;
  const response = await fetch(url, {
    signal,
    headers: {
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) return [];
  const html = await response.text();
  const match = html.match(/ytInitialData\s*=\s*(\{.*?\});\s*<\/script>/s);
  if (!match) return [];
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }
  const found = [];
  collectVideoRenderers(data, found);
  return found;
}

export async function searchYoutubeVideos({
  query,
  topic,
  language,
  difficulty,
  excludeIds = [],
  limit = 3,
  kind = "video",
  signal,
} = {}) {
  const q = String(query || "").trim();
  if (!q) return [];
  const scoreQuery = String(topic || q).trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.("abort", onAbort);
  try {
    let results = [];
    if (env.youtubeApiKey) {
      results = await searchViaDataApi(q, language, controller.signal, kind);
      results = results.filter((item) => item.kind === kind);
      if (kind === "playlist") results = await enrichPlaylists(results, controller.signal);
    }
    if (!results.length) {
      results = await searchViaYoutubeResults(q, controller.signal, kind);
      results = results.filter((item) => item.kind === kind);
    }
    const picked = pickTop(results, { query: scoreQuery, language, difficulty }, { excludeIds, limit });
    return picked.map((item) => ({
      ...item,
      reason: resourceReason(item, { query: scoreQuery, language, kind }),
      description: String(item.description || "").replace(/\s+/g, " ").trim().slice(0, 280)
        || resourceReason(item, { query: scoreQuery, language, kind }),
    }));
  } catch (error) {
    if (error?.name === "AbortError") return [];
    console.error("[YOUTUBE-SEARCH]", String(error.message || "search failed").slice(0, 160));
    return [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}

async function enrichPlaylists(items, signal) {
  const ids = [...new Set((items || []).map((item) => item.playlistId).filter(Boolean))].slice(0, 15);
  if (!ids.length || !env.youtubeApiKey) return items;
  try {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      id: ids.join(","),
      key: env.youtubeApiKey,
    });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/playlists?${params}`, { signal });
    if (!response.ok) return items;
    const payload = await response.json();
    const details = new Map(
      (payload.items || []).map((item) => [item.id, item])
    );
    return items.map((item) => {
      const extra = details.get(item.playlistId);
      if (!extra) return item;
      return {
        ...item,
        title: extra.snippet?.title || item.title,
        channel: extra.snippet?.channelTitle || item.channel,
        description: extra.snippet?.description || item.description,
        thumbnail:
          extra.snippet?.thumbnails?.medium?.url
          || extra.snippet?.thumbnails?.high?.url
          || extra.snippet?.thumbnails?.default?.url
          || item.thumbnail,
        itemCount: Number(extra.contentDetails?.itemCount) || item.itemCount || 0,
      };
    });
  } catch {
    return items;
  }
}

function resourceReason(item, { query, language, kind }) {
  const lang = language === "hi" ? "Hindi" : language === "en" ? "English" : "";
  const topic = String(query || "").replace(/\b(playlist|channel|tutorial|beginner|advanced|hindi|english)\b/gi, " ").replace(/\s+/g, " ").trim();
  if (kind === "playlist") return `Playlist covering ${topic || "this topic"}${lang ? ` in ${lang}` : ""}.`;
  if (kind === "channel") return `Channel for ${topic || "this topic"}${lang ? ` in ${lang}` : ""}.`;
  return `Useful ${lang ? `${lang} ` : ""}video on ${topic || "this topic"}.`.replace(/\s+/g, " ").trim();
}

export async function searchBestYoutubeVideo(options = {}) {
  const [video] = await searchYoutubeVideos({ ...options, limit: 1 });
  return video || null;
}
