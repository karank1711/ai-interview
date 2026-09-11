import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PlayIcon,
  ChartBarIcon,
  UserGroupIcon,
  CalendarIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import HeroSlideshow from '../components/HeroSlideshow';
import AnimatedText from '../components/AnimatedText';
import InterviewStatTokens from '../components/InterviewStatTokens';
import ProgressViewAllLink from '../components/ProgressViewAllLink';
import SelectDropdown from '../components/SelectDropdown';
import { interviewService } from '../services/interviewService';
import { readPageCache, writePageCache } from '../utils/pageDataCache';
import { perfLog } from '../utils/perf';
import { EMPTY_INTERVIEW_STATS, normalizeInterviewStats } from '../utils/interviewStats';

const DASHBOARD_CACHE_KEY = 'dashboard:v2';

function buildDashboardState(interviewList, resultList, stats) {
  return {
    interviews: interviewList,
    results: resultList,
    stats: normalizeInterviewStats(stats),
  };
}

const Dashboard = ({ user }) => {
  const cached = readPageCache(DASHBOARD_CACHE_KEY);
  const [interviews, setInterviews] = useState(cached?.interviews || []);
  const [results, setResults] = useState(cached?.results || []);
  const [stats, setStats] = useState(cached?.stats || EMPTY_INTERVIEW_STATS);
  const [loading, setLoading] = useState(!cached);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [startingInterview, setStartingInterview] = useState(false);
  const navigate = useNavigate();

  const courses = [
    { value: 'BTECH', label: 'BTech' },
    { value: 'MTECH', label: 'MTech' },
    { value: 'MCA', label: 'MCA' },
  ];

  const levels = [
    { value: 'FRESHER', label: 'Fresher' },
    { value: 'INTERMEDIATE', label: 'Intermediate' },
    { value: 'EXPERIENCED', label: 'Experienced' },
  ];

  const types = [
    { value: 'TECHNICAL', label: 'Technical' },
    { value: 'HR', label: 'HR' },
    { value: 'MIXED', label: 'Mixed' },
  ];

  useEffect(() => {
    let cancelled = false;
    fetchDashboardData();

    async function fetchDashboardData() {
      const started = performance.now();
      try {
        if (!readPageCache(DASHBOARD_CACHE_KEY)) setLoading(true);
        const [interviewResponse, resultResponse, statsResponse] = await Promise.all([
          interviewService.getUserInterviews(0, 20),
          interviewService.getResultsHistory(0, 50),
          interviewService.getInterviewStats(),
        ]);
        if (cancelled) return;
        const interviewList = interviewResponse.data || [];
        const resultList = resultResponse.data || [];
        const next = buildDashboardState(interviewList, resultList, statsResponse.data);
        writePageCache(DASHBOARD_CACHE_KEY, next);
        setInterviews(next.interviews);
        setResults(next.results);
        setStats(next.stats);
        perfLog('dashboard-data', `${Math.round(performance.now() - started)}ms`);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartInterview = async () => {
    if (!selectedCourse || !selectedLevel || !selectedType) {
      alert('Please select all interview parameters');
      return;
    }
    if (startingInterview) return;
    setStartingInterview(true);
    try {
      const response = await interviewService.startInterview({
        category: selectedCourse,
        course: selectedCourse,
        level: selectedLevel,
        type: selectedType,
        durationMinutes: 30,
      });
      navigate(`/interview/${response.data._id || response.data.id}`);
    } catch (error) {
      console.error('Failed to start interview:', error);
      alert('Failed to start interview. Please try again.');
      setStartingInterview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070b16] py-6">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative isolate mb-8 min-h-[220px] overflow-hidden rounded-2xl shadow-xl sm:min-h-[280px] sm:rounded-3xl md:min-h-[320px]"
        >
          <HeroSlideshow showControls onIndexChange={setHeroSlideIndex} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/50 to-slate-900/20" />
          <div className="relative z-10 flex h-full min-h-[220px] max-w-2xl min-w-0 flex-col justify-center p-4 sm:min-h-[280px] sm:p-8 md:min-h-[320px] md:p-12">
            <p className="mb-3 inline-flex w-fit max-w-full truncate items-center rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              AI-Powered Interview Platform
            </p>
            <AnimatedText
              as="h1"
              key={heroSlideIndex}
              replayKey={heroSlideIndex}
                  className="break-words text-[clamp(1.25rem,5vw,2.25rem)] font-bold text-white"
              text={`Welcome back, ${user?.name || 'there'}!`}
            />
            <p className="mt-3 max-w-xl text-white/85">
              Ready to practice your interview skills?
            </p>
            <button
              type="button"
              onClick={() => document.getElementById('start-interview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="mt-6 inline-flex w-fit items-center rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 font-medium text-white transition-all hover:from-blue-600 hover:to-purple-700"
            >
              Start Interview
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <InterviewStatTokens stats={stats} />

        <div className="grid grid-cols-1 gap-8">
          {/* Start Interview Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <div id="start-interview" className="bg-white dark:bg-gray-800 rounded-2xl shadow-md ring-1 ring-gray-100 dark:ring-gray-700 p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Start New Interview
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Course
                  </label>
                  <SelectDropdown
                    aria-label="Course"
                    value={selectedCourse}
                    onChange={setSelectedCourse}
                    placeholder="Select a course"
                    options={courses}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Experience Level
                  </label>
                  <SelectDropdown
                    aria-label="Experience Level"
                    value={selectedLevel}
                    onChange={setSelectedLevel}
                    placeholder="Select your level"
                    options={levels}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Interview Type
                  </label>
                  <SelectDropdown
                    aria-label="Interview Type"
                    value={selectedType}
                    onChange={setSelectedType}
                    placeholder="Select interview type"
                    options={types}
                  />
                </div>

                <button
                  onClick={handleStartInterview}
                  disabled={startingInterview}
                  className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105"
                >
                  <PlayIcon className="w-5 h-5 mr-2" />
                  Start Interview
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-8"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md ring-1 ring-gray-100 dark:ring-gray-700 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              Quick Actions
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                to="/ai-questions"
                className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <CalendarIcon className="w-8 h-8 text-blue-500 mr-3" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">AI Powered Questions</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Generate fresh AI questions</p>
                </div>
              </Link>

              <Link
                to="/mock-test"
                className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <UserGroupIcon className="w-8 h-8 text-purple-500 mr-3" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Mock Test</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Attempt full interview simulation</p>
                </div>
              </Link>

              <Link
                to="/feedback"
                className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ChartBarIcon className="w-8 h-8 text-green-500 mr-3" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Feedback & Progress</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">See AI feedback and growth</p>
                </div>
              </Link>
            </div>
            <div className="mt-4">
              <ProgressViewAllLink />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
