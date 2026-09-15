const DEVANAGARI_RE = /[\u0900-\u097F]/g;
const LATIN_RE = /[A-Za-z]/g;

const TECH_TERMS_RE = /\b(javascript|typescript|java|python|react|redux|nodejs|node\.js|next\.js|express|spring|mongodb|postgres|postgresql|mysql|sql|graphql|html|css|api|apis|frontend|backend|fullstack|full-stack|docker|kubernetes|linux|windows|github|git|http|https|json|xml|rest|aws|azure|gcp|algorithm|database|microservices|interview|interviews|question|questions)\b/gi;

const HINGLISH_WORDS = new Set([
  "kya", "kyun", "kyunki", "nahi", "nahin", "aap", "aapko", "aapka", "tum", "tumhe",
  "hum", "humein", "kaise", "kahan", "kabhi", "lekin", "magar", "batao", "bataen",
  "samjhao", "samjhaen", "samajh", "samajhna", "achha", "accha", "theek", "thik",
  "chahiye", "karo", "kariye", "kijiye", "dijiye", "hain", "hoga", "hogi", "hoge",
  "tha", "thi", "thee", "mujhe", "mera", "meri", "unka", "unki", "uska", "uski",
  "yeh", "woh", "wahan", "yahan", "phir", "pehle", "baad", "zyada", "thoda",
  "bilkul", "sahi", "galat", "sawal", "jawab", "namaste", "dhanyavad", "kripya",
  "matlab", "wala", "wali", "wale", "ji", "haan", "hanji", "hoon", "hun",
]);

export function stripTechTerms(text) {
  return String(text || "").replace(TECH_TERMS_RE, " ");
}

export function detectTtsLanguage(raw) {
  const text = String(raw || "").trim();
  if (!text) return "en";

  const devanagari = text.match(DEVANAGARI_RE) || [];
  const latinSource = stripTechTerms(text);
  const latin = latinSource.match(LATIN_RE) || [];
  const letterCount = devanagari.length + latin.length;

  if (devanagari.length >= 3) return "hi";
  if (letterCount > 0 && devanagari.length / letterCount >= 0.12) return "hi";

  const words = latinSource
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const hinglishHits = words.filter((word) => HINGLISH_WORDS.has(word)).length;
  if (hinglishHits >= 2) return "hi";
  if (hinglishHits >= 1 && /\b(karo|kariye|kijiye|samjhao|batao|nahi|kya)\b/i.test(latinSource)) {
    return "hi";
  }
  return "en";
}
