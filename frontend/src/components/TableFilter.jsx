import { useEffect, useMemo, useRef, useState } from 'react';
import { FunnelIcon } from '@heroicons/react/24/outline';
import SelectDropdown from './SelectDropdown';
import { EMPTY_INTERVIEW_FILTERS } from '../utils/tableQuery';

const FILTER_FIELDS = [
  { key: 'interview', label: 'Interview' },
  { key: 'role', label: 'Role' },
  { key: 'date', label: 'Date' },
  { key: 'status', label: 'Status' },
];

export default function TableFilter({
  options,
  value = EMPTY_INTERVIEW_FILTERS,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const activeCount = useMemo(
    () => FILTER_FIELDS.filter((field) => value[field.key]).length,
    [value],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target) && !event.target.closest('[data-select-dropdown-menu]')) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const update = (key, nextValue) => {
    onChange?.({ ...value, [key]: nextValue });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <FunnelIcon className="h-4 w-4" />
        Filter
        {activeCount > 0 ? (
          <span className="rounded-full bg-indigo-100 px-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute left-0 z-20 mt-2 w-[min(100vw-2rem,18rem)] rounded-2xl border border-slate-100 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <div className="space-y-3">
            {FILTER_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {field.label}
                </span>
                <SelectDropdown
                  aria-label={field.label}
                  value={value[field.key] || ''}
                  onChange={(nextValue) => update(field.key, nextValue)}
                  placeholder="All"
                  options={[
                    { value: '', label: 'All' },
                    ...(options[field.key] || []).map((option) => ({ value: option, label: option })),
                  ]}
                />
              </label>
            ))}
          </div>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={() => onChange?.(EMPTY_INTERVIEW_FILTERS)}
              className="mt-4 w-full cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
