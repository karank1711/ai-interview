import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRightIcon, ChartBarIcon, SparklesIcon } from '@heroicons/react/24/outline';
import AnimatedBrain from './AnimatedBrain';

function LaptopInterviewArt({ className = '' }) {
  return (
    <svg viewBox="0 0 320 240" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="cta-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="cta-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="214" rx="92" ry="10" fill="#38bdf8" opacity="0.18" />
      <rect x="36" y="28" width="248" height="148" rx="14" fill="#1e293b" stroke="#38bdf8" strokeOpacity="0.35" />
      <rect x="48" y="40" width="224" height="116" rx="8" fill="url(#cta-screen)" />
      <rect x="58" y="52" width="88" height="92" rx="10" fill="#0ea5e9" opacity="0.25" />
      <circle cx="102" cy="86" r="22" fill="#94a3b8" />
      <circle cx="102" cy="82" r="18" fill="#fdba74" />
      <rect x="82" y="104" width="40" height="28" rx="14" fill="#1d4ed8" />
      <rect x="160" y="56" width="96" height="44" rx="10" fill="#0f172a" stroke="#22d3ee" strokeOpacity="0.5" />
      <rect x="172" y="68" width="28" height="6" rx="3" fill="#38bdf8" />
      <rect x="172" y="80" width="48" height="6" rx="3" fill="#64748b" />
      <rect x="160" y="110" width="44" height="32" rx="8" fill="#1e1b4b" stroke="#a78bfa" strokeOpacity="0.6" />
      <rect x="170" y="120" width="24" height="4" rx="2" fill="#c4b5fd" />
      <rect x="170" y="128" width="16" height="4" rx="2" fill="#6366f1" />
      <g transform="translate(214 108)">
        <rect width="42" height="36" rx="8" fill="#0b1224" stroke="#38bdf8" strokeOpacity="0.45" />
        <rect x="8" y="22" width="6" height="8" rx="1" fill="#38bdf8" />
        <rect x="18" y="16" width="6" height="14" rx="1" fill="#818cf8" />
        <rect x="28" y="10" width="6" height="20" rx="1" fill="#22d3ee" />
      </g>
      <rect x="24" y="176" width="272" height="14" rx="4" fill="#334155" />
      <rect x="88" y="188" width="144" height="8" rx="3" fill="#1e293b" />
      <circle cx="268" cy="54" r="22" fill="url(#cta-glow)" />
      <rect x="258" y="46" width="20" height="16" rx="6" fill="#0f172a" stroke="#67e8f9" />
      <path d="M264 54h8M266 50v8" stroke="#67e8f9" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function TargetAnalyticsArt({ className = '' }) {
  return (
    <svg viewBox="0 0 280 240" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="cta-target" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="70%" stopColor="#312e81" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="132" cy="118" r="88" fill="url(#cta-target)" />
      <circle cx="132" cy="118" r="70" fill="none" stroke="#3b82f6" strokeOpacity="0.35" strokeWidth="2" />
      <circle cx="132" cy="118" r="50" fill="none" stroke="#60a5fa" strokeOpacity="0.55" strokeWidth="2" />
      <circle cx="132" cy="118" r="30" fill="none" stroke="#38bdf8" strokeOpacity="0.8" strokeWidth="2.5" />
      <circle cx="132" cy="118" r="10" fill="#22d3ee" />
      <path d="M148 102 L214 52" stroke="#c4b5fd" strokeWidth="4" strokeLinecap="round" />
      <polygon points="214,52 198,48 206,64" fill="#a78bfa" />
      <g transform="translate(198 148)">
        <rect x="0" y="28" width="12" height="22" rx="2" fill="#38bdf8" opacity="0.7" />
        <rect x="18" y="16" width="12" height="34" rx="2" fill="#818cf8" />
        <rect x="36" y="8" width="12" height="42" rx="2" fill="#22d3ee" />
        <path d="M4 24 L24 14 L48 6" fill="none" stroke="#67e8f9" strokeWidth="2" />
      </g>
    </svg>
  );
}

export default function HomeCtaBanner() {
  return (
    <section className="px-3 pb-10 sm:px-6 sm:pb-12 lg:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[1.75rem] bg-[#070b1c] px-4 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.35)] sm:px-8 sm:py-12 lg:px-10">
        <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.12),transparent_36%),radial-gradient(circle_at_80%_80%,rgba(139,92,246,0.16),transparent_40%)]" />
        <svg className="pointer-events-none absolute left-0 top-0 h-full w-40 text-sky-400/20 sm:w-56" viewBox="0 0 200 400" fill="none" aria-hidden="true">
          <path d="M-20 80 C60 40, 40 180, 120 160 S180 300, 40 360" stroke="currentColor" strokeWidth="2" />
        </svg>
        <svg className="pointer-events-none absolute right-0 top-0 h-full w-40 text-violet-400/20 sm:w-56" viewBox="0 0 200 400" fill="none" aria-hidden="true">
          <path d="M220 40 C120 80, 180 160, 80 190 S40 320, 210 370" stroke="currentColor" strokeWidth="2" />
        </svg>

        <div className="relative grid grid-cols-1 items-center gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.9fr)]">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-2 col-span-1 mx-auto hidden w-full max-w-[280px] sm:block lg:order-1 lg:max-w-none"
          >
            <LaptopInterviewArt className="h-auto w-full" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="order-1 col-span-1 px-1 text-center sm:col-span-2 lg:order-2 lg:col-span-1"
          >
            <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full bg-violet-600/80 px-3 py-1 text-[11px] font-semibold tracking-widest text-white shadow-[0_0_20px_rgba(139,92,246,0.45)] sm:tracking-[0.18em]">
              <AnimatedBrain className="h-4 w-4" particleCount={4} glowIntensity={0.4} />
              INTERVIEWIQ
            </div>
            <h2 className="text-[clamp(1.35rem,5vw,2.5rem)] font-bold leading-tight text-white sm:text-4xl md:text-[2.5rem]">
              Ready to{' '}
              <span className="bg-[linear-gradient(90deg,#FFFFFF_0%,#C4B5FD_42%,#38BDF8_100%)] bg-clip-text text-transparent">
                Ace Your Interview?
              </span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300 sm:text-base">
              Build confidence. Practice smarter. Land your dream job.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row sm:flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200">
                <SparklesIcon className="h-3.5 w-3.5 text-violet-300" />
                AI-powered interview practice
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200">
                <ChartBarIcon className="h-3.5 w-3.5 text-sky-300" />
                Instant feedback and progress tracking
              </span>
            </div>
            <Link
              to="/interview"
              className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-fuchsia-500 px-7 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(99,102,241,0.55)] transition hover:from-blue-400 hover:to-fuchsia-400"
            >
              Start Interview
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-3 col-span-1 mx-auto hidden w-full max-w-[240px] sm:block lg:max-w-none"
          >
            <TargetAnalyticsArt className="h-auto w-full" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
