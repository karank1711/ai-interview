import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getSupabaseAdmin, toRequestUser } from "../config/supabase.js";
import { issueVerificationCode, verifyEmailCode } from "../services/emailVerification.js";

const router = Router();

function publicProfile(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber || "",
    avatarUrl: user.avatarUrl || "",
    createdAt: user.createdAt || "",
    emailVerified: user.emailVerified !== false
  };
}

function handleVerificationError(res, error) {
  const status = error.statusCode || 500;
  if (status >= 500) {
    console.error("Email verification error:", error.message);
  }
  const payload = {
    success: false,
    code: error.code || "VERIFICATION_FAILED",
    message: error.message || "Could not verify email. Please try again."
  };
  if (error.retryAfterSec) {
    payload.retryAfterSec = error.retryAfterSec;
  }
  return res.status(status).json(payload);
}

router.get("/me", requireAuth, async (req, res) => {
  return res.json({
    success: true,
    data: { user: publicProfile(req.user) }
  });
});

router.put("/profile", requireAuth, async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const phoneNumber =
      typeof req.body.phoneNumber === "string" ? req.body.phoneNumber.trim() : "";
    const avatarUrl =
      typeof req.body.avatarUrl === "string" ? req.body.avatarUrl.trim() : undefined;

    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (avatarUrl && avatarUrl.length > 400000) {
      return res.status(400).json({ success: false, message: "Profile photo is too large. Use a smaller JPG or PNG." });
    }

    const supabase = getSupabaseAdmin();
    const patch = {
      name,
      phone_number: phoneNumber || null
    };
    if (avatarUrl !== undefined) {
      patch.avatar_url = avatarUrl || null;
    }

    let { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", req.user.id)
      .select("id, name, email, phone_number, email_verified, created_at, avatar_url")
      .single();

    if (error && (String(error.message || "").includes("avatar_url") || error.code === "42703")) {
      delete patch.avatar_url;
      const retry = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", req.user.id)
        .select("id, name, email, phone_number, email_verified, created_at")
        .single();
      data = retry.data ? { ...retry.data, avatar_url: avatarUrl || null } : retry.data;
      error = retry.error;
    }

    if (error || !data) {
      return res.status(500).json({ success: false, message: "Could not update profile" });
    }

    return res.json({
      success: true,
      message: "Profile updated",
      data: publicProfile(toRequestUser(data, { id: req.user.id, email: data.email, user_metadata: { avatar_url: data.avatar_url } }))
    });
  } catch (error) {
    console.error("Profile update error:", error.message);
    return res.status(500).json({ success: false, message: "Could not update profile" });
  }
});

router.post("/send-verification", async (req, res) => {
  try {
    await issueVerificationCode({
      email: req.body.email,
      userId: req.body.userId
    });
    return res.json({
      success: true,
      message: "If that email can be verified, a code has been sent."
    });
  } catch (error) {
    return handleVerificationError(res, error);
  }
});

router.post("/verify-email", async (req, res) => {
  try {
    await verifyEmailCode({
      email: req.body.email,
      code: req.body.code,
      userId: req.body.userId
    });
    return res.json({
      success: true,
      message: "Email verified. You can now sign in."
    });
  } catch (error) {
    return handleVerificationError(res, error);
  }
});

router.post("/confirm-email", async (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Enter the verification code sent to your email to activate your account."
  });
});

router.post("/forgot-password", async (req, res) => {
  return res.json({
    success: true,
    message: "If an account exists for that email, a reset link will be sent."
  });
});

router.post("/reset-password", async (req, res) => {
  return res.json({ success: true, message: "Use the password reset link from your email." });
});

router.delete("/account", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.auth.admin.deleteUser(req.user.id);
    if (error) {
      console.error("Account delete error:", error.message);
      return res.status(500).json({ success: false, message: "Could not delete your account." });
    }
    return res.json({ success: true, message: "Account deleted" });
  } catch (error) {
    console.error("Account delete error:", error.message);
    return res.status(500).json({ success: false, message: "Could not delete your account." });
  }
});

export default router;
