import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  Square3Stack3DIcon,
} from '@heroicons/react/24/outline';
import AnimatedCounter from '../components/AnimatedCounter';
import BackButton from '../components/BackButton';
import DetailMetricCard from '../components/DetailMetricCard';
import TokenAnalytics from '../components/TokenAnalytics';
import TokenHeroArt from '../components/TokenHeroArt';
import TokenRecentTable from '../components/TokenRecentTable';
import ProgressViewAllLink from '../components/ProgressViewAllLink';
import { interviewService } from '../services/interviewService';
import { readPageCache, writePageCache } from '../utils/pageDataCache';
import { EMPTY_INTERVIEW_STATS, normalizeInterviewStats } from '../utils/interviewStats';
import { buildTokenDetailModel, resolveTokenKey } from '../utils/tokenDetails';

const DASHBOARD_CACHE_KEY = 'dashboard:v2';

const HERO_ICONS = {
  total: Square3Stack3DIcon,
  completed: CheckCircleIcon,
  average: ChartBarIcon,
  pass: ShieldCheckIcon,
};

const HERO_ICON_STYLES = {
  total: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
  completed: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
  average: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
  pass: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
};

export default function TokenDetails() {
  const [searchParams] = useSearchParams();
  const token = resolveTokenKey(searchParams.get('token'));
  const cached = readPageCache(DASHBOARD_CACHE_KEY);
  const [interviews, setInterviews] = useState(cached?.interviews || []);
  const [results, setResults] = useState(cached?.results || []);
  const [stats, setStats] = useState(cached?.stats || EMPTY_INTERVIEW_STATS);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;

    async function load() {
      try {
        if (!readPageCache(DASHBOARD_CACHE_KEY)) setLoading(true);
        const [interviewResponse, resultResponse, statsResponse] = await Promise.all([
          interviewService.getUserInterviews(0, 20),
          interviewService.getResultsHistory(0, 50),
          interviewService.getInterviewStats(),
        ]);
        if (cancelled) return;
        const next = {
          interviews: interviewResponse.data || [],
          results: resultResponse.data || [],
          stats: normalizeInterviewStats(statsResponse.data),
        };
        writePageCache(DASHBOARD_CACHE_KEY, next);
        setInterviews(next.interviews);
        setResults(next.results);
        setStats(next.stats);
      } catch (error) {
        console.error('Failed to load token details:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="h-16 w-16 rounded-full border-4 border-blue-500 border-t-transparent"
        />
      </div>
    );
  }

  const model = buildTokenDetailModel({ token, stats, interviews, results });
  const HeroIcon = HERO_ICONS[model.key] || Square3Stack3DIcon;
  const metricCols = model.metrics.length > 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-3';

  return (
    <div className="min-h-screen bg-slate-50 py-8 dark:bg-[#070b16]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <BackButton fallback="/dashboard" />

        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{model.title}</h1>
            <p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-400">{model.description}</p>
          </div>
          <TokenHeroArt token={model.key} className="h-24 w-24 shrink-0 sm:h-28 sm:w-28" />
        </div>

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700 sm:p-8">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${HERO_ICON_STYLES[model.key]}`}>
              <HeroIcon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
                <AnimatedCounter value={model.mainValue} />
              </p>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{model.mainLabel}</p>
            </div>
          </div>
        </div>

        <div className={`mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 ${metricCols}`}>
          {model.metrics.map((metric) => (
            <DetailMetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
              tone={metric.tone}
            />
          ))}
        </div>

        {model.charts?.length ? (
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TokenAnalytics charts={model.charts} />
          </div>
        ) : null}

        <TokenRecentTable table={model.table} />

        <div className="mt-6">
          <ProgressViewAllLink />
        </div>
      </div>
    </div>
  );
}
