export default function InterviewTranscriptBox({
  title,
  value,
  onChange,
  readOnly = false,
  placeholder = '',
  accent = 'purple',
  compact = false,
}) {
  const accentClass =
    accent === 'green'
      ? 'text-emerald-400 border-emerald-500/30'
      : 'text-violet-300 border-violet-500/30';
  const bodyClass = compact
    ? 'min-h-[4.75rem] max-h-[8.5rem] flex-1 overflow-y-auto scrollbar-hide sm:max-h-none'
    : 'min-h-[96px]';

  return (
    <div className={`flex h-full min-h-0 min-w-0 flex-col rounded-2xl border bg-slate-900/80 p-3 sm:p-4 ${accentClass}`}>
      <p className={`mb-2 truncate text-[clamp(0.75rem,3.2vw,0.875rem)] font-semibold ${accent === 'green' ? 'text-emerald-400' : 'text-violet-300'}`}>
        {title}
      </p>
      {readOnly ? (
        <div className={`${bodyClass} whitespace-pre-wrap break-words text-sm leading-6 text-slate-100`}>
          {value || placeholder}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          rows={compact ? 3 : 4}
          className={`w-full ${bodyClass} resize-none bg-transparent text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:outline-none`}
        />
      )}
    </div>
  );
}
