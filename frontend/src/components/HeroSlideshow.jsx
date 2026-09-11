import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export const HERO_SLIDES = [
  '/hero-slides/banner-1.png',
  '/hero-slides/banner-2.png',
  '/hero-slides/banner-3.png',
  '/hero-slides/banner-4.png',
  '/hero-slides/banner-5.png',
  '/hero-slides/banner-6.png',
];

const FADE_TRANSITION = { duration: 1.15, ease: [0.4, 0, 0.2, 1] };

function HeroSlideshow({
  slides = HERO_SLIDES,
  intervalMs = 4500,
  showControls = false,
  objectFit = 'cover',
  onIndexChange,
}) {
  const [index, setIndex] = useState(0);
  const count = slides.length || 1;
  const fitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover';

  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  useEffect(() => {
    if (count < 2) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [count, intervalMs]);

  const go = (direction) => {
    setIndex((current) => (current + direction + count) % count);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-950">
      {slides.map((src, slideIndex) => {
        const active = slideIndex === index;
        return (
          <motion.img
            key={`${src}-${slideIndex}`}
            src={src}
            alt=""
            className={`pointer-events-none absolute inset-0 h-full w-full ${fitClass} object-center`}
            initial={false}
            animate={{
              opacity: active ? 1 : 0,
              x: active ? 0 : 28,
            }}
            transition={FADE_TRANSITION}
            draggable="false"
          />
        );
      })}

      {showControls && count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/35 md:left-5"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/35 md:right-5"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                aria-label={`Go to slide ${dotIndex + 1}`}
                onClick={() => setIndex(dotIndex)}
                className={`h-2.5 w-2.5 rounded-full transition ${
                  dotIndex === index ? 'bg-sky-400' : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default HeroSlideshow;
