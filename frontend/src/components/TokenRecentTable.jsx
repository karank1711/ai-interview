import { useEffect, useMemo, useState } from 'react';
import AnimatedCounter from './AnimatedCounter';
import InterviewStatusBadge from './InterviewStatusBadge';
import TableFilter from './TableFilter';
import TablePagination from './TablePagination';
import {
  applyInterviewFilters,
  buildInterviewFilterOptions,
  DEFAULT_PAGE_SIZE,
  EMPTY_INTERVIEW_FILTERS,
  formatTableDate,
  paginateRows,
} from '../utils/tableQuery';

function resultBadge(passed) {
  return passed
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
}

const COLUMN_LABELS = {
  name: 'Interview',
  role: 'Role',
  date: 'Date',
  status: 'Status',
  score: 'Score',
  result: 'Result',
};

function ScoreCell({ score }) {
  if (score == null) return '—';
  return <AnimatedCounter value={`${score}%`} />;
}

function ResultCell({ passed }) {
  if (passed == null) return '—';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${resultBadge(passed)}`}>
      {passed ? 'Passed' : 'Failed'}
    </span>
  );
}

function CellValue({ column, row }) {
  if (column === 'name') return <span className="font-medium text-slate-900 dark:text-white">{row.name}</span>;
  if (column === 'role') return row.role;
  if (column === 'date') return formatTableDate(row.date);
  if (column === 'status') return <InterviewStatusBadge status={row.status} interviewId={row.id} />;
  if (column === 'score') return <ScoreCell score={row.score} />;
  if (column === 'result') return <ResultCell passed={row.passed} />;
  return null;
}

export default function TokenRecentTable({ table, pageSize = DEFAULT_PAGE_SIZE }) {
  const [filters, setFilters] = useState(EMPTY_INTERVIEW_FILTERS);
  const [page, setPage] = useState(1);

  const rows = table?.rows || [];
  const columns = table?.columns || [];
  const options = useMemo(() => buildInterviewFilterOptions(rows), [rows]);
  const filteredRows = useMemo(() => applyInterviewFilters(rows, filters), [rows, filters]);
  const paged = useMemo(
    () => paginateRows(filteredRows, page, pageSize),
    [filteredRows, page, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [filters]);

  if (!table) return null;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{table.title}</h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Page {paged.page} of {paged.totalPages}
        </p>
      </div>

      <div className="mb-4">
        <TableFilter options={options} value={filters} onChange={setFilters} />
      </div>

      {!filteredRows.length ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {rows.length ? 'No interviews match the selected filters.' : 'No matching interviews yet.'}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {columns.map((column) => (
                    <th key={column} className="px-3 py-3 font-medium">{COLUMN_LABELS[column]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0 dark:border-slate-700/60">
                    {columns.map((column) => (
                      <td key={column} className="px-3 py-3 text-slate-700 dark:text-slate-200">
                        <CellValue column={column} row={row} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {paged.rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{row.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{row.role} · {formatTableDate(row.date)}</p>
                    {row.score != null ? (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Score <ScoreCell score={row.score} />
                      </p>
                    ) : null}
                  </div>
                  <InterviewStatusBadge status={row.status} interviewId={row.id} />
                </div>
              </div>
            ))}
          </div>

          <TablePagination
            className="mt-5 justify-between"
            page={paged.page}
            totalPages={paged.totalPages}
            hasPrevious={paged.hasPrevious}
            hasNext={paged.hasNext}
            onPrevious={() => setPage((current) => current - 1)}
            onNext={() => setPage((current) => current + 1)}
          />
        </>
      )}
    </div>
  );
}
