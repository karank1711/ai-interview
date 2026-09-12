import { useEffect, useId, useRef } from 'react';
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

function useNaturalRobotBlink(ref) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return undefined;

    let cancelled = false;
    let waitTimer = 0;
    let clearTimer = 0;

    const schedule = () => {
      const wait = 2600 + Math.random() * 3200;
      waitTimer = window.setTimeout(() => {
        if (cancelled || !ref.current) return;
        const doubleBlink = Math.random() < 0.22;
        const className = doubleBlink ? 'is-double-blinking' : 'is-blinking';
        const duration = doubleBlink ? 520 : 280;
        ref.current.classList.add(className);
        clearTimer = window.setTimeout(() => {
          ref.current?.classList.remove(className);
          if (!cancelled) schedule();
        }, duration);
      }, wait);
    };

    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(waitTimer);
      window.clearTimeout(clearTimer);
    };
  }, [ref]);
}

function RobotEyes({ uid }) {
  const eyesRef = useRef(null);
  useNaturalRobotBlink(eyesRef);

  return (
    <g ref={eyesRef} className="auth-robot-eyes">
      <ellipse cx="48" cy="64" rx="8" ry="9" fill={`url(#${uid}-eye)`} />
      <ellipse cx="76" cy="64" rx="8" ry="9" fill={`url(#${uid}-eye)`} />
      <circle cx="50" cy="61" r="2.2" fill="#fff" />
      <circle cx="78" cy="61" r="2.2" fill="#fff" />
    </g>
  );
}

function AuthRobot({ uid, x = 132, y = 58 }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="62" cy="156" rx="44" ry="11" fill="var(--auth-glow)" />
      <rect x="36" y="98" width="52" height="52" rx="20" fill={`url(#${uid}-robot)`} />
      <circle cx="24" cy="116" r="10" fill="#f8fafc" />
      <circle cx="100" cy="116" r="10" fill="#f8fafc" />
      <circle cx="22" cy="116" r="6" fill="#818cf8" />
      <circle cx="102" cy="116" r="6" fill="#818cf8" />
      <rect x="28" y="36" width="68" height="72" rx="32" fill={`url(#${uid}-robot)`} />
      <rect x="56" y="16" width="8" height="24" rx="4" fill="#e2e8f0" />
      <circle cx="60" cy="14" r="8" fill="#38bdf8" />
      <RobotEyes uid={uid} />
      <path d="M50 82c8 10 20 10 28 0" fill="none" stroke="#64748b" strokeWidth="2.6" strokeLinecap="round" />
    </g>
  );
}

function AuthSceneArt({ className = '' }) {
  const uid = useId().replace(/:/g, '');

  return (
    <div
      className={`auth-scene relative overflow-hidden rounded-3xl shadow-[0_18px_40px_rgba(99,102,241,0.14)] ring-1 ring-sky-200/70 dark:ring-white/10 dark:shadow-[0_20px_50px_rgba(15,23,42,0.35)] ${className}`}
    >
      <svg viewBox="0 0 640 320" className="relative h-auto w-full" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-robot`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e0e7ff" />
          </linearGradient>
          <linearGradient id={`${uid}-screen`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--auth-laptop)" />
            <stop offset="100%" stopColor="var(--auth-laptop-deep)" />
          </linearGradient>
          <radialGradient id={`${uid}-eye`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="55%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0284c7" />
          </radialGradient>
        </defs>

        <ellipse cx="110" cy="88" rx="120" ry="78" fill="var(--auth-blob)" />
        <ellipse cx="430" cy="54" rx="90" ry="48" fill="var(--auth-blob-2)" opacity="0.55" />
        <ellipse cx="560" cy="210" rx="80" ry="50" fill="var(--auth-blob)" opacity="0.45" />

        <g fill="var(--auth-dots)">
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2, 3].map((col) => (
              <circle key={`${row}-${col}`} cx={568 + col * 12} cy={28 + row * 12} r="2.2" />
            )),
          )}
        </g>

        <rect x="0" y="238" width="640" height="82" fill="var(--auth-desk)" />
        <rect x="0" y="238" width="640" height="8" fill="var(--auth-desk-edge)" />

        <g transform="translate(28 176)">
          <ellipse cx="28" cy="70" rx="22" ry="7" fill="var(--auth-plant-dark)" opacity="0.2" />
          <path d="M28 62c-18-28-6-52 4-58 8 10 14 28 8 58z" fill="var(--auth-plant-dark)" />
          <path d="M28 62c16-32 28-40 34-28-8 10-16 24-22 48z" fill="var(--auth-plant)" />
          <path d="M28 62c-2-24 16-38 22-22-6 8-12 18-16 36z" fill="var(--auth-plant-dark)" />
          <ellipse cx="28" cy="68" rx="16" ry="10" fill="var(--auth-pot)" />
          <path d="M16 68h24l-3 16H19z" fill="var(--auth-pot)" />
        </g>

        <g transform="translate(228 78)">
          <rect width="118" height="52" rx="16" fill="var(--auth-chat)" />
          <rect x="16" y="14" width="72" height="6" rx="3" fill="var(--auth-chat-line)" />
          <rect x="16" y="26" width="86" height="6" rx="3" fill="var(--auth-chat-line)" opacity="0.75" />
          <rect x="16" y="38" width="54" height="6" rx="3" fill="var(--auth-chat-line)" opacity="0.5" />
        </g>

        <AuthRobot uid={uid} x="96" y="42" />

        <g transform="translate(236 168)">
          <rect x="18" y="18" width="108" height="70" rx="8" fill="var(--auth-laptop-base)" />
          <rect x="24" y="24" width="96" height="56" rx="4" fill={`url(#${uid}-screen)`} />
          <rect x="8" y="86" width="128" height="10" rx="4" fill="var(--auth-laptop-base)" />
        </g>

        <g transform="translate(430 108)">
          <path d="M78 132c22 0 40-10 46-28 4-14-6-30-22-36l-6 64z" fill="var(--auth-chair)" />
          <path d="M48 128c8-46 88-46 98 0v28H48z" fill="var(--auth-shirt-dark)" />
          <path d="M56 128c8-38 74-38 84 0v16H56z" fill="var(--auth-shirt)" />
          <circle cx="96" cy="62" r="26" fill="var(--auth-hair)" />
          <path d="M74 60c6-20 48-22 50 4-14 10-38 14-50-4z" fill="#0f172a" />
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
          <AuthSceneArt className="mb-6 w-full md:hidden" />
          {children}
        </div>
      </div>
    </div>
  );
}
