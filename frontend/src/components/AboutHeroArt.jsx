export default function AboutHeroArt({ className = 'h-64 w-full' }) {
  return (
    <svg viewBox="0 0 420 320" className={className} aria-hidden="true">
      <ellipse cx="210" cy="292" rx="110" ry="16" fill="#c7d2fe" opacity="0.45" />
      <rect x="248" y="48" width="86" height="54" rx="14" fill="white" stroke="#e2e8f0" />
      <rect x="260" y="62" width="28" height="8" rx="4" fill="#93c5fd" />
      <rect x="260" y="76" width="48" height="6" rx="3" fill="#e2e8f0" />
      <circle cx="318" cy="72" r="12" fill="#a78bfa" />
      <rect x="42" y="86" width="64" height="40" rx="12" fill="white" stroke="#e2e8f0" />
      <rect x="54" y="104" width="8" height="16" rx="2" fill="#60a5fa" />
      <rect x="66" y="96" width="8" height="24" rx="2" fill="#818cf8" />
      <rect x="78" y="100" width="8" height="20" rx="2" fill="#34d399" />
      <g transform="translate(128 58)">
        <rect x="36" y="118" width="92" height="28" rx="14" fill="#93c5fd" />
        <rect x="28" y="40" width="108" height="92" rx="36" fill="#e0f2fe" />
        <rect x="40" y="54" width="84" height="52" rx="18" fill="#0f172a" />
        <circle cx="66" cy="78" r="6" fill="#38bdf8" />
        <circle cx="98" cy="78" r="6" fill="#38bdf8" />
        <rect x="70" y="92" width="24" height="4" rx="2" fill="#64748b" />
        <circle cx="82" cy="28" r="22" fill="#e0f2fe" />
        <circle cx="82" cy="28" r="14" fill="#38bdf8" />
        <rect x="64" y="148" width="18" height="42" rx="8" fill="#7dd3fc" />
        <rect x="82" y="148" width="18" height="42" rx="8" fill="#7dd3fc" />
        <rect x="70" y="108" width="24" height="18" rx="6" fill="#38bdf8" />
        <text x="74" y="121" fontSize="9" fontWeight="700" fill="white">IQ</text>
      </g>
      <rect x="286" y="168" width="92" height="44" rx="16" fill="white" stroke="#e2e8f0" />
      <text x="300" y="186" fontSize="9" fill="#64748b">Better skills,</text>
      <text x="300" y="200" fontSize="9" fontWeight="700" fill="#4f46e5">Bigger Opportunities.</text>
      <path d="M78 168 C88 148, 108 148, 118 168" fill="none" stroke="#38bdf8" strokeWidth="4" />
      <path d="M78 176 C90 160, 106 160, 118 176" fill="none" stroke="#818cf8" strokeWidth="3" />
    </svg>
  );
}

export function AboutCtaArt({ className = 'h-48 w-full' }) {
  return (
    <svg viewBox="0 0 360 220" className={className} aria-hidden="true">
      <rect x="78" y="38" width="204" height="132" rx="16" fill="#1e293b" />
      <rect x="90" y="50" width="180" height="96" rx="8" fill="#e0f2fe" />
      <circle cx="180" cy="98" r="28" fill="#38bdf8" />
      <rect x="168" y="82" width="24" height="36" rx="8" fill="white" />
      <rect x="110" y="178" width="140" height="12" rx="6" fill="#cbd5e1" />
      <circle cx="64" cy="70" r="18" fill="white" />
      <rect x="58" y="64" width="12" height="12" rx="2" fill="#818cf8" />
      <circle cx="300" cy="86" r="16" fill="white" />
      <rect x="292" y="80" width="6" height="12" rx="1" fill="#22c55e" />
      <rect x="300" y="76" width="6" height="16" rx="1" fill="#38bdf8" />
      <rect x="308" y="82" width="6" height="10" rx="1" fill="#a78bfa" />
      <circle cx="52" cy="150" r="14" fill="white" />
      <circle cx="52" cy="144" r="5" fill="#94a3b8" />
      <rect x="44" y="152" width="16" height="8" rx="4" fill="#c4b5fd" />
    </svg>
  );
}
