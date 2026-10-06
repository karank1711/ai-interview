import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";

export const FRIEND_EMBEDDING_MODEL = "gemini-embedding-2";
export const FRIEND_EMBEDDING_DIMENSION = 768;

function redact(message) {
  const raw = String(message || "Embedding request failed");
  const secret = String(env.geminiApiKey || "");
  const withoutSecret = secret ? raw.split(secret).join("[redacted]") : raw;
  return withoutSecret.replace(/key=[^&\s]+/gi, "key=[redacted]").slice(0, 400);
}

function getClient() {
  if (!env.geminiApiKey) {
    const error = new Error("Gemini is not configured on the server.");
    error.statusCode = 503;
    throw error;
  }
  return new GoogleGenAI({
    apiKey: env.geminiApiKey,
    httpOptions: { apiVersion: "v1beta" }
  });
}

export function friendDocumentInput(title, content) {
  const safeTitle = String(title || "").trim() || "none";
  return `title: ${safeTitle} | text: ${String(content || "").trim()}`;
}

export function friendQueryInput(query) {
  return `task: question answering | query: ${String(query || "").replace(/\s+/g, " ").trim()}`;
}

async function embedFriendText(text) {
  let response;
  try {
    response = await getClient().models.embedContent({
      model: FRIEND_EMBEDDING_MODEL,
      contents: text,
      config: { outputDimensionality: FRIEND_EMBEDDING_DIMENSION }
    });
  } catch (error) {
    const err = new Error(`Gemini embedding failed: ${redact(error?.message || error)}`);
    err.statusCode = 502;
    throw err;
  }
  const values = response?.embeddings?.[0]?.values;
  if (!Array.isArray(values) || values.length !== FRIEND_EMBEDDING_DIMENSION) {
    const received = Array.isArray(values) ? values.length : 0;
    throw new Error(`Gemini embedding dimension mismatch: expected ${FRIEND_EMBEDDING_DIMENSION}, received ${received}.`);
  }
  return values;
}

export function embedFriendDocument(title, content) {
  return embedFriendText(friendDocumentInput(title, content));
}

export function embedFriendQuery(query) {
  return embedFriendText(friendQueryInput(query));
}
