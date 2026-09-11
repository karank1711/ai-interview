import { useEffect, useState } from 'react';
import './sidebarMotion.css';

const SMOKE_PUFFS = [
  { w: 18, h: 16, delay: 0, life: 1.7, drift: -10 },
  { w: 22, h: 18, delay: 0.12, life: 1.9, drift: 8 },
  { w: 16, h: 14, delay: 0.22, life: 1.55, drift: -4 },
  { w: 26, h: 20, delay: 0.34, life: 2.1, drift: 14 },
  { w: 20, h: 17, delay: 0.46, life: 1.8, drift: -16 },
  { w: 24, h: 19, delay: 0.58, life: 2.0, drift: 3 },
  { w: 14, h: 12, delay: 0.7, life: 1.45, drift: -8 },
  { w: 28, h: 22, delay: 0.08, life: 2.25, drift: 12 },
  { w: 19, h: 16, delay: 0.82, life: 1.75, drift: -12 },
  { w: 23, h: 18, delay: 0.94, life: 1.95, drift: 6 },
  { w: 17, h: 15, delay: 1.06, life: 1.6, drift: -2 },
  { w: 30, h: 24, delay: 0.28, life: 2.4, drift: 18 },
  { w: 21, h: 18, delay: 1.18, life: 1.85, drift: -14 },
  { w: 25, h: 20, delay: 0.4, life: 2.15, drift: 9 },
];

function readIsDark() {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.classList.contains('dark')) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function RocketLaunch({
  src = '/images/rocket.png',
  className = 'h-28 w-16',
}) {
  const [isDark, setIsDark] = useState(readIsDark);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setIsDark(readIsDark());
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    media.addEventListener('change', sync);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', sync);
    };
  }, []);

  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden="true">
      <div className="rocket-launch pointer-events-none absolute inset-0">
        <img
          src={src}
          alt=""
          draggable="false"
          className="absolute left-1/2 top-0 z-20 h-[58%] w-[90%] -translate-x-1/2 object-contain object-top mix-blend-screen"
        />
        <span className="rocket-flame rocket-flame--left" />
        <span className="rocket-flame rocket-flame--center" />
        <span className="rocket-flame rocket-flame--right" />
        <div className="rocket-smoke">
          {SMOKE_PUFFS.map((puff, index) => (
            <span
              key={index}
              className={`rocket-smoke-puff ${isDark ? 'is-dark' : 'is-light'}`}
              style={{
                width: `${puff.w}px`,
                height: `${puff.h}px`,
                '--delay': `${puff.delay}s`,
                '--life': `${puff.life}s`,
                '--drift': `${puff.drift}px`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
