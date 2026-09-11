import { EMPTY_INTERVIEW_STATS, normalizeInterviewStats } from './interviewStats';

export const TOKEN_KEYS = ['total', 'completed', 'average', 'pass'];

export const TOKEN_META = {
  total: {
    title: 'Total Interviews',
    description: 'All interviews you have started on InterviewIQ, including completed and unfinished sessions.',
  },
  completed: {
    title: 'Completed Interviews',
    description: 'Interviews you have finished. Completion percentage is based on your total interviews.',
  },
  average: {
    title: 'Average Score',
    description: 'Mean overall score across your completed interview reports.',
  },
  pass: {
    title: 'Pass Rate',
    description: 'Share of completed interviews marked as pass, using InterviewIQ pass/fail scoring.',
  },
};

export function resolveTokenKey(value) {
  const key = String(value || '').toLowerCase();
  return TOKEN_KEYS.includes(key) ? key : null;
}

export function percent(part, whole) {
  if (!whole) return 0;
  return Math.round((Number(part) / Number(whole)) * 100);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayLabel(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short' });
}

export function lastNDayKeys(count = 7) {
  const keys = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - index);
    keys.push(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  }
  return keys;
}

export function interviewDisplayName(interview) {
  const type = String(interview?.type || 'Interview').replaceAll('_', ' ');
  return `${type} interview`;
}

export function interviewRole(interview) {
  return String(interview?.course || interview?.category || interview?.level || 'General').replaceAll('_', ' ');
}

function scoredResults(results) {
  return results.filter((item) => Number.isFinite(Number(item.overallScore)));
}

function buildTrend(interviews) {
  const keys = lastNDayKeys(7);
  const completed = keys.map(() => 0);
  const pending = keys.map(() => 0);
  interviews.forEach((interview) => {
    const key = dayKey(interview.createdAt);
    const index = keys.indexOf(key);
    if (index < 0) return;
    if (interview.status === 'COMPLETED') completed[index] += 1;
    else pending[index] += 1;
  });
  return {
    labels: keys.map(dayLabel),
    completed,
    pending,
    hasData: interviews.some((item) => keys.includes(dayKey(item.createdAt))),
  };
}

function buildCompletionTrend(interviews) {
  const keys = lastNDayKeys(7);
  const counts = keys.map(() => 0);
  interviews.forEach((interview) => {
    if (interview.status !== 'COMPLETED') return;
    const key = dayKey(interview.createdAt);
    const index = keys.indexOf(key);
    if (index >= 0) counts[index] += 1;
  });
  return {
    labels: keys.map(dayLabel),
    values: counts,
    hasData: counts.some((value) => value > 0),
  };
}

function buildPassTrend(results) {
  const keys = lastNDayKeys(7);
  const rates = keys.map((key) => {
    const dayResults = results.filter((item) => dayKey(item.createdAt) === key);
    if (!dayResults.length) return null;
    const passed = dayResults.filter((item) => item.passFail).length;
    return percent(passed, dayResults.length);
  });
  return {
    labels: keys.map(dayLabel),
    values: rates.map((value) => value ?? 0),
    hasData: rates.some((value) => value != null),
  };
}

function scoreDistribution(scores) {
  const buckets = [
    { label: '0-20%', min: 0, max: 20, color: '#f43f5e' },
    { label: '21-40%', min: 21, max: 40, color: '#f97316' },
    { label: '41-60%', min: 41, max: 60, color: '#eab308' },
    { label: '61-80%', min: 61, max: 80, color: '#3b82f6' },
    { label: '81-100%', min: 81, max: 100, color: '#22c55e' },
  ];
  return buckets.map((bucket) => ({
    ...bucket,
    value: scores.filter((score) => score >= bucket.min && score <= bucket.max).length,
  }));
}

export function buildTokenDetailModel({ token, stats, interviews = [], results = [] }) {
  const key = resolveTokenKey(token);
  const normalized = normalizeInterviewStats(stats || EMPTY_INTERVIEW_STATS);
  const total = normalized.totalInterviews;
  const completed = normalized.completedInterviews;
  const pending = Math.max(0, total - completed);
  const completionPct = percent(completed, total);
  const scores = scoredResults(results).map((item) => Number(item.overallScore));
  const highest = scores.length ? Math.max(...scores) : null;
  const lowest = scores.length ? Math.min(...scores) : null;
  const passed = results.filter((item) => item.passFail === true).length;
  const failed = results.filter((item) => item.passFail === false).length;
  const passedPct = percent(passed, completed);
  const failedPct = percent(failed, completed);
  const trend = buildTrend(interviews);
  const completionTrend = buildCompletionTrend(interviews);
  const passTrend = buildPassTrend(results);
  const distribution = scoreDistribution(scores);
  const meta = TOKEN_META[key] || TOKEN_META.total;

  const resultByInterviewId = results.reduce((acc, item) => {
    acc[item.interviewId] = item;
    return acc;
  }, {});

  const recentRows = interviews.map((interview) => {
    const result = resultByInterviewId[interview.id] || resultByInterviewId[interview._id];
    return {
      id: interview._id || interview.id,
      name: interviewDisplayName(interview),
      role: interviewRole(interview),
      date: interview.createdAt,
      status: interview.status,
      score: result && Number.isFinite(Number(result.overallScore)) ? Number(result.overallScore) : null,
      passed: result ? Boolean(result.passFail) : null,
    };
  });

  const models = {
    total: {
      key: 'total',
      ...meta,
      accent: 'violet',
      mainValue: total,
      mainLabel: 'Total Interviews',
      metrics: [
        { label: 'Completed', value: completed, hint: total ? `${completionPct}%` : null, tone: 'success' },
        { label: 'Pending', value: pending, hint: total ? `${percent(pending, total)}%` : null, tone: 'info' },
        { label: 'Total', value: total, hint: total ? '100%' : null, tone: 'violet' },
      ],
      charts: [
        {
          id: 'interview-trend',
          type: 'grouped-bar',
          title: 'Interview Trend',
          empty: 'No interviews in the last 7 days yet.',
          hasData: trend.hasData,
          labels: trend.labels,
          series: [
            { label: 'Completed', data: trend.completed, color: '#22c55e' },
            { label: 'Pending', data: trend.pending, color: '#3b82f6' },
          ],
        },
      ],
      table: {
        title: 'Recent Interviews',
        columns: ['name', 'role', 'date', 'status'],
        rows: recentRows,
      },
    },
    completed: {
      key: 'completed',
      ...meta,
      accent: 'emerald',
      mainValue: completed,
      mainLabel: 'Completed Interviews',
      metrics: [
        { label: 'Total Interviews', value: total, tone: 'violet' },
        { label: 'Completed', value: completed, hint: total ? `${completionPct}%` : null, tone: 'success' },
        { label: 'Pending', value: pending, hint: total ? `${percent(pending, total)}%` : null, tone: 'info' },
      ],
      charts: [
        {
          id: 'completion-rate',
          type: 'doughnut',
          title: 'Completion Rate',
          empty: 'Complete an interview to see completion rate.',
          hasData: total > 0 && (completed > 0 || pending > 0),
          centerValue: `${completionPct}%`,
          slices: [
            { label: 'Completed', value: completed, color: '#22c55e' },
            { label: 'Pending', value: pending, color: '#3b82f6' },
          ],
        },
        {
          id: 'completion-trend',
          type: 'line',
          title: 'Completion Trend',
          empty: 'No completed interviews in the last 7 days yet.',
          hasData: completionTrend.hasData,
          labels: completionTrend.labels,
          color: '#22c55e',
          values: completionTrend.values,
        },
      ],
      table: {
        title: 'Completed Interviews',
        columns: ['name', 'role', 'date', 'status'],
        rows: recentRows.filter((row) => row.status === 'COMPLETED'),
      },
    },
    average: {
      key: 'average',
      ...meta,
      accent: 'violet',
      mainValue: `${normalized.averageScore}%`,
      mainLabel: 'Average Score',
      metrics: [
        ...(highest != null ? [{ label: 'Highest Score', value: `${highest}%`, tone: 'success' }] : []),
        ...(lowest != null ? [{ label: 'Lowest Score', value: `${lowest}%`, tone: 'warning' }] : []),
        { label: 'Total Attempts', value: scores.length, tone: 'info' },
        { label: 'Completed', value: completed, tone: 'violet' },
      ],
      charts: [
        {
          id: 'score-distribution',
          type: 'bar',
          title: 'Score Distribution',
          empty: 'Score a completed interview to see distribution.',
          hasData: scores.length > 0,
          labels: distribution.map((item) => item.label),
          color: '#8b5cf6',
          values: distribution.map((item) => item.value),
          colors: distribution.map((item) => item.color),
        },
        {
          id: 'score-breakdown',
          type: 'breakdown',
          title: 'Score Breakdown',
          empty: 'No scored reports yet.',
          hasData: scores.length > 0,
          items: distribution.map((item) => ({
            label: item.label,
            value: scores.length ? percent(item.value, scores.length) : 0,
            count: item.value,
            color: item.color,
          })),
        },
      ],
      table: null,
    },
    pass: {
      key: 'pass',
      ...meta,
      accent: 'rose',
      mainValue: `${normalized.passRate}%`,
      mainLabel: 'Pass Rate',
      metrics: [
        { label: 'Total Interviews', value: total, tone: 'violet' },
        { label: 'Passed', value: passed, hint: completed ? `${passedPct}%` : null, tone: 'success' },
        { label: 'Failed', value: failed, hint: completed ? `${failedPct}%` : null, tone: 'danger' },
      ],
      charts: [
        {
          id: 'pass-rate',
          type: 'doughnut',
          title: 'Pass Rate',
          empty: 'Complete interviews to see pass rate.',
          hasData: completed > 0 && results.length > 0 && (passed > 0 || failed > 0),
          centerValue: `${normalized.passRate}%`,
          slices: [
            { label: 'Passed', value: passed, color: '#22c55e' },
            { label: 'Failed', value: failed, color: '#f43f5e' },
          ],
        },
        {
          id: 'result-trend',
          type: 'line',
          title: 'Result Trend',
          empty: 'No results in the last 7 days yet.',
          hasData: passTrend.hasData,
          labels: passTrend.labels,
          color: '#ec4899',
          values: passTrend.values,
        },
      ],
      table: {
        title: 'Recent Results',
        columns: ['name', 'role', 'score', 'result', 'date'],
        rows: recentRows.filter((row) => row.score != null),
      },
    },
  };

  return models[key] || models.total;
}

export function buildProgressOverview({ stats, interviews = [], results = [] }) {
  const total = buildTokenDetailModel({ token: 'total', stats, interviews, results });
  const completed = buildTokenDetailModel({ token: 'completed', stats, interviews, results });
  const average = buildTokenDetailModel({ token: 'average', stats, interviews, results });
  const pass = buildTokenDetailModel({ token: 'pass', stats, interviews, results });
  const pendingMetric = total.metrics.find((item) => item.label === 'Pending');
  const completionHint = total.metrics.find((item) => item.label === 'Completed')?.hint;

  return {
    metrics: [
      { label: 'Total Interviews', value: total.mainValue, tone: 'violet' },
      { label: 'Completed Interviews', value: completed.mainValue, hint: completionHint, tone: 'success' },
      { label: 'Pending Interviews', value: pendingMetric?.value ?? 0, hint: pendingMetric?.hint, tone: 'info' },
      { label: 'Average Score', value: average.mainValue, tone: 'violet' },
      { label: 'Pass Rate', value: pass.mainValue, tone: 'danger' },
      { label: 'Completion Rate', value: completionHint || '0%', tone: 'success' },
    ],
    completionRate: completionHint || '0%',
    charts: [...total.charts, ...completed.charts, ...average.charts, ...pass.charts],
    table: {
      title: 'Recent Interviews',
      columns: ['name', 'role', 'date', 'score', 'status'],
      rows: total.table?.rows || [],
    },
  };
}
