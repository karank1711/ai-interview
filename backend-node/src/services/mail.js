import { Resend } from "resend";
import { env } from "../config/env.js";

function redactSecrets(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return String(text || "Unknown error").replace(/re_[A-Za-z0-9]+/g, "[redacted]");
}

export async function sendEmail({ to, subject, html, text, replyTo }) {
  if (!env.resendApiKey) {
    const error = new Error("Email service is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const resend = new Resend(env.resendApiKey);
  const payload = {
    from: env.resendFromEmail || "karank47417@gmail.com",
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text
  };
  if (replyTo) {
    payload.replyTo = replyTo;
  }

  const { data, error } = await resend.emails.send(payload);
  if (error) {
    console.error("Resend error:", redactSecrets(error));
    const sendError = new Error("Could not send email. Please try again.");
    sendError.statusCode = 502;
    throw sendError;
  }
  return data;
}
