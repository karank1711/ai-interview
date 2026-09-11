import crypto from "crypto";
import { env } from "../config/env.js";
import { getSupabaseAdmin } from "../config/supabase.js";
import { sendEmail } from "./mail.js";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const RESEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_RESENDS_PER_WINDOW = 5;
const MAX_VERIFY_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashCode(email, code) {
  return crypto
    .createHmac("sha256", env.supabaseServiceRoleKey)
    .update(`${String(email).toLowerCase()}:${code}`)
    .digest("hex");
}

function hashesMatch(expectedHex, actualHex) {
  const expected = Buffer.from(String(expectedHex || ""), "utf8");
  const actual = Buffer.from(String(actualHex || ""), "utf8");
  if (expected.length !== actual.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, actual);
}

function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function findAuthUser({ email, userId }) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (userId) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (!error && data?.user?.email && data.user.email.toLowerCase() === normalizedEmail) {
      return data.user;
    }
    if (userId && normalizedEmail) {
      return null;
    }
  }

  return null;
}

function verificationError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function sendVerificationMessage(email, code) {
  const safeEmail = escapeHtml(email);
  await sendEmail({
    to: email,
    subject: "Your InterviewIQ verification code",
    text: `Your InterviewIQ verification code is ${code}. It expires in 10 minutes.`,
    html: `
      <p>Use this code to verify your InterviewIQ account for <strong>${safeEmail}</strong>.</p>
      <p style="font-size:28px;letter-spacing:6px;font-weight:700">${escapeHtml(code)}</p>
      <p>This code expires in 10 minutes. If you did not create an account, you can ignore this email.</p>
    `
  });
}

export async function issueVerificationCode({ email, userId }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(normalizedEmail)) {
    const error = new Error("Please enter a valid email address.");
    error.statusCode = 400;
    throw error;
  }

  const user = await findAuthUser({ email: normalizedEmail, userId });
  if (!user) {
    return { success: true };
  }

  if (user.email_confirmed_at && (await isProfileVerified(user.id))) {
    throw verificationError("ALREADY_VERIFIED", "This email is already verified. Please sign in.", 400);
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("email_verification_codes")
    .select("user_id, resend_count, last_sent_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const now = Date.now();
  if (existing?.last_sent_at) {
    const elapsed = now - new Date(existing.last_sent_at).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitError = verificationError(
        "RESEND_COOLDOWN",
        "Please wait before requesting another code.",
        429
      );
      waitError.retryAfterSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw waitError;
    }
    const windowElapsed = now - new Date(existing.last_sent_at).getTime();
    const resendCount = windowElapsed > RESEND_WINDOW_MS ? 0 : Number(existing.resend_count || 0);
    if (resendCount >= MAX_RESENDS_PER_WINDOW) {
      throw verificationError("RESEND_LIMIT", "Too many verification emails. Please try again later.", 429);
    }
  }

  const code = generateCode();
  const codeHash = hashCode(normalizedEmail, code);
  const expiresAt = new Date(now + CODE_TTL_MS).toISOString();
  const nextResendCount =
    existing && now - new Date(existing.last_sent_at).getTime() <= RESEND_WINDOW_MS
      ? Number(existing.resend_count || 0) + 1
      : 1;

  const { error: upsertError } = await supabase.from("email_verification_codes").upsert(
    {
      user_id: user.id,
      email: normalizedEmail,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempt_count: 0,
      resend_count: nextResendCount,
      last_sent_at: new Date(now).toISOString()
    },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    console.error("Verification code store error:", upsertError.message);
    throw verificationError(
      "SETUP_REQUIRED",
      "Could not start email verification. Run the latest supabase/schema.sql.",
      500
    );
  }

  await supabase.from("profiles").update({ email_verified: false }).eq("id", user.id);

  sendVerificationMessage(normalizedEmail, code).catch((sendError) => {
    console.error("Verification email send failed:", sendError.message);
  });

  return { success: true };
}

async function isProfileVerified(userId) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("profiles").select("email_verified").eq("id", userId).maybeSingle();
  return Boolean(data?.email_verified);
}

export async function verifyEmailCode({ email, code, userId }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedCode = String(code || "").replace(/\D/g, "").slice(0, 6);

  if (!EMAIL_RE.test(normalizedEmail) || !/^\d{6}$/.test(normalizedCode)) {
    throw verificationError("INVALID_FORMAT", "Enter the 6-digit code sent to your email.");
  }

  const user = await findAuthUser({ email: normalizedEmail, userId });
  if (!user) {
    throw verificationError("NO_PENDING_VERIFICATION", "Please verify your email first. Enter the 6-digit code we sent you.");
  }

  const supabase = getSupabaseAdmin();
  const { data: row, error: readError } = await supabase
    .from("email_verification_codes")
    .select("user_id, code_hash, expires_at, attempt_count")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) {
    console.error("Verification lookup error:", readError.message);
    throw verificationError("NO_PENDING_VERIFICATION", "Please verify your email first. Enter the 6-digit code we sent you.", 500);
  }

  if (!row) {
    if (user.email_confirmed_at && (await isProfileVerified(user.id))) {
      return { success: true, alreadyVerified: true };
    }
    throw verificationError("NO_PENDING_VERIFICATION", "Please verify your email first. Enter the 6-digit code we sent you.");
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw verificationError("EXPIRED_CODE", "Verification code has expired. Please request a new code.");
  }

  if (Number(row.attempt_count || 0) >= MAX_VERIFY_ATTEMPTS) {
    throw verificationError("TOO_MANY_ATTEMPTS", "Too many incorrect attempts. Request a new code.", 429);
  }

  const actualHash = hashCode(normalizedEmail, normalizedCode);
  if (!hashesMatch(row.code_hash, actualHash)) {
    await supabase
      .from("email_verification_codes")
      .update({ attempt_count: Number(row.attempt_count || 0) + 1 })
      .eq("user_id", user.id);
    throw verificationError("WRONG_CODE", "Wrong verification code. Please try again.");
  }

  const { error: confirmError } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true
  });
  if (confirmError) {
    console.error("Email confirm error:", confirmError.message);
    throw verificationError("CONFIRM_FAILED", "Could not verify email. Please try again.", 500);
  }

  await supabase.from("profiles").update({ email_verified: true }).eq("id", user.id);
  await supabase.from("email_verification_codes").delete().eq("user_id", user.id);
  return { success: true };
}
