import { SparklesIcon, ChartBarIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import './heroRobot.css';

const FEATURES = [
  {
    title: 'Real-time AI Interviews',
    text: 'Experience realistic interview scenarios',
    Icon: SparklesIcon,
  },
  {
    title: 'Detailed Feedback',
    text: 'Get insights to improve your performance',
    Icon: ChartBarIcon,
  },
  {
    title: 'Build Your Confidence',
    text: 'Practice anytime, anywhere',
    Icon: ShieldCheckIcon,
  },
];

function AuthSceneArt({ className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#dbeafe] via-[#e0e7ff] to-[#f5f3ff] shadow-[0_18px_40px_rgba(99,102,241,0.18)] ring-1 ring-sky-200/70 dark:from-[#1e3a8a] dark:via-[#312e81] dark:to-[#0b1224] dark:ring-white/10 dark:shadow-[0_20px_50px_rgba(15,23,42,0.35)] ${className}`}>
      <div className="pointer-events-none absolute -left-8 top-2 h-36 w-40 rounded-full bg-white/80 blur-2xl dark:bg-sky-400/20" />
      <div className="pointer-events-none absolute right-8 top-10 h-32 w-32 rounded-full bg-violet-200/50 blur-3xl dark:bg-violet-500/25" />
      <svg viewBox="0 0 560 280" className="relative h-auto w-full" aria-hidden="true">
        <defs>
          <linearGradient id="auth-room" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="48%" stopColor="#c7d2fe" />
            <stop offset="100%" stopColor="#eef2ff" />
          </linearGradient>
          <linearGradient id="auth-desk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bfdbfe" />
            <stop offset="100%" stopColor="#e0e7ff" />
          </linearGradient>
          <linearGradient id="auth-robot-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e0e7ff" />
          </linearGradient>
          <linearGradient id="auth-screen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="auth-card" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
          <radialGradient id="auth-eye-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="55%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0284c7" />
          </radialGradient>
          <filter id="auth-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="560" height="280" fill="url(#auth-room)" />
        <ellipse cx="92" cy="96" rx="88" ry="64" fill="#ffffff" opacity="0.55" />
        <ellipse cx="170" cy="188" rx="96" ry="36" fill="#38bdf8" opacity="0.16" />
        <rect x="0" y="198" width="560" height="82" fill="url(#auth-desk)" />
        <rect x="0" y="198" width="560" height="6" fill="#93c5fd" opacity="0.7" />

        <g transform="translate(18 148)">
          <ellipse cx="28" cy="62" rx="22" ry="8" fill="#86efac" opacity="0.45" />
          <path d="M18 58c-10-30 8-54 22-60 12 8 24 34 14 60z" fill="#22c55e" />
          <path d="M12 52c10-20 32-24 40-8-14 6-24 16-30 28z" fill="#86efac" />
          <rect x="22" y="56" width="10" height="20" rx="3" fill="#a16207" />
        </g>

        <g className="hero-float-a" transform="translate(36 48)">
          <rect width="62" height="42" rx="14" fill="url(#auth-card)" opacity="0.92" filter="url(#auth-soft-glow)" />
          <rect x="16" y="12" width="30" height="18" rx="6" fill="none" stroke="#fff" strokeWidth="2.2" />
          <circle cx="31" cy="21" r="4" fill="none" stroke="#fff" strokeWidth="1.8" />
        </g>

        <g className="hero-float-b" transform="translate(248 22)">
          <rect width="96" height="46" rx="16" fill="url(#auth-card)" opacity="0.95" filter="url(#auth-soft-glow)" />
          <path d="M16 28c7-12 14-4 20-14 7 16 14 6 22 14 8-12 16-2 24-10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </g>

        <g className="hero-float-c" transform="translate(268 96)">
          <rect width="78" height="68" rx="16" fill="url(#auth-card)" opacity="0.9" filter="url(#auth-soft-glow)" />
          <circle cx="22" cy="22" r="9" fill="#fff" opacity="0.85" />
          <rect x="36" y="16" width="28" height="5" rx="2.5" fill="#fff" opacity="0.9" />
          <rect x="36" y="25" width="20" height="4" rx="2" fill="#fff" opacity="0.65" />
          <rect x="14" y="40" width="50" height="5" rx="2.5" fill="#fff" opacity="0.55" />
          <rect x="14" y="50" width="38" height="5" rx="2.5" fill="#fff" opacity="0.4" />
        </g>

        <g transform="translate(128 118)">
          <rect x="8" y="58" width="148" height="10" rx="4" fill="#64748b" opacity="0.28" />
          <rect x="22" y="42" width="124" height="78" rx="10" fill="#1e3a8a" />
          <rect x="28" y="48" width="112" height="58" rx="6" fill="url(#auth-screen)" />
          <rect x="0" y="118" width="168" height="12" rx="5" fill="#94a3b8" />
        </g>

        <g className="hero-robot-bob" transform="translate(132 58)">
          <ellipse cx="62" cy="148" rx="46" ry="10" fill="#38bdf8" opacity="0.2" />
          <rect x="36" y="98" width="52" height="52" rx="20" fill="url(#auth-robot-body)" />
          <circle cx="24" cy="116" r="10" fill="#f8fafc" />
          <circle cx="100" cy="116" r="10" fill="#f8fafc" />
          <rect x="28" y="36" width="68" height="72" rx="32" fill="url(#auth-robot-body)" filter="url(#auth-soft-glow)" />
          <rect x="56" y="16" width="8" height="24" rx="4" fill="#e2e8f0" />
          <circle cx="60" cy="14" r="8" fill="#22d3ee" />
          <g className="auth-robot-eyes">
            <ellipse cx="48" cy="64" rx="8" ry="9" fill="url(#auth-eye-glow)" />
            <ellipse cx="76" cy="64" rx="8" ry="9" fill="url(#auth-eye-glow)" />
            <circle cx="50" cy="61" r="2.2" fill="#fff" />
            <circle cx="78" cy="61" r="2.2" fill="#fff" />
          </g>
          <path d="M50 82c8 10 20 10 28 0" fill="none" stroke="#64748b" strokeWidth="2.6" strokeLinecap="round" />
        </g>

        <g transform="translate(352 86)">
          <ellipse cx="78" cy="128" rx="48" ry="12" fill="#94a3b8" opacity="0.28" />
          <path d="M92 148c28-2 48-18 50-42 2-22-12-38-34-42l-8 84z" fill="#cbd5e1" />
          <path d="M92 148c-8 2-18 4-28 2 4-28 10-58 18-78 18 8 22 28 16 76z" fill="#e2e8f0" />
          <path d="M48 122c10-48 92-48 102 0v32H48z" fill="#1d4ed8" />
          <path d="M56 122c10-40 76-40 86 0v18H56z" fill="#2563eb" />
          <circle cx="96" cy="58" r="26" fill="#1e293b" />
          <path d="M74 56c4-20 48-22 50 2-12 12-40 16-50-2z" fill="#0f172a" />
        </g>
      </svg>
    </div>
  );
}

export default function AuthSplitLayout({ children }) {
  return (
    <div className="relative isolate min-h-[calc(100vh-4rem)] overflow-x-hidden bg-gradient-to-br from-sky-50 via-white to-violet-100 dark:from-[#070b16] dark:via-[#0b1224] dark:to-[#111827]">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/15" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-80 w-72 rounded-full bg-violet-300/35 blur-3xl dark:bg-violet-600/20" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(56,189,248,0.14),transparent_34%),radial-gradient(circle_at_88%_80%,rgba(139,92,246,0.16),transparent_40%)]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 px-4 py-6 sm:px-6 md:grid-cols-2 md:py-10 lg:gap-14 lg:px-8">
        <section className="hidden min-w-0 md:block">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-sm font-bold text-white shadow-lg">
              IQ
            </span>
            <span className="text-lg font-bold text-slate-800 dark:text-white">
              Interview<span className="text-violet-600 dark:text-violet-400">IQ</span>
            </span>
          </div>
          <h1 className="max-w-md break-words text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-tight text-slate-900 dark:text-white">
            Your{' '}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              AI-Powered
            </span>{' '}
            Interview Companion
          </h1>
          <p className="mt-3 max-w-md break-words text-[clamp(0.9rem,2vw,1.05rem)] leading-relaxed text-slate-600 dark:text-slate-300">
            Practice with real AI interviews, get instant feedback and land your dream job with confidence.
          </p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/15 to-violet-500/20 text-violet-600 dark:text-violet-300">
                  <item.Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <AuthSceneArt className="mt-8 w-full max-w-lg" />
        </section>

        <div className="mx-auto w-full min-w-0 max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
