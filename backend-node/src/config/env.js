import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env");
dotenv.config({ path: envPath, override: true });

const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, "").toLowerCase();

export const env = {
  port: Number(process.env.PORT || 8081),
  nodeEnv: process.env.NODE_ENV || "development",
  frontendOrigins: (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean),
  corsAllowVercelApp:
    String(process.env.CORS_ALLOW_VERCEL_APP || "false").toLowerCase() === "true",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasGoogleOAuthCredentials: Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ),
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL || "karank47417@gmail.com",
  contactToEmail: process.env.CONTACT_TO_EMAIL || "karank47417@gmail.com",
  geminiApiKey: process.env.GEMINI_API_KEY,
  groqApiKey: (process.env.GROQ_API_KEY || "").trim(),
  sarvamApiKey: (
    process.env.SARVAM_API_KEY ||
    process.env.SARVAM_API_SUBSCRIPTION_KEY ||
    ""
  ).trim(),
  huggingfaceApiKey: (
    process.env.HF_TOKEN ||
    process.env.HUGGINGFACE_API_KEY ||
    process.env.HUGGINGFACE_TOKEN ||
    process.env.HUGGINGFACEHUB_API_TOKEN ||
    ""
  )
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim(),
  huggingfaceQuestionModel: (
    process.env.HUGGINGFACE_QUESTION_MODEL ||
    process.env.HF_QUESTION_MODEL ||
    "meta-llama/Llama-3.1-8B-Instruct"
  ).trim(),
  huggingfaceInferenceProvider: (
    process.env.HUGGINGFACE_INFERENCE_PROVIDER ||
    process.env.HF_INFERENCE_PROVIDER ||
    "fastest"
  ).trim(),
  interviewQuestionCount: Math.max(1, Math.min(10, Number(process.env.INTERVIEW_QUESTION_COUNT || 5) || 5)),
  livekitUrl: process.env.LIVEKIT_URL || "",
  livekitApiKey: process.env.LIVEKIT_API_KEY || "",
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || "",
  youtubeApiKey: (
    process.env.YOUTUBE_API_KEY ||
    process.env.YOUTUBE_DATA_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim(),
};

export function validateEnv() {
  const required = ["supabaseUrl", "supabaseServiceRoleKey"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
