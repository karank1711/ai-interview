import { useEffect, useState } from 'react';
import AnimatedCounter from '../components/AnimatedCounter';
import BackButton from '../components/BackButton';
import DetailMetricCard from '../components/DetailMetricCard';
import TokenAnalytics from '../components/TokenAnalytics';
import TokenRecentTable from '../components/TokenRecentTable';
import { interviewService } from '../services/interviewService';
import { readPageCache, writePageCache } from '../utils/pageDataCache';
import { EMPTY_INTERVIEW_STATS, normalizeInterviewStats } from '../utils/interviewStats';
import { buildProgressOverview, percent } from '../utils/tokenDetails';

const PROGRESS_CACHE_KEY = 'progress:v3';
const DASHBOARD_CACHE_KEY = 'dashboard:v2';

function readInitialCache() {
  return readPageCache(PROGRESS_CACHE_KEY) || readPageCache(DASHBOARD_CACHE_KEY);
}

export default function ProgressTracking() {
  const cached = readInitialCache();
  const [interviews, setInterviews] = useState(cached?.interviews || []);
  const [results, setResults] = useState(cached?.results || []);
  const [stats, setStats] = useState(cached?.stats || EMPTY_INTERVIEW_STATS);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const statsResponse = await interviewService.getInterviewStats();
        if (cancelled) return;
        setStats(normalizeInterviewStats(statsResponse.data));

        const [interviewResponse, resultResponse] = await Promise.all([
          interviewService.getUserInterviews(0, 50),
          interviewService.getResultsHistory(0, 50),
        ]);
        if (cancelled) return;
        const next = {
          interviews: interviewResponse.data || [],
          results: resultResponse.data || [],
          stats: normalizeInterviewStats(statsResponse.data),
        };
        writePageCache(PROGRESS_CACHE_KEY, next);
        writePageCache(DASHBOARD_CACHE_KEY, next);
        setInterviews(next.interviews);
        setResults(next.results);
        setStats(next.stats);
      } catch (error) {
        console.error('Failed to load progress:', error);
        if (!cancelled && !cached) setStats(EMPTY_INTERVIEW_STATS);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const overview = buildProgressOverview({ stats, interviews, results });
  const completionValue = percent(stats.completedInterviews, stats.totalInterviews);

  return (
    <div className="min-h-screen bg-slate-50 py-8 dark:bg-[#070b16]">
      <div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-8">
        <BackButton fallback="/dashboard" />

        <div className="mb-8">
          <h1 className="text-[clamp(1.35rem,5vw,1.875rem)] font-bold text-slate-900 dark:text-white">Progress Tracking</h1>
          <p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-400">
            A combined view of your real interview activity, scores, and results.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {overview.metrics.map((metric) => (
            <DetailMetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
              tone={metric.tone}
            />
          ))}
        </div>

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Completion rate</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              <AnimatedCounter value={`${completionValue}%`} />
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-700"
              style={{ width: `${completionValue}%` }}
            />
          </div>
        </div>

        {overview.charts?.length ? (
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TokenAnalytics charts={overview.charts} />
          </div>
        ) : null}

        <TokenRecentTable table={overview.table} />
      </div>
    </div>
  );
}
