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
      <section className="px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <div className="max-w-7xl mx-auto">
          <div className="relative isolate aspect-[16/9] w-full overflow-hidden rounded-3xl bg-slate-950 shadow-xl">
            <HeroSlideshow showControls objectFit="contain" onIndexChange={setHeroSlideIndex} />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/55 via-slate-950/15 to-transparent" />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="relative z-10 flex h-full w-full max-w-2xl flex-col justify-center space-y-6 p-6 sm:p-8 md:p-14"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 backdrop-blur-sm">
                  <SparklesIcon className="mr-2 h-4 w-4 text-white" />
                  <span className="text-sm font-medium text-white">
                    AI-Powered Interview Practice
                  </span>
                </div>

                <AnimatedText
                  as="h1"
                  key={heroSlideIndex}
                  replayKey={heroSlideIndex}
                  className="text-3xl font-bold leading-tight sm:text-4xl md:text-6xl"
                  text={"Your Dream Job\nis Closer Than You Think"}
                  lineClassNames={[
                    'bg-[linear-gradient(90deg,#38BDF8_0%,#8B5CF6_50%,#E879F9_100%)] bg-clip-text text-transparent',
                    'bg-[linear-gradient(90deg,#38BDF8_0%,#8B5CF6_50%,#E879F9_100%)] bg-clip-text text-transparent',
                  ]}
                />

                <p className="max-w-2xl text-lg text-white/85 md:text-xl">
                  Practice with AI-powered mock interviews, get instant feedback,
                  and land your dream job with confidence.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                {!user ? (
                  <>
                    <Link
                      to="/signup"
                      className="inline-flex items-center rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 font-medium text-white transition-all hover:from-blue-600 hover:to-purple-700 hover:scale-105"
                    >
                      Get Started Free
                      <ArrowRightIcon className="ml-2 h-5 w-5" />
                    </Link>
                    <Link
                      to="/features"
                      className="inline-flex items-center rounded-xl border border-white/40 bg-white/10 px-6 py-3 font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                    >
                      Learn More
                    </Link>
                  </>
                ) : (
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center rounded-xl bg-[#ffffff] px-6 py-3 font-semibold text-[#1d4ed8] shadow-md transition-colors hover:bg-[#dbeafe] hover:text-[#1e3a8a]"
                  >
                    Go to Dashboard
                    <ArrowRightIcon className="ml-2 h-5 w-5" />
                  </Link>
                )}
              </div>

              <div className="flex items-center space-x-8">
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
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 py-16 dark:bg-[#070b16]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
          >
            <div>
              <h2 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">
                Why Choose InterviewIQ?
              </h2>
              <p className="max-w-3xl text-lg text-gray-600 dark:text-gray-300">
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
      <section className="px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">
              What Our Users Say
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
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
