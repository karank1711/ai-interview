export default function TokenHeroArt({ token = 'total', className = 'h-28 w-28' }) {
  const arts = {
    total: (
      <svg viewBox="0 0 128 128" className={className} aria-hidden="true">
        <rect x="18" y="28" width="72" height="56" rx="10" fill="#8b5cf6" />
        <rect x="38" y="18" width="72" height="56" rx="10" fill="#a78bfa" />
        <rect x="46" y="38" width="36" height="6" rx="3" fill="white" opacity="0.9" />
        <rect x="46" y="50" width="48" height="5" rx="2.5" fill="white" opacity="0.55" />
        <rect x="46" y="62" width="28" height="5" rx="2.5" fill="white" opacity="0.4" />
      </svg>
    ),
    completed: (
      <svg viewBox="0 0 128 128" className={className} aria-hidden="true">
        <circle cx="64" cy="64" r="40" fill="#22c55e" />
        <path d="M46 66 l12 12 24-26" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    average: (
      <svg viewBox="0 0 128 128" className={className} aria-hidden="true">
        <rect x="24" y="72" width="16" height="28" rx="4" fill="#c4b5fd" />
        <rect x="48" y="52" width="16" height="48" rx="4" fill="#8b5cf6" />
        <rect x="72" y="36" width="16" height="64" rx="4" fill="#6366f1" />
        <path d="M28 40 C48 20, 80 28, 100 18" fill="none" stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" />
        <circle cx="100" cy="18" r="7" fill="#38bdf8" />
      </svg>
    ),
    pass: (
      <svg viewBox="0 0 128 128" className={className} aria-hidden="true">
        <path d="M64 16 l36 12 v28 c0 28-16 48-36 56 C44 104 28 84 28 56 V28 Z" fill="#fb7185" />
        <path d="M50 64 l10 10 18-20" fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  return arts[token] || arts.total;
}
