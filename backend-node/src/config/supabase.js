import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

let supabaseAdmin;

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return supabaseAdmin;
}

function displayNameFromAuthUser(authUser) {
  const metadata = authUser.user_metadata || {};
  return (
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (authUser.email ? authUser.email.split("@")[0] : "User")
  );
}

export function isOAuthUser(authUser) {
  const identities = authUser?.identities || [];
  return identities.some((item) => item?.provider && item.provider !== "email");
}

export function toRequestUser(profile, authUser) {
  const metadata = authUser?.user_metadata || {};
  return {
    id: authUser.id,
    name: profile?.name || displayNameFromAuthUser(authUser),
    email: profile?.email || authUser.email || "",
    phoneNumber: profile?.phone_number || "",
    avatarUrl: profile?.avatar_url || metadata.avatar_url || metadata.avatarUrl || "",
    createdAt: profile?.created_at || authUser?.created_at || "",
    emailVerified: profile?.email_verified !== false
  };
}

const PROFILE_SELECT = "id, name, email, phone_number, email_verified, created_at, updated_at, avatar_url";
const PROFILE_SELECT_LEGACY = "id, name, email, phone_number, created_at, updated_at";

function isMissingProfileColumn(error) {
  const message = String(error?.message || "");
  return (
    message.includes("email_verified") ||
    message.includes("avatar_url") ||
    String(error?.code || "") === "42703"
  );
}

export async function getOrCreateProfile(authUser) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", authUser.id)
    .maybeSingle();

  if (readError) {
    if (isMissingProfileColumn(readError)) {
      const { data: legacy } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT_LEGACY)
        .eq("id", authUser.id)
        .maybeSingle();
      if (legacy) {
        return { ...legacy, email_verified: true, avatar_url: null };
      }
    }
    throw readError;
  }

  const oauth = isOAuthUser(authUser);
  if (existing) {
    if (oauth && existing.email_verified === false) {
      const { data: updated } = await supabase
        .from("profiles")
        .update({ email_verified: true })
        .eq("id", authUser.id)
        .select(PROFILE_SELECT)
        .maybeSingle();
      return updated || { ...existing, email_verified: true };
    }
    return existing;
  }

  const { data: created, error: writeError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: authUser.id,
        name: displayNameFromAuthUser(authUser),
        email: authUser.email,
        phone_number: authUser.user_metadata?.phone_number || null,
        email_verified: oauth
      },
      { onConflict: "id" }
    )
    .select(PROFILE_SELECT)
    .single();

  if (writeError) {
    const { data: retry } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_LEGACY)
      .eq("id", authUser.id)
      .maybeSingle();
    if (retry) {
      return { ...retry, email_verified: true, avatar_url: null };
    }
    throw writeError;
  }
  return created;
}

export function describeProfileError(error) {
  const code = error?.code || "";
  const message = String(error?.message || "");
  if (
    code === "PGRST205" ||
    message.includes("Could not find the table") ||
    message.includes("schema cache")
  ) {
    return "User profiles table is missing. Run supabase/schema.sql in the Supabase SQL Editor, then try again.";
  }
  if (code === "23505") {
    return "An account with this email already exists.";
  }
  return "Could not load your profile. Please try again.";
}
