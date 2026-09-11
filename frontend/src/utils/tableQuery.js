export const DEFAULT_PAGE_SIZE = 10;

function statusLabel(status) {
  return status === 'COMPLETED' ? 'Completed' : 'Pending';
}

export function formatTableDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

export function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value != null && value !== ''))].sort((a, b) => (
    String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
  ));
}

export function buildInterviewFilterOptions(rows = []) {
  return {
    interview: uniqueSorted(rows.map((row) => row.name)),
    role: uniqueSorted(rows.map((row) => row.role)),
    date: uniqueSorted(rows.map((row) => formatTableDate(row.date)).filter((value) => value !== '—')),
    status: uniqueSorted(rows.map((row) => statusLabel(row.status))),
  };
}

export function applyInterviewFilters(rows = [], filters = {}) {
  return rows.filter((row) => {
    if (filters.interview && row.name !== filters.interview) return false;
    if (filters.role && row.role !== filters.role) return false;
    if (filters.date && formatTableDate(row.date) !== filters.date) return false;
    if (filters.status && statusLabel(row.status) !== filters.status) return false;
    return true;
  });
}

export function paginateRows(rows = [], page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const size = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const start = (current - 1) * size;
  return {
    page: current,
    pageSize: size,
    total,
    totalPages,
    start: total ? start + 1 : 0,
    end: Math.min(start + size, total),
    rows: rows.slice(start, start + size),
    hasPrevious: current > 1,
    hasNext: current < totalPages,
  };
}

export const EMPTY_INTERVIEW_FILTERS = {
  interview: '',
  role: '',
  date: '',
  status: '',
};
