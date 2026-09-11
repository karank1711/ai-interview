import { Router } from "express";
import { env } from "../config/env.js";
import { sendEmail } from "../services/mail.js";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const USER_ERROR_MESSAGE = "Could not send your message. Please try again.";

router.post("/", async (req, res) => {
  try {
    if (!env.resendApiKey) {
      console.error("Contact form error: RESEND_API_KEY is missing from backend-node/.env");
      return res.status(503).json({
        success: false,
        message: USER_ERROR_MESSAGE
      });
    }

    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const message = String(req.body.message || "").trim();

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "Name, email, and message are required." });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }
    if (name.length > 120 || message.length > 5000) {
      return res.status(400).json({ success: false, message: "Message is too long." });
    }

    await sendEmail({
      to: env.contactToEmail,
      replyTo: email,
      subject: `InterviewIQ contact form: ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html: `
        <h2>New InterviewIQ contact message</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
      `
    });

    return res.json({ success: true, message: "Message sent successfully." });
  } catch (error) {
    console.error("Contact form error:", error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: USER_ERROR_MESSAGE
    });
  }
});

export default router;
