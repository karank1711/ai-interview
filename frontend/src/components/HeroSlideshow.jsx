import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export const HERO_SLIDES = [
  {
    png: '/hero-slides/banner-1.png',
    webp: '/hero-slides/banner-1.webp',
    avif: '/hero-slides/banner-1.avif',
  },
  {
    png: '/hero-slides/banner-2.png',
    webp: '/hero-slides/banner-2.webp',
    avif: '/hero-slides/banner-2.avif',
  },
  {
    png: '/hero-slides/banner-3.png',
    webp: '/hero-slides/banner-3.webp',
    avif: '/hero-slides/banner-3.avif',
  },
  {
    png: '/hero-slides/banner-4.png',
    webp: '/hero-slides/banner-4.webp',
    avif: '/hero-slides/banner-4.avif',
  },
  {
    png: '/hero-slides/banner-5.png',
    webp: '/hero-slides/banner-5.webp',
    avif: '/hero-slides/banner-5.avif',
  },
  {
    png: '/hero-slides/banner-6.png',
    webp: '/hero-slides/banner-6.webp',
    avif: '/hero-slides/banner-6.avif',
  },
];

export const HERO_SLIDE_WIDTH = 1280;
export const HERO_SLIDE_HEIGHT = 720;

const FADE_TRANSITION = { duration: 1.15, ease: [0.4, 0, 0.2, 1] };

function normalizeSlide(slide) {
  if (typeof slide === 'string') {
    return { png: slide, webp: '', avif: '' };
  }
  return {
    png: slide?.png || '',
    webp: slide?.webp || '',
    avif: slide?.avif || '',
  };
}

function slideKey(slide, slideIndex) {
  return `${slide.png || slide.webp || slide.avif || 'slide'}-${slideIndex}`;
}

function preferredSrc(slide) {
  return slide?.avif || slide?.webp || slide?.png || '';
}

function preloadImage(url) {
  if (!url || typeof window === 'undefined') return;
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
}

function HeroSlideshow({
  slides = HERO_SLIDES,
  intervalMs = 4500,
  showControls = false,
  objectFit = 'cover',
  onIndexChange,
}) {
  const normalizedSlides = useMemo(
    () => (Array.isArray(slides) ? slides.map(normalizeSlide).filter((slide) => preferredSrc(slide)) : []),
    [slides]
  );
  const [index, setIndex] = useState(0);
  const [readyIndexes, setReadyIndexes] = useState(() => new Set([0]));
  const count = normalizedSlides.length || 1;
  const fitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover';
  const touchStartX = useRef(null);

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

  useEffect(() => {
    const first = normalizedSlides[0];
    const preferred = preferredSrc(first);
    if (!preferred) return undefined;

    let link = document.head.querySelector('link[data-hero-preload="true"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.setAttribute('data-hero-preload', 'true');
      document.head.appendChild(link);
    }
    link.href = preferred;
    if (first.avif) link.type = 'image/avif';
    else if (first.webp) link.type = 'image/webp';
    else link.removeAttribute('type');

    return undefined;
  }, [normalizedSlides]);

  useEffect(() => {
    const neighbors = [
      index,
      (index + 1) % count,
      (index - 1 + count) % count,
    ];
    setReadyIndexes((current) => {
      const next = new Set(current);
      let changed = false;
      neighbors.forEach((slideIndex) => {
        if (!next.has(slideIndex)) {
          next.add(slideIndex);
          changed = true;
        }
      });
      return changed ? next : current;
    });

    neighbors.forEach((slideIndex) => {
      const slide = normalizedSlides[slideIndex];
      if (!slide) return;
      preloadImage(preferredSrc(slide));
    });
  }, [count, index, normalizedSlides]);

  const go = (direction) => {
    setIndex((current) => (current + direction + count) % count);
  };

  const onTouchStart = (event) => {
    touchStartX.current = event.changedTouches?.[0]?.clientX ?? null;
  };

  const onTouchEnd = (event) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = event.changedTouches?.[0]?.clientX;
    if (end == null) return;
    const delta = end - start;
    if (Math.abs(delta) < 40) return;
    go(delta > 0 ? -1 : 1);
  };

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-slate-950"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {normalizedSlides.map((slide, slideIndex) => {
        const active = slideIndex === index;
        if (!readyIndexes.has(slideIndex) && !active) return null;

        return (
          <motion.div
            key={slideKey(slide, slideIndex)}
            className="pointer-events-none absolute inset-0 h-full w-full"
            initial={false}
            animate={{
              opacity: active ? 1 : 0,
              x: active ? 0 : 28,
            }}
            transition={FADE_TRANSITION}
          >
            <picture className="block h-full w-full">
              {slide.avif ? <source srcSet={slide.avif} type="image/avif" /> : null}
              {slide.webp ? <source srcSet={slide.webp} type="image/webp" /> : null}
              <img
                src={slide.png || slide.webp || slide.avif}
                alt=""
                width={HERO_SLIDE_WIDTH}
                height={HERO_SLIDE_HEIGHT}
                className={`h-full w-full ${fitClass} object-center`}
                loading={slideIndex === 0 ? 'eager' : 'lazy'}
                fetchPriority={slideIndex === 0 ? 'high' : 'low'}
                decoding={slideIndex === 0 ? 'sync' : 'async'}
                draggable="false"
              />
            </picture>
          </motion.div>
        );
      })}

      {showControls && count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/35 md:flex md:left-5"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/35 md:flex md:right-5"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <div className="absolute bottom-2 left-1/2 z-20 hidden -translate-x-1/2 gap-2 md:flex">
            {normalizedSlides.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                aria-label={`Go to slide ${dotIndex + 1}`}
                onClick={() => setIndex(dotIndex)}
                className="flex h-11 w-11 items-center justify-center sm:h-auto sm:w-auto"
              >
                <span
                  className={`block h-2.5 w-2.5 rounded-full transition ${
                    dotIndex === index ? 'bg-sky-400' : 'bg-white/50 hover:bg-white/80'
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default HeroSlideshow;
