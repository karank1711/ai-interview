import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import BackButton from '../components/BackButton';
import FeatureCard from '../components/FeatureCard';
import HeroRobotBanner from '../components/HeroRobotBanner';
import { TESTIMONIAL_AVATARS } from '../components/AvatarStack';

const features = [
  {
    name: 'AI-Powered Questions',
    description: 'Smart question generation based on your field and experience level',
    icon: SparklesIcon,
    route: '/ai-questions',
    cta: 'Open AI Questions',
    visual: 'questions',
    image: '/feature-tokens/ai-questions.png',
    imageAlt: 'AI interviewer robot generating interview questions',
    color: 'from-sky-400 to-blue-500',
    accent: {
      bar: 'bg-blue-500',
      icon: 'from-sky-400 to-blue-500',
      cta: 'text-blue-600 dark:text-blue-400',
    },
  },
  {
    name: 'Mock Test',
    description: 'Start a complete AI interview simulation with 5 unique questions',
    icon: ClipboardDocumentListIcon,
    route: '/mock-test',
    cta: 'Start Mock Test',
    visual: 'mock',
    image: '/feature-tokens/mock-interviews.png',
    imageAlt: 'Candidate in a live mock interview video session',
    color: 'from-emerald-400 to-emerald-600',
    accent: {
      bar: 'bg-emerald-500',
      icon: 'from-emerald-400 to-emerald-600',
      cta: 'text-emerald-600 dark:text-emerald-400',
    },
  },
  {
    name: 'Interview Tracking',
    description: 'Track your progress, scores, and long-term interview growth',
    icon: ShieldCheckIcon,
    route: '/progress',
    cta: 'View Progress',
    visual: 'progress',
    image: '/feature-tokens/progress-tracking.png',
    imageAlt: 'Interview progress dashboard with skill charts',
    color: 'from-pink-400 to-pink-600',
    accent: {
      bar: 'bg-pink-500',
      icon: 'from-pink-400 to-pink-600',
      cta: 'text-pink-600 dark:text-pink-400',
    },
  },
  {
    name: 'Real-time Feedback',
    description: 'Get instant analysis of your answers with detailed insights',
    icon: ChartBarIcon,
    route: '/feedback',
    cta: 'View Feedback',
    visual: 'feedback',
    image: '/feature-tokens/realtime-feedback.png',
    imageAlt: 'Real-time interview feedback analytics overlay',
    color: 'from-violet-400 to-violet-600',
    accent: {
      bar: 'bg-violet-500',
      icon: 'from-violet-400 to-violet-600',
      cta: 'text-violet-600 dark:text-violet-400',
    },
  },
  {
    name: 'Personalized Learning',
    description: 'Custom recommendations based on your performance and goals',
    icon: LightBulbIcon,
    route: '/progress',
    cta: 'Open Insights',
    visual: 'progress',
    image: '/feature-tokens/secure-platform.png',
    imageAlt: 'Personalized learning and secure interview insights',
    color: 'from-amber-400 to-orange-500',
    accent: {
      bar: 'bg-amber-500',
      icon: 'from-amber-400 to-orange-500',
      cta: 'text-amber-600 dark:text-amber-400',
    },
  },
  {
    name: 'Progress Analysis',
    description: 'Visualize your growth with charts and detailed reports',
    icon: ChartBarIcon,
    route: '/dashboard/details',
    cta: 'View Insights',
    visual: 'feedback',
    image: '/feature-tokens/availability.png',
    imageAlt: 'Always-on interview progress analysis',
    color: 'from-sky-400 to-cyan-500',
    accent: {
      bar: 'bg-sky-500',
      icon: 'from-sky-400 to-cyan-500',
      cta: 'text-sky-600 dark:text-sky-400',
    },
  },
];

const STEPS = [
  {
    title: 'Sign Up',
    text: 'Create your InterviewIQ account in minutes.',
    icon: UserPlusIcon,
  },
  {
    title: 'Take a Mock Interview',
    text: 'Practice with AI questions matched to your role.',
    icon: ClipboardDocumentListIcon,
  },
  {
    title: 'Get Feedback',
    text: 'Review scores, mistakes, and suggested answers.',
    icon: ChatBubbleLeftRightIcon,
  },
  {
    title: 'Improve & Succeed',
    text: 'Track progress and walk into interviews prepared.',
    icon: SparklesIcon,
  },
];

const Features = () => {
  return (
    <div className="bg-slate-50 py-8 dark:bg-[#070b16]">
      <div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-8">
        <BackButton />
        <HeroRobotBanner
          badge="Powerful Features"
          title="Features"
          subtitle="Everything you need to ace your next interview"
          variant="features"
        />

        <div className="mb-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.06 }}
            >
              <FeatureCard {...feature} />
            </motion.div>
          ))}
        </div>

        <section className="mb-14 overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500 p-6 text-white sm:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-indigo-100">Go further</p>
              <h2 className="mt-2 text-[clamp(1.25rem,5vw,1.875rem)] font-bold">Advanced Tools for Better Preparation</h2>
              <p className="mt-3 max-w-xl text-sm text-indigo-100">
                Combine mock interviews, live feedback, and progress tracking in one place.
              </p>
              <Link
                to="/mock-test"
                className="mt-6 inline-flex cursor-pointer items-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-indigo-50"
              >
                Explore All Features
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </div>
            <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-sm ring-1 ring-white/20">
              <p className="text-sm font-medium text-indigo-50">Practice smarter with InterviewIQ</p>
              <p className="mt-2 text-sm text-indigo-100">
                Start a mock interview, review your report, and keep improving with every session.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-14">
          <div className="mb-8 text-center">
            <h2 className="text-[clamp(1.35rem,5vw,1.875rem)] font-bold text-slate-900 dark:text-white">How It Works</h2>
            <p className="mt-2 text-sm text-slate-500">Simple steps to success</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <article key={step.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                  <step.icon className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">Step {index + 1}</p>
                <h3 className="mt-1 font-bold text-slate-900 dark:text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700 sm:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ready to start practicing?</h2>
              <p className="mt-2 text-sm text-slate-500">Join candidates who use InterviewIQ to prepare with confidence.</p>
              <Link
                to="/interview"
                className="mt-5 inline-flex cursor-pointer items-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Start interview
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {TESTIMONIAL_AVATARS.slice(0, 3).map((avatar) => (
                <img
                  key={avatar.src}
                  src={avatar.src}
                  alt={avatar.alt}
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-white"
                  style={{ objectPosition: avatar.objectPosition || '50% 20%' }}
                />
              ))}
              <div className="flex text-amber-400">
                {Array.from({ length: 5 }).map((_, index) => (
                  <StarIcon key={index} className="h-4 w-4 fill-current" />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Features;
