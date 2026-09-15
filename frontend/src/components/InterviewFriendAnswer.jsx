import { normalizeFriendDisplayAnswer } from '../utils/friendAnswer';

function headingLevel(line) {
  const match = line.match(/^(#{1,3})\s+(.+)$/);
  if (!match) return null;
  return { level: match[1].length, text: match[2] };
}

function looksLikePlainHeading(line) {
  if (!line || line.length > 64) return false;
  if (/[.!?:]$/.test(line)) return false;
  if (/[`*_#]/.test(line)) return false;
  if (/\b(is|are|used|when|this|that|the|from|with)\b/i.test(line) && line.split(/\s+/).length > 4) return false;
  return /^[A-Z][\w+/&'-]*(?:\s+[A-Za-z][\w+/&'-]*){0,10}$/.test(line);
}

function looksLikeCodeLine(rawLine, trimmed) {
  if (/^(?: {2,}|\t)/.test(rawLine)) return true;
  return /^(for |while |do |if |elif |else:|print\(|def |class |i \+=|i = )/.test(trimmed);
}

function listItem(line) {
  const unordered = line.match(/^[-*•]\s+(.+)$/);
  if (unordered) return { ordered: false, text: unordered[1] };
  const ordered = line.match(/^\d+[.)]\s+(.+)$/);
  if (ordered) return { ordered: true, text: ordered[1] };
  return null;
}

function inlinePieces(text, keyPrefix) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={key} className="font-semibold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={key}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-violet-700 dark:bg-slate-900 dark:text-violet-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

export default function InterviewFriendAnswer({ text }) {
  const source = normalizeFriendDisplayAnswer(String(text || '').replace(/<[^>]*>/g, ''));
  if (!source.trim()) return null;

  const blocks = [];
  const fence = /```[\w-]*\r?\n?([\s\S]*?)```/g;
  let last = 0;
  let match;
  while ((match = fence.exec(source))) {
    if (match.index > last) {
      blocks.push({ type: 'md', value: source.slice(last, match.index) });
    }
    blocks.push({ type: 'code', value: match[1].replace(/^\n/, '').replace(/\n$/, '') });
    last = match.index + match[0].length;
  }
  if (last < source.length) blocks.push({ type: 'md', value: source.slice(last) });

  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200 sm:text-base">
      {blocks.map((block, blockIndex) => {
        if (block.type === 'code') {
          return (
            <pre
              key={`code-${blockIndex}`}
              className="overflow-x-auto whitespace-pre rounded-xl bg-slate-900 p-3 font-mono text-xs text-slate-100 dark:bg-black/50 sm:text-sm"
            >
              <code>{block.value}</code>
            </pre>
          );
        }
        const lines = block.value.replace(/\r/g, '').split('\n');
        const nodes = [];
        let listBuffer = [];
        let listOrdered = false;
        let codeBuffer = [];

        const flushList = () => {
          if (!listBuffer.length) return;
          const ListTag = listOrdered ? 'ol' : 'ul';
          const cls = listOrdered
            ? 'list-decimal space-y-1 pl-5'
            : 'list-disc space-y-1 pl-5';
          nodes.push(
            <ListTag key={`list-${nodes.length}`} className={cls}>
              {listBuffer.map((item, i) => (
                <li key={i}>{inlinePieces(item, `li-${nodes.length}-${i}`)}</li>
              ))}
            </ListTag>
          );
          listBuffer = [];
        };

        const flushCode = () => {
          if (!codeBuffer.length) return;
          nodes.push(
            <pre
              key={`code-md-${nodes.length}`}
              className="overflow-x-auto whitespace-pre rounded-xl bg-slate-900 p-3 font-mono text-xs text-slate-100 dark:bg-black/50 sm:text-sm"
            >
              <code>{codeBuffer.join('\n')}</code>
            </pre>
          );
          codeBuffer = [];
        };

        lines.forEach((rawLine, lineIndex) => {
          const line = rawLine.trim();
          if (!line) {
            flushList();
            flushCode();
            return;
          }
          if (looksLikeCodeLine(rawLine, line)) {
            flushList();
            codeBuffer.push(rawLine.replace(/^ {0,4}/, ''));
            return;
          }
          const heading = headingLevel(line);
          if (heading || looksLikePlainHeading(line)) {
            flushList();
            flushCode();
            const title = heading ? heading.text : line;
            const Tag = heading?.level === 1 ? 'h3' : 'h4';
            nodes.push(
              <Tag
                key={`h-${lineIndex}`}
                className="font-semibold text-slate-900 dark:text-white"
              >
                {title.replace(/\*\*/g, '')}
              </Tag>
            );
            return;
          }
          const item = listItem(line);
          if (item) {
            flushCode();
            if (listBuffer.length && listOrdered !== item.ordered) flushList();
            listOrdered = item.ordered;
            listBuffer.push(item.text);
            return;
          }
          flushList();
          flushCode();
          nodes.push(
            <p key={`p-${lineIndex}`}>{inlinePieces(line, `p-${lineIndex}`)}</p>
          );
        });
        flushList();
        flushCode();
        return <div key={`md-${blockIndex}`} className="space-y-2">{nodes}</div>;
      })}
    </div>
  );
}
