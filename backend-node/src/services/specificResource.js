import { searchYoutubeVideos } from "./youtubeSearch.js";

const URL_RE = /https?:\/\/[^\s<>"')]+/i;
const NUMBER_RE = /\b(?:lectures?|lect|episodes?|eps?|parts?|weeks?|classes?|sessions?|videos?)\s*#?\s*0*(\d{1,3})\b/i;
const CREATOR_RE = /\b(?:by|from|channel|creator|instructor|teacher)\s+([a-z0-9][\w.&'’-]*(?:\s+[a-z0-9][\w.&'’-]*){0,4})/i;
const QUOTED_RE = /["“]([^"”]{3,140})["”]|'([^']{3,140})'/;

const STOP = new Set([
  "a", "an", "the", "me", "my", "you", "your", "please", "can", "could", "would", "should",
  "show", "play", "watch", "find", "give", "get", "want", "need", "like", "open", "send",
  "suggest", "recommend", "regarding", "about", "online", "link", "this", "that", "these",
  "those", "for", "of", "on", "to", "in", "and", "or", "with", "via", "some", "any", "one",
  "good", "best", "video", "videos", "youtube", "tutorial", "tutorials", "lecture", "lectures",
  "playlist", "playlists", "episode", "episodes", "part", "parts", "week", "weeks", "course",
  "courses", "github", "repository", "repo", "article", "articles", "blog", "post", "docs",
  "documentation", "guide", "series", "from", "by", "channel",
]);

function cleanUrl(raw) {
  return String(raw || "").replace(/[.,!?;:]+$/g, "");
}

function clip(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function contentTokens(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .map((token) => token.trim())
    .filter((token) => token && token.length > 1 && !STOP.has(token) && !/^\d+$/.test(token));
}

function extractCreator(text) {
  const match = String(text || "").match(CREATOR_RE);
  if (!match) return "";
  return match[1]
    .replace(/\b(?:lecture|lectures|episode|episodes|part|parts|week|weeks|playlist|playlists|video|videos|tutorial|tutorials|on|about|regarding).*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNumber(text) {
  const match = String(text || "").match(NUMBER_RE);
  return match ? String(Number(match[1])) : "";
}

function classifyDirectUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "article";
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    return parsed.searchParams.get("list") && !parsed.searchParams.get("v") && host !== "youtu.be"
      ? "playlist"
      : "video";
  }
  if (host === "github.com") return "github";
  return "article";
}

export function detectSpecificResource(message) {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (!text) return { wanted: false };

  const urlMatch = text.match(URL_RE);
  if (urlMatch) {
    const url = cleanUrl(urlMatch[0]);
    const type = classifyDirectUrl(url);
    return {
      wanted: true,
      directUrl: url,
      type,
      creator: extractCreator(text),
      number: extractNumber(text),
      title: "",
      query: text,
    };
  }

  const creator = extractCreator(text);
  const number = extractNumber(text);
  const quoted = text.match(QUOTED_RE);
  const title = clip(quoted?.[1] || quoted?.[2] || "", 140);
  const github = /\b(github|git\s*hub|repositor(?:y|ies)|repos?)\b/i.test(text);
  const article = /\b(articles?|blog(?:\s+posts?)?|documentation|docs|write-?ups?|guides?)\b/i.test(text)
    && !/\b(videos?|youtube|lectures?|playlists?|tutorials?)\b/i.test(text);
  const playlist = /\bplaylists?\b/i.test(text) || (/\b(full|complete)\s+courses?\b/i.test(text) && !number);
  const lecture = /\b(lectures?|episodes?|parts?|weeks?|sessions?)\b/i.test(text);
  const video = /\b(videos?|tutorials?|youtube|watch|play)\b/i.test(text) || lecture;
  const tokens = contentTokens(text);
  const named = Boolean(creator || title || tokens.length);

  if (github && named) {
    return { wanted: true, type: "github", creator, number, title, query: buildSearchQuery({ creator, title, number, text }) };
  }
  if (article && named) {
    return { wanted: true, type: "article", creator, number, title, query: buildSearchQuery({ creator, title, number, text }) };
  }
  if ((lecture && number && named) || (lecture && (creator || title)) || (playlist && named) || ((video || lecture) && (creator || title || (number && tokens.length)))) {
    return {
      wanted: true,
      type: playlist ? "playlist" : "video",
      creator,
      number,
      title,
      query: buildSearchQuery({ creator, title, number, text, playlist }),
    };
  }
  return { wanted: false };
}

function buildSearchQuery({ creator, title, number, text, playlist = false }) {
  const parts = [];
  if (creator) parts.push(creator);
  if (title) parts.push(title);
  const tokens = contentTokens(text).filter((token) => !contentTokens(creator).includes(token) && !contentTokens(title).includes(token));
  if (tokens.length) parts.push(tokens.slice(0, 8).join(" "));
  if (number) parts.push(`lecture ${number}`);
  if (playlist) parts.push("playlist");
  const query = parts.join(" ").replace(/\s+/g, " ").trim();
  return query || contentTokens(text).slice(0, 8).join(" ");
}

function haystack(item) {
  return `${item?.title || ""} ${item?.channel || ""} ${item?.description || ""} ${item?.url || ""}`.toLowerCase();
}

function hasWholeNumber(text, number) {
  if (!number) return true;
  return new RegExp(`(?<![0-9])0*${number}(?![0-9])`).test(String(text || ""));
}

function tokenHits(tokens, text) {
  const hay = String(text || "").toLowerCase();
  return tokens.filter((token) => hay.includes(token));
}

function scoreCandidate(item, spec) {
  const hay = haystack(item);
  const title = String(item?.title || "");
  const creatorTokens = contentTokens(spec.creator);
  const titleTokens = contentTokens(spec.title);
  const queryTokens = contentTokens(spec.query);
  const creatorHit = tokenHits(creatorTokens, hay);
  const titleHit = tokenHits(titleTokens, `${title} ${item?.description || ""}`);
  const queryHit = tokenHits(queryTokens, hay);
  const numberOk = !spec.number || hasWholeNumber(title, spec.number);
  let score = creatorHit.length * 8 + titleHit.length * 6 + queryHit.length * 3;
  if (spec.number && numberOk) score += 14;
  if (spec.number && !numberOk) score -= 8;
  const creatorOk = !creatorTokens.length || creatorHit.length === creatorTokens.length;
  const quotedOk = !titleTokens.length || titleHit.length >= Math.ceil(titleTokens.length * 0.7);
  const distinctive = queryTokens.filter((token) => token.length > 2);
  const distinctiveHit = tokenHits(distinctive, hay);
  const overlapOk = distinctiveHit.length >= Math.min(2, Math.max(distinctive.length, 1))
    || (creatorHit.length > 0 && (!spec.number || numberOk))
    || (spec.number && numberOk && distinctiveHit.length > 0);
  const exact = creatorOk && quotedOk && numberOk && overlapOk && score > 0
    && (creatorTokens.length > 0 || titleTokens.length > 0 || distinctiveHit.length > 0);
  return { score, exact, verified: score > 0 && overlapOk };
}

function pickBest(items, spec) {
  const ranked = (items || [])
    .map((item) => ({ item, ...scoreCandidate(item, spec) }))
    .filter((row) => row.verified)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  const exact = ranked.find((row) => row.exact);
  return { match: (exact || ranked[0]).item, exact: Boolean(exact) };
}

function linkCard(item) {
  return {
    kind: "link",
    videoId: clip(item.id || item.url, 80),
    title: clip(item.title, 160),
    url: item.url,
    channel: clip(item.source, 80),
    description: clip(item.description, 280),
    reason: clip(item.reason, 160),
    thumbnail: "",
    embedUrl: "",
  };
}

function requestedLabel(spec) {
  const bits = [];
  if (spec.title) bits.push(spec.title);
  if (spec.creator) bits.push(`by ${spec.creator}`);
  if (spec.number) bits.push(`lecture ${spec.number}`);
  if (spec.type === "github") bits.push("GitHub repository");
  else if (spec.type === "article") bits.push("article");
  else if (spec.type === "playlist") bits.push("playlist");
  else bits.push("video");
  return bits.join(" ").replace(/\s+/g, " ").trim();
}

function resultCopy(spec, item, exact) {
  const name = clip(item?.title, 160) || "a verified result";
  const who = item?.channel || item?.source ? ` from ${item.channel || item.source}` : "";
  const asked = requestedLabel(spec);
  if (exact) {
    const answer = `Here is the ${spec.type === "github" ? "repository" : spec.type === "article" ? "article" : spec.type === "playlist" ? "playlist" : "video"} you asked for: ${name}${who}.`;
    return { answer, speechText: `Here is the ${spec.type === "github" ? "repository" : "resource"} you asked for: ${name}.` };
  }
  const answer = `I could not verify an exact match for ${asked}. The closest verified result is ${name}${who}.`;
  return {
    answer,
    speechText: `I could not verify an exact match. The closest verified result is ${name}.`,
  };
}

function emptyCopy(spec) {
  const asked = requestedLabel(spec);
  const answer = `I could not find a verified ${asked}. I am not going to invent a link.`;
  return { answer, speechText: "I could not find a verified match, so I will not invent a link." };
}

function payload(spec, item, exact) {
  const copy = item ? resultCopy(spec, item, exact) : emptyCopy(spec);
  const videos = [];
  if (item?.embedUrl || item?.kind === "video" || item?.kind === "playlist") videos.push(item);
  else if (item?.url) videos.push(linkCard(item));
  return {
    success: true,
    answer: copy.answer,
    speechText: copy.speechText,
    topic: clip(spec.title || spec.query || spec.creator, 80),
    followUpQuestion: "",
    needsWebSearch: false,
    videos,
    videosExhausted: videos.length === 0,
  };
}

async function fetchJson(url, signal, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.("abort", onAbort);
  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}

function youtubeCardFromOembed(url, data, type) {
  const title = clip(data?.title, 160);
  if (!title) return null;
  let videoId = "";
  let playlistId = "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname.replace(/^www\./, "") === "youtu.be") videoId = parsed.pathname.slice(1).split("/")[0];
    videoId = videoId || parsed.searchParams.get("v") || "";
    playlistId = parsed.searchParams.get("list") || "";
  } catch {
    return null;
  }
  if (type === "playlist" && playlistId) {
    return {
      kind: "playlist",
      videoId: playlistId,
      playlistId,
      title,
      channel: clip(data?.author_name, 80),
      description: "",
      thumbnail: data?.thumbnail_url || "",
      url: `https://www.youtube.com/playlist?list=${playlistId}`,
      embedUrl: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(playlistId)}`,
    };
  }
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
  return {
    kind: "video",
    videoId,
    title,
    channel: clip(data?.author_name, 80),
    description: "",
    thumbnail: data?.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0`,
  };
}

async function resolveDirect(spec, signal) {
  if (spec.type === "video" || spec.type === "playlist") {
    const data = await fetchJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(spec.directUrl)}`, signal);
    const card = data ? youtubeCardFromOembed(spec.directUrl, data, spec.type) : null;
    if (!card) return payload(spec, null, false);
    const check = scoreCandidate(card, spec);
    const exact = !spec.creator && !spec.number && !spec.title ? true : check.exact;
    return payload(spec, card, exact);
  }
  if (spec.type === "github") {
    let parsed;
    try { parsed = new URL(spec.directUrl); } catch { return payload(spec, null, false); }
    const [, owner, repo] = parsed.pathname.split("/");
    const data = owner && repo
      ? await fetchJson(`https://api.github.com/repos/${owner}/${repo}`, signal, {
        Accept: "application/vnd.github+json",
        "User-Agent": "InterviewIQ",
      })
      : null;
    if (!data?.html_url) return payload(spec, null, false);
    return payload(spec, {
      title: data.full_name || `${owner}/${repo}`,
      url: data.html_url,
      source: data.owner?.login || "GitHub",
      description: data.description || "",
      id: data.full_name,
    }, true);
  }
  const ok = await fetch(spec.directUrl, { method: "GET", redirect: "follow", signal }).then((response) => response.ok).catch(() => false);
  if (!ok) return payload(spec, null, false);
  return payload(spec, {
    title: spec.directUrl,
    url: spec.directUrl,
    source: "Web",
    description: "",
    id: spec.directUrl,
  }, true);
}

async function searchGithub(spec, signal) {
  const q = encodeURIComponent(spec.query || spec.title || spec.creator);
  if (!q) return [];
  const data = await fetchJson(`https://api.github.com/search/repositories?q=${q}&per_page=5&sort=stars`, signal, {
    Accept: "application/vnd.github+json",
    "User-Agent": "InterviewIQ",
  });
  return (data?.items || []).map((item) => ({
    title: item.full_name,
    url: item.html_url,
    source: item.owner?.login || "GitHub",
    channel: item.owner?.login || "",
    description: item.description || "",
    id: item.full_name,
  }));
}

async function searchArticles(spec, signal) {
  const q = encodeURIComponent(spec.query || spec.title || "");
  if (!q) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.("abort", onAbort);
  try {
    const response = await fetch(`https://lite.duckduckgo.com/lite/?q=${q}`, {
      signal: controller.signal,
      headers: { "User-Agent": "InterviewIQ" },
    });
    if (!response.ok) return [];
    const html = await response.text();
    const found = [];
    const re = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*class="[^"]*result-link[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = re.exec(html)) && found.length < 5) {
      const url = cleanUrl(match[1]);
      if (/duckduckgo\.com/i.test(url)) continue;
      const title = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!title || !url) continue;
      found.push({ title, url, source: safeHost(url), channel: safeHost(url), description: "", id: url });
    }
    return found;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}

function safeHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Web"; }
}

export async function resolveSpecificResource(spec, { signal } = {}) {
  if (!spec?.wanted) return null;
  if (spec.directUrl) return resolveDirect(spec, signal);
  if (spec.type === "github") {
    const picked = pickBest(await searchGithub(spec, signal), spec);
    return payload(spec, picked?.match || null, Boolean(picked?.exact));
  }
  if (spec.type === "article") {
    const picked = pickBest(await searchArticles(spec, signal), spec);
    return payload(spec, picked?.match || null, Boolean(picked?.exact));
  }
  const results = spec.query
    ? await searchYoutubeVideos({
      query: spec.query,
      topic: spec.query,
      kind: spec.type === "playlist" ? "playlist" : "video",
      limit: 8,
      maxCap: 8,
      signal,
    })
    : [];
  const picked = pickBest(results, spec);
  return payload(spec, picked?.match || null, Boolean(picked?.exact));
}
