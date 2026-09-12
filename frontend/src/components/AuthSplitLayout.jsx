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
    <svg viewBox="0 0 420 240" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="auth-desk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="auth-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <ellipse cx="210" cy="218" rx="150" ry="14" fill="#38bdf8" opacity="0.16" />
      <rect x="118" y="108" width="168" height="92" rx="14" fill="#1e293b" />
      <rect x="130" y="118" width="144" height="64" rx="8" fill="url(#auth-screen)" />
      <rect x="108" y="200" width="188" height="10" rx="4" fill="#334155" />
      <circle cx="202" cy="78" r="28" fill="#fdba74" />
      <path d="M168 128c8-28 76-28 84 0v36H168z" fill="#1d4ed8" />
      <g transform="translate(268 92)">
        <rect x="18" y="8" width="10" height="18" rx="4" fill="#38bdf8" />
        <circle cx="23" cy="6" r="6" fill="#a78bfa" />
        <rect x="0" y="26" width="70" height="58" rx="22" fill="#e0f2fe" className="dark:opacity-90" />
        <rect x="10" y="36" width="50" height="28" rx="12" fill="#0f172a" />
        <g className="auth-robot-eyes">
          <circle cx="24" cy="50" r="5" fill="#38bdf8" />
          <circle cx="46" cy="50" r="5" fill="#38bdf8" />
        </g>
        <rect x="26" y="58" width="18" height="4" rx="2" fill="#64748b" />
        <rect x="20" y="78" width="30" height="12" rx="6" fill="#38bdf8" />
      </g>
      <rect x="48" y="54" width="72" height="28" rx="10" fill="#fff" stroke="#c4b5fd" />
      <rect x="58" y="62" width="22" height="6" rx="3" fill="#38bdf8" />
      <rect x="84" y="62" width="26" height="6" rx="3" fill="#a78bfa" />
      <rect x="300" y="48" width="64" height="28" rx="10" fill="#fff" stroke="#67e8f9" />
      <circle cx="318" cy="62" r="6" fill="#22d3ee" />
      <rect x="328" y="58" width="24" height="5" rx="2" fill="#64748b" />
      <circle cx="86" cy="168" r="18" fill="#bbf7d0" />
      <path d="M80 168h12M86 162v12" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
    </svg>
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
          <AuthSceneArt className="mt-8 h-auto w-full max-w-md" />
        </section>

        <div className="mx-auto w-full min-w-0 max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
