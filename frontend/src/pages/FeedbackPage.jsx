import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import AnimatedCounter from '../components/AnimatedCounter';
import BackButton from '../components/BackButton';
import { interviewService } from '../services/interviewService';
import { readPageCache, writePageCache } from '../utils/pageDataCache';

const FeedbackPage = () => {
  const cached = readPageCache('feedback:v1');
  const [results, setResults] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await interviewService.getResultsHistory(0, 20);
        const next = response.data || [];
        writePageCache('feedback:v1', next);
        setResults(next);
      } catch (error) {
        console.error('Failed to load feedback:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading feedback...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 dark:bg-[#070b16] sm:py-8">
      <div className="mx-auto max-w-5xl px-3 sm:px-4">
        <BackButton />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-white p-4 shadow-lg dark:bg-gray-800 sm:p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">AI Feedback</h1>
          <div className="space-y-4">
            {results.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-300">No feedback available yet. Complete a mock test first.</p>
            ) : (
              results.map((item) => (
                <div key={item._id || item.id} className="p-4 border rounded-lg dark:border-gray-700">
                  <p className="font-semibold text-gray-900 dark:text-white">Score: <AnimatedCounter value={`${item.overallScore}%`} /> ({item.grade})</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1"><strong>Strengths:</strong> {item.strengths}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1"><strong>Weaknesses:</strong> {item.weaknesses}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1"><strong>Improvements:</strong> {item.improvements}</p>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default FeedbackPage;
