import AnimatedCounter from './AnimatedCounter';

const TONE_STYLES = {
  success: 'bg-emerald-500',
  info: 'bg-sky-500',
  violet: 'bg-violet-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
};

export default function DetailMetricCard({ label, value, hint, tone = 'violet' }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-md ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
      <div className="flex items-center gap-3">
        <span className={`h-10 w-10 shrink-0 rounded-xl ${TONE_STYLES[tone] || TONE_STYLES.violet}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-white">
            <AnimatedCounter value={value} />
            {hint ? <span className="ml-2 text-sm font-medium text-slate-400">{hint}</span> : null}
          </p>
        </div>
      </div>
    </div>
  );
}
