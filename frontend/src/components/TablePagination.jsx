export default function TablePagination({
  page,
  totalPages,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  showSummary = false,
  className = '',
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {showSummary ? (
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Page {page} of {totalPages}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasPrevious}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 enabled:cursor-pointer enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:enabled:hover:bg-slate-700"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 enabled:cursor-pointer enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:enabled:hover:bg-slate-700"
        >
          Next
        </button>
      </div>
    </div>
  );
}
