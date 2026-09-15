import { getSupabaseAdmin } from "../config/supabase.js";
import { isUuid } from "./interviewStore.js";

function fail(error, fallback) {
  const missing = error?.code === "PGRST205"
    || /interview_friend_conversations/i.test(String(error?.message || ""));
  const err = new Error(
    missing
      ? "Interview Friend history table is missing. Run supabase/interview_friend_conversations.sql in the Supabase SQL Editor."
      : fallback
  );
  err.cause = error;
  err.statusCode = missing ? 503 : 500;
  throw err;
}

function mapConversation(row, { includeMessages = false } = {}) {
  if (!row) return null;
  const item = {
    id: row.id,
    userId: row.user_id,
    title: row.title || "New conversation",
    mode: row.mode || "general",
    videoQuery: row.video_query || "",
    excludeVideoIds: Array.isArray(row.exclude_video_ids) ? row.exclude_video_ids : [],
    videos: Array.isArray(row.videos) ? row.videos.slice(0, 3) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeMessages) {
    item.messages = Array.isArray(row.messages) ? row.messages.slice(-80) : [];
  }
  return item;
}

export async function listFriendConversations(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("interview_friend_conversations")
    .select("id, user_id, title, mode, video_query, exclude_video_ids, videos, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) fail(error, "Could not load Interview Friend history.");
  return (data || []).map((row) => mapConversation(row));
}

export async function getFriendConversation(id, userId) {
  if (!isUuid(id)) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("interview_friend_conversations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail(error, "Could not load that conversation.");
  return mapConversation(data, { includeMessages: true });
}

export async function createFriendConversation(userId, payload = {}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("interview_friend_conversations")
    .insert({
      user_id: userId,
      title: String(payload.title || "New conversation").slice(0, 80),
      mode: String(payload.mode || "general").slice(0, 40),
      messages: Array.isArray(payload.messages) ? payload.messages.slice(-80) : [],
      videos: Array.isArray(payload.videos) ? payload.videos.slice(0, 3) : [],
      exclude_video_ids: Array.isArray(payload.excludeVideoIds) ? payload.excludeVideoIds.slice(0, 40) : [],
      video_query: String(payload.videoQuery || "").slice(0, 180),
    })
    .select("*")
    .single();
  if (error) fail(error, "Could not create Interview Friend conversation.");
  return mapConversation(data, { includeMessages: true });
}

export async function updateFriendConversation(id, userId, payload = {}) {
  if (!isUuid(id)) return null;
  const supabase = getSupabaseAdmin();
  const patch = { updated_at: new Date().toISOString() };
  if (payload.title != null) patch.title = String(payload.title).slice(0, 80);
  if (payload.mode != null) patch.mode = String(payload.mode).slice(0, 40);
  if (Array.isArray(payload.messages)) patch.messages = payload.messages.slice(-80);
  if (Array.isArray(payload.videos)) patch.videos = payload.videos.slice(0, 3);
  if (Array.isArray(payload.excludeVideoIds)) patch.exclude_video_ids = payload.excludeVideoIds.slice(0, 40);
  if (payload.videoQuery != null) patch.video_query = String(payload.videoQuery).slice(0, 180);
  const { data, error } = await supabase
    .from("interview_friend_conversations")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) fail(error, "Could not save Interview Friend conversation.");
  return mapConversation(data, { includeMessages: true });
}
