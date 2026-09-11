import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UserGroupIcon,
  CheckCircleIcon,
  ChartBarIcon,
  BoltIcon,
  DocumentTextIcon,
  StarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import AnimatedCounter from './AnimatedCounter';
import { getInterviewStatCards, interviewTokenPath } from '../utils/interviewStats';

const DASHBOARD_ICONS = {
  total: UserGroupIcon,
  completed: CheckCircleIcon,
  average: ChartBarIcon,
  pass: BoltIcon,
};

const ABOUT_ICONS = {
  total: DocumentTextIcon,
  completed: CheckCircleIcon,
  average: StarIcon,
  pass: ShieldCheckIcon,
};

const DASHBOARD_COLORS = {
  total: 'from-violet-500 to-purple-600',
  completed: 'from-emerald-500 to-green-600',
  average: 'from-blue-500 to-sky-600',
  pass: 'from-pink-500 to-rose-500',
};

const ABOUT_ICON_WRAP = {
  total: 'bg-violet-100 text-violet-600',
  completed: 'bg-emerald-100 text-emerald-600',
  average: 'bg-sky-100 text-sky-600',
  pass: 'bg-rose-100 text-rose-600',
};

function ScoreRing({ percent, color }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="24" cy="24" r={radius} fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-700" strokeWidth="5" />
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - value / 100)}
      />
    </svg>
  );
}

export default function InterviewStatTokens({ stats, variant = 'dashboard' }) {
  const navigate = useNavigate();
  const cards = getInterviewStatCards(stats);

  if (variant === 'about') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((stat, index) => {
          const Icon = ABOUT_ICONS[stat.key];
          return (
            <motion.button
              type="button"
              key={stat.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              onClick={() => navigate(interviewTokenPath(stat.key))}
              className="cursor-pointer rounded-2xl bg-white p-5 text-left shadow-md ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-800 dark:ring-slate-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${ABOUT_ICON_WRAP[stat.key]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.title}</p>
                  <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
                    <AnimatedCounter value={stat.value} />
                  </p>
                </div>
                {stat.key === 'average' ? <ScoreRing percent={stat.ring} color="#0ea5e9" /> : null}
                {stat.key === 'pass' ? <ScoreRing percent={stat.ring} color="#f43f5e" /> : null}
              </div>
              {stat.key === 'completed' ? (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${stat.progress || 0}%` }} />
                </div>
              ) : null}
            </motion.button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((stat, index) => {
        const Icon = DASHBOARD_ICONS[stat.key];
        return (
          <motion.button
            type="button"
            key={stat.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: index * 0.1 }}
            onClick={() => navigate(interviewTokenPath(stat.key))}
            className="rounded-2xl bg-white p-5 text-left shadow-md ring-1 ring-gray-100 transition-all hover:-translate-y-0.5 hover:shadow-xl dark:bg-gray-800 dark:ring-gray-700"
          >
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r ${DASHBOARD_COLORS[stat.key]}`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.shortTitle}</p>
                <p className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white">
                  <AnimatedCounter value={stat.value} />
                </p>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
