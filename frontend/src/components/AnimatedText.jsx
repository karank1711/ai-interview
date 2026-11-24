import { createElement } from 'react';
import { motion } from 'framer-motion';

const CHAR_DURATION = 0.28;
const DEFAULT_STAGGER = 0.055;

/**
 * Character-by-character fade reveal. Remounts when `replayKey` changes.
 */
export default function AnimatedText({
  text,
  as = 'span',
  className = '',
  lineClassNames = [],
  delay = 0,
  stagger = DEFAULT_STAGGER,
  replayKey,
}) {
  const lines = String(text ?? '').split('\n');
  let charIndex = 0;

  return createElement(
    as,
    { className, key: replayKey },
    lines.map((line, lineIndex) => {
      const chars = Array.from(line);
      const lineClass = lineClassNames[lineIndex] || '';
      return (
        <span
          key={`line-${lineIndex}`}
          className={`block overflow-visible whitespace-pre-wrap [overflow-wrap:normal] [word-break:normal] ${lineClass}`.trim()}
        >
          {chars.map((char, charInLine) => {
            const index = charIndex;
            charIndex += 1;
            return (
              <motion.span
                key={`${replayKey ?? 'reveal'}-${lineIndex}-${charInLine}`}
                className="inline overflow-visible will-change-[opacity,transform]"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: CHAR_DURATION,
                  delay: delay + index * stagger,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {char === ' ' ? ' ' : char}
              </motion.span>
            );
          })}
        </span>
      );
    })
  );
}
