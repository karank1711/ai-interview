import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getSupabaseAdmin } from "../config/supabase.js";
import { embedFriendQuery } from "./friendEmbeddings.js";

const knowledgePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../data/friendKnowledge.json");
const cache = new Map();
const WEB_TTL_MS = 10 * 60 * 1000;

function tokens(text) {
  return String(text || "").toLowerCase().split(/[^a-z0-9+#]+/).filter((token) => token.length > 2);
}

function loadKnowledge() {
  try {
    const parsed = JSON.parse(readFileSync(knowledgePath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const MATCH_COUNT = 4;
const SIMILARITY_THRESHOLD = 0.62;
const EMBED_TIMEOUT_MS = 8000;
const VECTOR_TIMEOUT_MS = 8000;

function withRetrievalTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Retrieval timed out.")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function toKnowledgeItem(row) {
  return {
    title: row.title,
    source: row.source,
    content: String(row.content || "").slice(0, 500),
    similarity: Number(row.similarity),
  };
}

function lexicalFriendKnowledge(query, limit) {
  const wanted = tokens(query);
  if (!wanted.length) return [];
  return loadKnowledge()
    .map((item) => {
      const hay = tokens(`${item.title} ${item.category} ${item.content}`);
      const score = wanted.filter((token) => hay.includes(token)).length;
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => ({
      title: row.item.title,
      source: row.item.source,
      content: String(row.item.content || "").slice(0, 500),
    }));
}

async function searchFriendVectors(queryEmbedding, matchCount) {
  const supabase = getSupabaseAdmin();
  return supabase.rpc("match_interview_friend_knowledge", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });
}

export async function retrieveFriendKnowledge(query, limit = MATCH_COUNT, deps = {}) {
  const text = String(query || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const matchCount = Math.min(5, Math.max(3, Number(limit) || MATCH_COUNT));
  const embed = deps.embed || embedFriendQuery;
  const searchVectors = deps.searchVectors || searchFriendVectors;
  try {
    const values = await withRetrievalTimeout(embed(text), EMBED_TIMEOUT_MS);
    const { data, error } = await withRetrievalTimeout(
      searchVectors(`[${values.join(",")}]`, matchCount),
      VECTOR_TIMEOUT_MS
    );
    if (error) throw error;
    return (Array.isArray(data) ? data : [])
      .map(toKnowledgeItem)
      .filter((item) => Number.isFinite(item.similarity) && item.similarity >= SIMILARITY_THRESHOLD && item.content)
      .slice(0, matchCount);
  } catch {
    return lexicalFriendKnowledge(text, matchCount);
  }
}

function cached(key) {
  const hit = cache.get(key);
  if (!hit || hit.expires < Date.now()) return null;
  return hit.value;
}

function store(key, value) {
  cache.set(key, { value, expires: Date.now() + WEB_TTL_MS });
  if (cache.size > 40) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

export async function searchFriendWeb(query, signal, options = {}) {
  const base = String(query || "").replace(/\s+/g, " ").trim().slice(0, 160);
  const q = /\b(versions?|releases?)\b/i.test(base) && !/\bofficial\b/i.test(base)
    ? `${base} official`.slice(0, 180)
    : base.slice(0, 180);
  if (!q) return [];
  const key = q.toLowerCase();
  if (!options.fresh) {
    const hit = cached(key);
    if (hit) return hit;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.("abort", onAbort);
  try {
    const response = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`, {
      signal: controller.signal,
      headers: { "User-Agent": "InterviewIQ" },
    });
    if (!response.ok) return [];
    const html = await response.text();
    const found = rankWebResults(parseWebResults(html), q).slice(0, 3);
    if (found.length) store(key, found);
    return found;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/\s+/g, " ")
    .trim();
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function decodeResultUrl(href) {
  const raw = String(href || "").replace(/&amp;/g, "&").trim();
  if (!raw) return "";
  try {
    const absolute = raw.startsWith("//") ? `https:${raw}` : raw;
    const parsed = new URL(absolute, "https://lite.duckduckgo.com");
    const wrapped = parsed.searchParams.get("uddg");
    const target = wrapped ? new URL(wrapped) : parsed;
    if (!/^https?:$/i.test(target.protocol) || /duckduckgo\.com$/i.test(target.hostname)) return "";
    return target.href;
  } catch {
    return "";
  }
}

function parseWebResults(html) {
  const results = [];
  const linkRe = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRe.exec(html)) && results.length < 8) {
    const attrs = match[1];
    if (!/result-link/i.test(attrs)) continue;
    const href = /href\s*=\s*(["'])([\s\S]*?)\1/i.exec(attrs)?.[2] || "";
    const url = decodeResultUrl(href);
    if (!url) continue;
    const title = decodeHtml(match[2]).slice(0, 140);
    if (!title) continue;
    const after = html.slice(match.index, match.index + 1800);
    const snippetMatch = /class=(["'])[^"']*result-snippet[^"']*\1[^>]*>([\s\S]*?)<\/t[dr]>/i.exec(after);
    const snippet = snippetMatch ? decodeHtml(snippetMatch[2]).slice(0, 240) : "";
    const yearMatch = `${title} ${snippet}`.match(/\b(20\d{2})\b/);
    results.push({
      title: title.slice(0, 140),
      url,
      snippet: (snippet || title).slice(0, 240),
      domain: domainOf(url),
      year: yearMatch ? Number(yearMatch[1]) : null,
    });
  }
  return results;
}

function rankWebResults(results, query) {
  const wanted = tokens(query);
  const freshQuery = /\b(latest|newest|current|today|recent|new)\b/i.test(query);
  const thisYear = new Date().getFullYear();
  return [...results].sort((left, right) => webScore(right, wanted, freshQuery, thisYear) - webScore(left, wanted, freshQuery, thisYear));
}

function webScore(item, wanted, freshQuery, thisYear) {
  const hay = `${item.title} ${item.snippet || ""}`.toLowerCase();
  let score = wanted.filter((token) => hay.includes(token)).length;
  if (/\/(docs|release|releases|changelog|blog|news|announcements?)\b/i.test(item.url)) score += 3;
  if (/^docs\./i.test(item.domain || "")) score += 3;
  if (/\.(gov|edu|int)$/i.test(item.domain || "")) score += 3;
  if (/github\.com$/i.test(item.domain || "") && /\/releases\b/i.test(item.url)) score += 2;
  if (freshQuery && item.year && item.year < thisYear - 1) score -= 2;
  if (freshQuery && /\b\d+\.\d+\b|\b(?:jdk|version|release)\s+\d{2,}\b/i.test(hay)) score += 3;
  if (wanted.some((token) => token.length > 3 && (item.domain || "").includes(token))) score += 2;
  return score;
}

export function formatRetrievedContext({ knowledge = [], web = [] } = {}) {
  const parts = [];
  if (knowledge.length) {
    parts.push(`Product notes:\n${knowledge.map((item) => `- ${item.title}: ${item.content}`).join("\n")}`);
  }
  if (web.length) {
    parts.push(`Web evidence:\n${web.map((item) => {
      const domain = item.domain ? ` [${item.domain}]` : "";
      const when = item.year ? ` (${item.year})` : "";
      const snippet = item.snippet && item.snippet !== item.title ? ` — ${item.snippet}` : "";
      return `- ${item.title}${when}${domain} (${item.url})${snippet}`;
    }).join("\n")}`);
  }
  return parts.join("\n\n").slice(0, 1800);
}

export function formatFriendKnowledgeContext(knowledge = []) {
  if (!knowledge.length) return "";
  const notes = knowledge
    .slice(0, 5)
    .map((item) => `- ${item.title}: ${item.content}`)
    .join("\n");
  return `InterviewIQ knowledge (trusted product context from retrieved notes only):
${notes}
Prefer these notes for InterviewIQ-specific questions.
Do not invent product features, scores, or behavior that these notes do not support.
If these notes do not contain the requested detail, say that detail is not available in the InterviewIQ knowledge. You may still answer any non-product part from general knowledge.
Never present a guessed product detail as a confirmed InterviewIQ feature.`.slice(0, 1800);
}
