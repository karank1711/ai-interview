import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AcademicCapIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import HeroRobotBanner from '../components/HeroRobotBanner';
import InterviewStatTokens from '../components/InterviewStatTokens';
import { TESTIMONIAL_AVATARS } from '../components/AvatarStack';
import { interviewService } from '../services/interviewService';
import { readPageCache } from '../utils/pageDataCache';
import { EMPTY_INTERVIEW_STATS, normalizeInterviewStats } from '../utils/interviewStats';

const DASHBOARD_CACHE_KEY = 'dashboard:v2';

const INFO_CARDS = [
  {
    title: 'Our Mission',
    text: 'To democratize interview preparation by providing accessible, AI-powered practice for everyone.',
    icon: AcademicCapIcon,
    wrap: 'bg-sky-100 text-sky-600',
    border: 'border-sky-100',
  },
  {
    title: 'Our Team',
    text: 'Founded by experienced professionals from tech companies who understand the interview process.',
    icon: UserGroupIcon,
    wrap: 'bg-violet-100 text-violet-600',
    border: 'border-violet-100',
  },
  {
    title: 'Our Impact',
    text: 'Helped thousands of candidates improve their interview skills and land their dream jobs.',
    icon: ChartBarIcon,
    wrap: 'bg-emerald-100 text-emerald-600',
    border: 'border-emerald-100',
  },
];

const SUCCESS_FEATURES = [
  {
    title: 'AI-Powered Practice',
    text: 'Get real interview experience with our advanced AI system that simulates real-world scenarios.',
    icon: SparklesIcon,
    wrap: 'bg-violet-100 text-violet-600',
  },
  {
    title: 'Real-Time Feedback',
    text: 'Receive instant feedback on your answers, communication skills and confidence levels.',
    icon: ChatBubbleLeftRightIcon,
    wrap: 'bg-sky-100 text-sky-600',
  },
  {
    title: 'Personalized Progress',
    text: 'Track your progress with detailed insights and see where you can improve.',
    icon: ChartBarIcon,
    wrap: 'bg-emerald-100 text-emerald-600',
  },
  {
    title: 'Interview Confidence',
    text: 'Build confidence with unlimited practice and become ready for any interview.',
    icon: ShieldCheckIcon,
    wrap: 'bg-rose-100 text-rose-600',
  },
];

const TESTIMONIALS = [
  {
    name: 'Priya Sharma',
    role: 'Software Engineer',
    quote: 'InterviewIQ helped me practice calmly and walk into my interviews with a clear structure.',
    src: TESTIMONIAL_AVATARS[0].src,
  },
  {
    name: 'Rahul Mehta',
    role: 'Product Analyst',
    quote: 'The feedback after every answer showed me exactly what to improve next.',
    src: TESTIMONIAL_AVATARS[1].src,
  },
  {
    name: 'Ananya Iyer',
    role: 'Frontend Developer',
    quote: 'Mock interviews felt realistic. I landed my first offer after two weeks of practice.',
    src: TESTIMONIAL_AVATARS[2].src,
  },
];

export default function About() {
  const cached = readPageCache(DASHBOARD_CACHE_KEY);
  const [stats, setStats] = useState(cached?.stats || EMPTY_INTERVIEW_STATS);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await interviewService.getInterviewStats();
        if (cancelled) return;
        setStats(normalizeInterviewStats(response.data));
      } catch {
        if (!cancelled) setStats(cached?.stats || EMPTY_INTERVIEW_STATS);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-slate-50 py-8 dark:bg-[#070b16]">
      <div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-8">
        <HeroRobotBanner
          badge="About InterviewIQ"
          title="About InterviewIQ"
          subtitle="Empowering job seekers with AI-powered interview practice to help them land their dream jobs."
          variant="about"
          extra={
            <>
              Better skills,
              <br />
              Bigger Opportunities.
            </>
          }
        />

        <section className="mb-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {INFO_CARDS.map((card, index) => (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
              className={`rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-800 ${card.border} dark:border-slate-700`}
            >
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${card.wrap}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{card.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{card.text}</p>
              <Link
                to="/features"
                className="mt-6 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-600"
                aria-label={`Learn more about ${card.title}`}
              >
                <ArrowUpRightIcon className="h-4 w-4" />
              </Link>
            </motion.article>
          ))}
        </section>

        <section className="mb-14 text-center">
          <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            Why InterviewIQ?
          </span>
          <h2 className="mt-4 text-[clamp(1.35rem,5vw,1.875rem)] font-bold text-slate-900 dark:text-white">Built for Your Success</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-500 dark:text-slate-400">
            Practice with AI, get instant feedback, and track the skills that help you interview with confidence.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {SUCCESS_FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${feature.wrap}`}>
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="relative mb-14 overflow-hidden rounded-3xl bg-sky-50 p-6 dark:bg-slate-800/80 sm:p-10">
          <div className="relative">
            <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-slate-700 dark:text-sky-300">
              Our Numbers
            </span>
            <h2 className="mt-4 text-[clamp(1.35rem,5vw,1.875rem)] font-bold text-slate-900 dark:text-white">Real Impact, Real Results</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              These numbers come from your actual InterviewIQ interview activity.
            </p>
            <div className="mt-8">
              <InterviewStatTokens stats={stats} variant="about" />
            </div>
          </div>
        </section>

        <section className="mb-14">
          <div className="mb-6 text-center">
            <h2 className="text-[clamp(1.35rem,5vw,1.875rem)] font-bold text-slate-900 dark:text-white">Trusted by 10,000+ Learners</h2>
            <p className="mt-2 text-sm text-slate-500">See how InterviewIQ helps candidates practice with confidence.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <article key={item.name} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
                <div className="mb-3 flex items-center gap-3">
                  <img src={item.src} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.role}</p>
                  </div>
                </div>
                <div className="mb-2 flex text-amber-400">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <StarIcon key={index} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-slate-500">{item.quote}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
