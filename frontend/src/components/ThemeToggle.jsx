import { MoonIcon, SunIcon } from '@heroicons/react/24/solid';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`relative z-[60] flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors sm:h-10 sm:w-10 ${
        isDark
          ? 'bg-white/10 text-slate-100 ring-1 ring-white/40 hover:bg-white/15'
          : 'bg-amber-50 text-amber-500 ring-1 ring-amber-300 hover:bg-amber-100'
      } ${className}`}
    >
      {isDark ? (
        <MoonIcon className="h-6 w-6 drop-shadow-[0_0_8px_rgba(226,232,240,0.7)]" />
      ) : (
        <SunIcon className="h-6 w-6 drop-shadow-[0_0_8px_rgba(245,158,11,0.55)]" />
      )}
    </button>
  );
}
