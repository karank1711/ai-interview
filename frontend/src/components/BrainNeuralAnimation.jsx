import { useId } from 'react';
import './sidebarMotion.css';

const INTERNAL_PATHS = [
  { id: 'frontal', d: 'M30 44 C 36 28, 52 20, 66 26 C 74 30, 76 40, 68 46 C 56 40, 42 40, 32 48', duration: 5.1, delay: 0 },
  { id: 'parietal', d: 'M48 30 C 62 20, 82 22, 94 36 C 90 46, 76 44, 62 40 C 54 36, 50 32, 48 30', duration: 5.4, delay: 0.45 },
  { id: 'temporal', d: 'M28 60 C 38 50, 52 54, 60 66 C 66 76, 58 86, 46 84 C 36 78, 30 70, 28 62', duration: 4.8, delay: 0.9 },
  { id: 'occipital', d: 'M78 42 C 90 46, 98 58, 94 72 C 88 82, 78 78, 76 66 C 76 56, 76 48, 78 42', duration: 5.2, delay: 1.35 },
  { id: 'insula', d: 'M42 50 C 52 44, 66 46, 74 56 C 68 64, 54 66, 44 60 C 40 56, 40 52, 42 50', duration: 4.6, delay: 0.25 },
  { id: 'cerebellum', d: 'M58 80 C 68 76, 80 80, 86 90 C 82 98, 70 100, 62 94 C 58 90, 56 84, 58 80', duration: 5.6, delay: 0.7 },
  { id: 'stem', d: 'M52 88 C 54 96, 52 106, 48 112 C 50 104, 52 96, 54 90', duration: 4.2, delay: 1.8 },
  { id: 'gyrus', d: 'M36 38 C 48 30, 64 28, 76 36 C 68 42, 52 44, 40 42', duration: 5, delay: 1.15 },
  { id: 'callosum', d: 'M38 56 C 50 50, 68 50, 80 58 C 70 62, 52 62, 40 58', duration: 4.7, delay: 1.6 },
  { id: 'sulcus', d: 'M44 34 C 58 28, 74 32, 84 44 C 74 40, 58 38, 46 40', duration: 5.3, delay: 0.55 },
];

const BRAIN_CLIP = 'M24 50 C 22 34, 30 18, 48 14 C 68 10, 90 16, 102 30 C 110 42, 108 58, 102 70 C 98 78, 94 82, 92 84 C 98 92, 94 104, 82 108 C 74 110, 70 100, 66 96 C 62 110, 54 116, 50 106 C 46 114, 40 104, 44 92 C 34 86, 26 70, 24 50 Z';

function buildSignals(particleCount) {
  const count = Math.max(1, particleCount);
  return Array.from({ length: count }, (_, index) => {
    const base = INTERNAL_PATHS[index % INTERNAL_PATHS.length];
    return {
      ...base,
      key: `${base.id}-${index}`,
      delay: base.delay + Math.floor(index / INTERNAL_PATHS.length) * 0.85,
      reverse: index % 3 === 2,
    };
  });
}

export default function BrainNeuralAnimation({
  src = '/images/brain.png',
  particleCount = 8,
  speed = 1,
  glowIntensity = 0.55,
  playing = true,
  className = '',
}) {
  const reactId = useId().replace(/:/g, '');
  const clipId = `brain-clip-${reactId}`;
  const glowId = `brain-glow-${reactId}`;
  const signals = buildSignals(particleCount);
  const speedSafe = Math.max(0.35, speed);

  return (
    <div
      className={`brain-neural-layer ${playing ? '' : 'is-paused'} ${className}`}
      style={{ '--brain-mask': `url("${src}")` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full overflow-hidden">
        <defs>
          <clipPath id={clipId}>
            <path d={BRAIN_CLIP} />
          </clipPath>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={glowIntensity} />
            <stop offset="42%" stopColor="#7dd3fc" stopOpacity={glowIntensity * 0.45} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {signals.map((signal) => {
            const vars = {
              '--path-duration': `${signal.duration / speedSafe}s`,
              '--path-delay': `${signal.delay}s`,
              offsetPath: `path("${signal.d}")`,
              animationDirection: signal.reverse ? 'reverse' : 'normal',
            };
            return (
              <g key={signal.key}>
                <circle className="brain-signal-glow" r="7.5" fill={`url(#${glowId})`} style={vars} />
                <circle className="brain-electron brain-electron-halo" r="2.15" style={vars} />
                <circle className="brain-electron brain-electron-core" r="1.05" style={vars} />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
