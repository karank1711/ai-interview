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
  const bodyClass = compact ? 'min-h-[64px] max-h-[96px] overflow-y-auto' : 'min-h-[96px]';

  return (
    <div className={`rounded-2xl border bg-slate-900/80 p-4 h-full ${accentClass}`}>
      <p className={`text-sm font-semibold mb-2 ${accent === 'green' ? 'text-emerald-400' : 'text-violet-300'}`}>
        {title}
      </p>
      {readOnly ? (
        <div className={`${bodyClass} whitespace-pre-wrap text-sm leading-6 text-slate-100`}>
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
