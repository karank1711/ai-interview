import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env, validateEnv } from "./config/env.js";
import authRoutes from "./routes/auth.js";
import interviewRoutes from "./routes/interviews.js";
import questionRoutes from "./routes/questions.js";
import resultRoutes from "./routes/results.js";
import contactRoutes from "./routes/contact.js";
import interviewFriendRoutes from "./routes/interviewFriend.js";
import { requireAuth } from "./middleware/auth.js";
import { prefetchJwks } from "./utils/jwtVerify.js";

const app = express();
const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, "").toLowerCase();

function isHttpsVercelAppOrigin(origin) {
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && u.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const requestOrigin = normalizeOrigin(origin);
      if (env.frontendOrigins.includes(requestOrigin)) {
        callback(null, true);
        return;
      }

      if (env.corsAllowVercelApp && isHttpsVercelAppOrigin(requestOrigin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    exposedHeaders: ["X-Tts-Provider", "X-Tts-Language", "X-Voice-Available", "Content-Type"],
  })
);
app.use(express.json({ strict: false }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "InterviewIQ API — use /api/health for a quick check.",
    health: "/api/health"
  });
});

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "API is mounted here; there is no resource at GET /api alone.",
    health: "/api/health",
    auth: "/api/auth"
  });
});

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Node backend is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/interviews", requireAuth, interviewRoutes);
app.use("/api/questions", requireAuth, questionRoutes);
app.use("/api/results", requireAuth, resultRoutes);
app.use("/api/interview-friend", requireAuth, interviewFriendRoutes);

app.use((error, req, res, next) => {
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON payload" });
  }
  console.error(error);
  res.status(500).json({ success: false, message: "Internal server error" });
});

async function start() {
  validateEnv();

  // if (env.hasGoogleOAuthCredentials) {
  //   console.log(
  //     "Google OAuth credentials are loaded in backend env. Enable Google in Supabase Dashboard → Authentication → Providers → Google. Do not add GOOGLE_CLIENT_SECRET to the frontend."
  //   );
  // }

  // console.log(
  //   `CORS: FRONTEND_URLS count=${env.frontendOrigins.length}, CORS_ALLOW_VERCEL_APP=${env.corsAllowVercelApp}`
  // );
  // console.log(
  //   `Resend: keyLoaded=${Boolean(env.resendApiKey)} from=${env.resendFromEmail} to=${env.contactToEmail}`
  // );

  // console.log(`Groq TTS: configured=${Boolean(env.groqApiKey)}`);
  // console.log(`Hindi TTS (Sarvam): configured=${Boolean(env.sarvamApiKey)}`);
  // console.log(
  //   `Hugging Face questions: configured=${Boolean(env.huggingfaceApiKey)} model=${env.huggingfaceQuestionModel} provider=${env.huggingfaceInferenceProvider}`
  // );
  app.listen(env.port, () => {
    console.log(`Backend listening on http://localhost:${env.port}`);
   });
}

start().catch((error) => {
  console.error("Failed to start backend:", error.message);
  process.exit(1);
});
