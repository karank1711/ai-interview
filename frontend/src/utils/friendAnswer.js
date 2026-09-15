export function normalizeFriendDisplayAnswer(raw) {
  let text = String(raw || '').trim();
  if (!text) return '';

  for (let i = 0; i < 3; i += 1) {
    const unescaped = text
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"');
    const candidate = unescaped.trim();
    if (!candidate.startsWith('{') || !/"(?:answer|speechText|followUpQuestion|topic)"\s*:/.test(candidate)) {
      text = unescaped;
      break;
    }
    const parsed = tryParseJsonObject(candidate) || tryParseJsonObject(text);
    if (parsed && typeof parsed.answer === 'string' && parsed.answer.trim()) {
      text = parsed.answer;
      continue;
    }
    const pulled = pullJsonStringField(candidate, 'answer') || pullJsonStringField(text, 'answer');
    if (pulled.trim()) {
      text = pulled;
      continue;
    }
    text = unescaped;
    break;
  }

  return String(text || '')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/^\s*\{[\s\S]*"(?:answer|speechText)"[\s\S]*\}\s*$/m, '')
    .trim();
}

function tryParseJsonObject(value) {
  const text = String(value || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function pullJsonStringField(raw, key) {
  const match = String(raw || '').match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (!match) return '';
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"');
  }
}
