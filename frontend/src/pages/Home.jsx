import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  SparklesIcon,
  ArrowRightIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import FeatureCard from '../components/FeatureCard';
import { FEATURE_TOKENS } from '../data/featureTokens';
import AnimatedCounter from '../components/AnimatedCounter';
import AvatarStack from '../components/AvatarStack';
import AnimatedText from '../components/AnimatedText';
import HeroSlideshow from '../components/HeroSlideshow';
import HomeCtaBanner from '../components/HomeCtaBanner';

function HeroCtas({ user, variant = 'overlay' }) {
  const secondaryClass = variant === 'overlay'
    ? 'inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/40 bg-white/10 px-6 py-3 font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:w-auto'
    : 'inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-6 py-3 font-medium text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 sm:w-auto';

  if (!user) {
    return (
      <>
        <Link
          to="/signup"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 font-medium text-white transition-all hover:from-blue-600 hover:to-purple-700 hover:scale-105 sm:w-auto"
        >
          Get Started Free
          <ArrowRightIcon className="ml-2 h-5 w-5" />
        </Link>
        <Link to="/features" className={secondaryClass}>
          Learn More
        </Link>
      </>
    );
  }

  return (
    <Link
      to="/dashboard"
      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#ffffff] px-6 py-3 font-semibold text-[#1d4ed8] shadow-md transition-colors hover:bg-[#dbeafe] hover:text-[#1e3a8a] sm:w-auto"
    >
      Go to Dashboard
      <ArrowRightIcon className="ml-2 h-5 w-5" />
    </Link>
  );
}

const Home = ({ user }) => {
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Frontend Developer',
      company: 'Tech Corp',
      content: 'InterviewIQ helped me land my dream job! The AI feedback was invaluable.',
      rating: 5,
    },
    {
      name: 'Michael Chen',
      role: 'Backend Engineer',
      company: 'StartupXYZ',
      content: 'The realistic interview scenarios prepared me for the real thing.',
      rating: 5,
    },
    {
      name: 'Emily Davis',
      role: 'Data Analyst',
      company: 'DataFlow',
      content: 'I improved my confidence and skills dramatically with InterviewIQ.',
      rating: 5,
    },
  ];

  const pricingPlans = [
    {
      name: 'Starter',
      price: 'Free',
      features: [
        '5 mock interviews per month',
        'Basic feedback',
        'Limited question categories',
        'Email support',
      ],
      highlighted: false,
    },
    {
      name: 'Professional',
      price: '$29',
      period: '/month',
      features: [
        'Unlimited mock interviews',
        'Advanced AI feedback',
        'All question categories',
        'Video recording',
        'Priority support',
        'Resume analysis',
      ],
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      features: [
        'Everything in Professional',
        'Custom question sets',
        'Team management',
        'API access',
        'Dedicated support',
        'White-label options',
      ],
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070b16]">
      {/* Hero Section */}
      <section className="px-3 pt-4 pb-4 sm:px-6 sm:pt-6 lg:px-8">
        <div className="mx-auto max-w-7xl min-w-0">
          <div className="relative isolate aspect-[16/10] min-h-[12.5rem] w-full overflow-hidden rounded-2xl bg-slate-950 shadow-xl sm:min-h-0 sm:rounded-3xl md:aspect-[16/9]">
            <HeroSlideshow showControls objectFit="contain" onIndexChange={setHeroSlideIndex} />
            <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-slate-950/70 via-slate-950/25 to-transparent sm:block" />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="relative z-10 hidden h-full w-full min-w-0 max-w-2xl flex-col justify-center space-y-6 p-8 sm:flex md:p-14"
            >
              <div className="min-w-0 space-y-2 sm:space-y-4">
                <div className="hidden items-center rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-sm sm:inline-flex sm:px-4 sm:py-2">
                  <SparklesIcon className="mr-2 h-4 w-4 text-white" />
                  <span className="text-sm font-medium text-white">
                    AI-Powered Interview Practice
                  </span>
                </div>

                <AnimatedText
                  as="h1"
                  key={heroSlideIndex}
                  replayKey={heroSlideIndex}
                  className="break-words text-[clamp(1.15rem,5.4vw,3.75rem)] font-bold leading-tight"
                  text={"Your Dream Job\nis Closer Than You Think"}
                  lineClassNames={[
                    'bg-[linear-gradient(90deg,#38BDF8_0%,#8B5CF6_50%,#E879F9_100%)] bg-clip-text text-transparent',
                    'bg-[linear-gradient(90deg,#38BDF8_0%,#8B5CF6_50%,#E879F9_100%)] bg-clip-text text-transparent',
                  ]}
                />

                <p className="hidden max-w-2xl text-lg text-white/85 sm:block md:text-xl">
                  Practice with AI-powered mock interviews, get instant feedback,
                  and land your dream job with confidence.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <HeroCtas user={user} />
              </div>

              <div className="hidden items-center space-x-8 sm:flex">
                <AvatarStack />
                <div>
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <StarIcon key={i} className="h-4 w-4 fill-current text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-white/80">
                    <span className="font-semibold"><AnimatedCounter value="10,000+" /></span> users interviewed
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
          <div className="min-w-0 pt-4 sm:hidden">
            <h1 className="break-words text-[clamp(1.25rem,6.5vw,1.75rem)] font-bold leading-tight">
              <span className="block bg-[linear-gradient(90deg,#38BDF8_0%,#8B5CF6_50%,#E879F9_100%)] bg-clip-text text-transparent">
                Your Dream Job
              </span>
              <span className="block bg-[linear-gradient(90deg,#38BDF8_0%,#8B5CF6_50%,#E879F9_100%)] bg-clip-text text-transparent">
                is Closer Than
              </span>
              <span className="block bg-[linear-gradient(90deg,#38BDF8_0%,#8B5CF6_50%,#E879F9_100%)] bg-clip-text text-transparent">
                You Think
              </span>
            </h1>
            <div className="mt-4 flex flex-col gap-3">
              <HeroCtas user={user} variant="page" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 py-10 dark:bg-[#070b16] sm:py-16">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
          >
            <div className="min-w-0">
              <h2 className="mb-2 break-words text-[clamp(1.2rem,5vw,2.25rem)] font-bold text-gray-900 dark:text-white">
                Why Choose InterviewIQ?
              </h2>
              <p className="max-w-3xl break-words text-[clamp(0.9rem,3.4vw,1.125rem)] text-gray-600 dark:text-gray-300">
                Our AI-powered platform provides everything you need to succeed in your interviews
              </p>
            </div>
            <Link
              to="/features"
              className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              View All Features
              <ArrowRightIcon className="ml-1 h-4 w-4" />
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURE_TOKENS.map((feature, index) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
              >
                <FeatureCard {...feature} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="px-3 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8 text-center"
          >
            <h2 className="mb-4 text-[clamp(1.35rem,5vw,2.25rem)] font-bold text-gray-900 dark:text-white md:text-4xl">
              What Our Users Say
            </h2>
            <p className="text-[clamp(0.95rem,3.6vw,1.25rem)] text-gray-600 dark:text-gray-300">
              Join thousands of professionals who've landed their dream jobs
            </p>
          </motion.div>

          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700"
              >
                <div className="mb-4 flex items-center">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <StarIcon key={i} className="h-5 w-5 fill-current text-yellow-400" />
                  ))}
                </div>
                <p className="mb-4 text-gray-600 dark:text-gray-300">
                  "{testimonial.content}"
                </p>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {testimonial.role} at {testimonial.company}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <HomeCtaBanner />
    </div>
  );
};

export default Home;
