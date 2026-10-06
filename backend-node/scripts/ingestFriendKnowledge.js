import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getSupabaseAdmin } from "../src/config/supabase.js";
import { env } from "../src/config/env.js";
import {
  FRIEND_EMBEDDING_DIMENSION,
  FRIEND_EMBEDDING_MODEL,
  embedFriendDocument
} from "../src/services/friendEmbeddings.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "src", "data", "friendKnowledge.json");
const table = "interview_friend_knowledge";

function redact(message) {
  const raw = String(message || "Knowledge ingestion failed");
  const secrets = [env.geminiApiKey, env.supabaseServiceRoleKey, env.supabaseUrl].filter(Boolean);
  const cleaned = secrets.reduce((text, secret) => text.split(secret).join("[redacted]"), raw);
  return cleaned.replace(/key=[^&\s]+/gi, "key=[redacted]").slice(0, 400);
}

function fail(error) {
  const err = new Error(redact(error?.message || error));
  err.statusCode = error?.statusCode || 500;
  return err;
}

function chunkText(text, size = 480) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const chunks = [];
  let current = [];
  let length = 0;
  for (const word of words) {
    if (length + word.length > size && current.length) {
      chunks.push(current.join(" "));
      current = [];
      length = 0;
    }
    current.push(word);
    length += word.length + 1;
  }
  if (current.length) chunks.push(current.join(" "));
  return chunks;
}

function vectorLength(value) {
  if (Array.isArray(value)) return value.length;
  if (typeof value !== "string") return 0;
  const inner = value.trim().replace(/^\[|\]$/g, "");
  if (!inner) return 0;
  return inner.split(",").filter(Boolean).length;
}

const raw = JSON.parse(await readFile(target, "utf8"));
const docs = Array.isArray(raw) ? raw : [];
const updatedAt = new Date().toISOString();
const next = [];
for (const doc of docs) {
  const parts = chunkText(doc.content);
  parts.forEach((content, index) => {
    next.push({
      title: doc.title,
      source: doc.source || "InterviewIQ",
      category: doc.category || "product",
      url: doc.url || "",
      content,
      updatedAt,
      chunk: index + 1,
    });
  });
}

if (!next.length) {
  throw new Error("No Interview Friend knowledge chunks were produced.");
}

const rows = [];
for (const item of next) {
  let values;
  try {
    values = await embedFriendDocument(item.title, item.content);
  } catch (error) {
    throw fail(error);
  }
  rows.push({
    title: item.title,
    source: item.source,
    category: item.category,
    url: item.url,
    content: item.content,
    chunk: item.chunk,
    metadata: {
      updatedAt: item.updatedAt,
      model: FRIEND_EMBEDDING_MODEL,
      dimensions: FRIEND_EMBEDDING_DIMENSION
    },
    embedding: `[${values.join(",")}]`
  });
}

const supabase = getSupabaseAdmin();
const { data: inserted, error: insertError } = await supabase
  .from(table)
  .insert(rows)
  .select("id, embedding, metadata");
if (insertError) throw fail(insertError);

const insertedIds = new Set((inserted || []).map((row) => row.id));
const { data: existing, error: readError } = await supabase.from(table).select("id");
if (readError) throw fail(readError);
const staleIds = (existing || []).map((row) => row.id).filter((id) => !insertedIds.has(id));
if (staleIds.length) {
  const { error: deleteError } = await supabase.from(table).delete().in("id", staleIds);
  if (deleteError) throw fail(deleteError);
}

const { data: stored, error: verifyError } = await supabase
  .from(table)
  .select("id, embedding");
if (verifyError) throw fail(verifyError);

const populated = (stored || []).filter((row) => vectorLength(row.embedding) === FRIEND_EMBEDDING_DIMENSION);
if (populated.length !== rows.length || (stored || []).length !== rows.length) {
  throw new Error(`Supabase verification failed: expected ${rows.length} embeddings of ${FRIEND_EMBEDDING_DIMENSION} dimensions, found ${populated.length}.`);
}

await writeFile(target, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Embedded ${rows.length} chunks with ${FRIEND_EMBEDDING_MODEL} (${FRIEND_EMBEDDING_DIMENSION}).`);
console.log(`Inserted ${inserted?.length || 0} rows into ${table}.`);
console.log(`Verified ${populated.length} populated embeddings with dimension ${FRIEND_EMBEDDING_DIMENSION}.`);
