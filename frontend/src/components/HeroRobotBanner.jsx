import { motion } from 'framer-motion';
import './heroRobot.css';

const ICON_SETS = {
  contact: [
    { id: 'mail', className: 'hero-float-a left-2 top-4', color: '#3b82f6', path: 'M6 8l6 4 6-4v8H6V8z M6 8h12' },
    { id: 'chat', className: 'hero-float-b right-4 top-2', color: '#8b5cf6', path: 'M7 8h10v6H9l-2 2V8z' },
    { id: 'spark', className: 'hero-float-c left-8 bottom-8', color: '#22c55e', path: 'M12 5l1.2 3.8H17l-3.1 2.3 1.2 3.8L12 12.6 8.9 14.9l1.2-3.8L7 8.8h3.8z' },
    { id: 'phone', className: 'hero-float-a right-2 bottom-10', color: '#06b6d4', path: 'M8 7h8v10H8z M10 15h4' },
  ],
  about: [
    { id: 'users', className: 'hero-float-a left-1 top-6', color: '#3b82f6', path: 'M9 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 16c0-2 2-3 4-3h4c2 0 4 1 4 3' },
    { id: 'chart', className: 'hero-float-b right-3 top-3', color: '#22c55e', path: 'M7 16V10h2v6H7zm4 0V8h2v8h-2zm4 0v-5h2v5h-2z' },
    { id: 'star', className: 'hero-float-c left-10 bottom-6', color: '#8b5cf6', path: 'M12 5l1.5 4h4l-3.2 2.4L15.6 16 12 13.6 8.4 16l1.3-4.6L6.5 9h4z' },
    { id: 'briefcase', className: 'hero-float-a right-1 bottom-8', color: '#06b6d4', path: 'M9 8V7h6v1h3v9H6V8h3z' },
  ],
  features: [
    { id: 'bolt', className: 'hero-float-a left-2 top-3', color: '#3b82f6', path: 'M13 5L7 13h5l-1 6 6-8h-5l1-6z' },
    { id: 'check', className: 'hero-float-b right-4 top-5', color: '#22c55e', path: 'M7 12l3 3 7-7' },
    { id: 'gear', className: 'hero-float-c left-6 bottom-7', color: '#8b5cf6', path: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z M12 4v2 M12 18v2 M4 12h2 M18 12h2' },
    { id: 'target', className: 'hero-float-a right-2 bottom-9', color: '#06b6d4', path: 'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z' },
  ],
};

function FloatingIcon({ item }) {
  return (
    <motion.button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      className={`absolute flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-slate-100 ${item.className}`}
      whileHover={{ scale: 1.12, boxShadow: '0 0 18px rgba(99,102,241,0.35)' }}
      whileTap={{ scale: 0.96 }}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={item.color} strokeWidth="1.8">
        <path d={item.path} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.button>
  );
}

function RobotMark() {
  return (
    <motion.div
      className="hero-robot-bob relative z-10"
      whileHover={{ scale: 1.04, filter: 'drop-shadow(0 0 18px rgba(56,189,248,0.45))' }}
    >
      <svg viewBox="0 0 180 200" className="h-40 w-40 sm:h-48 sm:w-48" aria-hidden="true">
        <ellipse cx="90" cy="186" rx="42" ry="8" fill="#c7d2fe" opacity="0.7" />
        <rect x="78" y="18" width="8" height="22" rx="4" fill="#38bdf8" />
        <circle cx="82" cy="14" r="8" className="hero-spin-slow origin-center" fill="#a78bfa" />
        <rect x="42" y="44" width="96" height="78" rx="28" fill="#e0f2fe" />
        <rect x="54" y="56" width="72" height="46" rx="16" fill="#0f172a" />
        <circle cx="76" cy="78" r="7" fill="#38bdf8" />
        <circle cx="108" cy="78" r="7" fill="#38bdf8" />
        <rect x="80" y="90" width="20" height="5" rx="2.5" fill="#64748b" />
        <rect x="70" y="122" width="40" height="16" rx="8" fill="#38bdf8" />
        <text x="78" y="134" fontSize="10" fontWeight="700" fill="white">IQ</text>
        <rect x="36" y="70" width="14" height="28" rx="7" fill="#7dd3fc" />
        <rect x="130" y="70" width="14" height="28" rx="7" fill="#7dd3fc" />
        <rect x="62" y="142" width="20" height="36" rx="10" fill="#93c5fd" />
        <rect x="98" y="142" width="20" height="36" rx="10" fill="#93c5fd" />
      </svg>
    </motion.div>
  );
}

export default function HeroRobotBanner({
  badge,
  title,
  subtitle,
  variant = 'about',
  extra,
}) {
  const icons = ICON_SETS[variant] || ICON_SETS.about;
  return (
    <section className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-50 via-sky-50 to-violet-100 px-5 py-8 dark:from-[#121a2e] dark:via-indigo-950 dark:to-[#0b1224] sm:px-8 sm:py-10">
      <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-violet-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          {badge ? (
            <span className="mb-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-slate-700 dark:text-violet-300">
              {badge}
            </span>
          ) : null}
          <h1 className="break-words text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-300 sm:text-base">
            {subtitle}
          </p>
        </div>
        <div className="relative mx-auto flex h-64 w-56 shrink-0 flex-col items-center sm:h-72 sm:w-64">
          {extra ? (
            <div className="relative z-20 mb-2 max-w-[11.5rem] rounded-2xl bg-white px-3 py-2 text-center text-xs font-semibold leading-snug text-violet-600 shadow-md ring-1 ring-slate-100 dark:bg-slate-800 dark:text-violet-300 dark:ring-slate-700">
              {extra}
            </div>
          ) : null}
          <div className="relative h-52 w-52 sm:h-56 sm:w-56">
            {icons.map((item) => (
              <FloatingIcon key={item.id} item={item} />
            ))}
            <div className="flex h-full items-center justify-center">
              <RobotMark />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
