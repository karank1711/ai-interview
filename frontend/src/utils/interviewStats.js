export const EMPTY_INTERVIEW_STATS = {
  totalInterviews: 0,
  completedInterviews: 0,
  averageScore: 0,
  passRate: 0,
};

export function normalizeInterviewStats(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    totalInterviews: Number(source.totalInterviews) || 0,
    completedInterviews: Number(source.completedInterviews) || 0,
    averageScore: Number(source.averageScore) || 0,
    passRate: Number(source.passRate) || 0,
  };
}

export function interviewStatPercent(part, whole) {
  if (!whole) return 0;
  return Math.round((Number(part) / Number(whole)) * 100);
}

export function interviewTokenPath(key) {
  return `/dashboard/details?token=${key}`;
}

export function getInterviewStatCards(stats) {
  const normalized = normalizeInterviewStats(stats);
  return [
    {
      key: 'total',
      title: 'Total Interviews',
      shortTitle: 'Total Interviews',
      value: normalized.totalInterviews,
    },
    {
      key: 'completed',
      title: 'Completed Interviews',
      shortTitle: 'Completed',
      value: normalized.completedInterviews,
      progress: interviewStatPercent(normalized.completedInterviews, normalized.totalInterviews),
    },
    {
      key: 'average',
      title: 'Average Score',
      shortTitle: 'Average Score',
      value: `${normalized.averageScore}%`,
      ring: normalized.averageScore,
    },
    {
      key: 'pass',
      title: 'Pass Rate',
      shortTitle: 'Pass Rate',
      value: `${normalized.passRate}%`,
      ring: normalized.passRate,
    },
  ];
}
