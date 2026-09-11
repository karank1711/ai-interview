import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import SelectDropdown from '../components/SelectDropdown';
import { interviewService } from '../services/interviewService';

const MockTest = () => {
  const navigate = useNavigate();
  const [course, setCourse] = useState('BTECH');
  const [level, setLevel] = useState('INTERMEDIATE');
  const [type, setType] = useState('TECHNICAL');
  const [loading, setLoading] = useState(false);

  const startMockTest = async () => {
    try {
      setLoading(true);
      const response = await interviewService.startInterview({
        course,
        category: course,
        level,
        type,
      });
      const interviewId = response.data?._id || response.data?.id;
      navigate(`/interview/${interviewId}`);
    } catch (error) {
      console.error('Failed to start mock test:', error);
      alert('Unable to start mock test right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 dark:bg-[#070b16] sm:py-8">
      <div className="mx-auto max-w-3xl px-3 sm:px-4">
        <BackButton />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-white p-4 shadow-lg dark:bg-gray-800 sm:p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Mock Test</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">Start a full 5-question AI interview simulation with real-time feedback.</p>

          <div className="space-y-4">
            <SelectDropdown
              aria-label="Course"
              value={course}
              onChange={setCourse}
              options={[
                { value: 'BTECH', label: 'BTech' },
                { value: 'MTECH', label: 'MTech' },
                { value: 'MCA', label: 'MCA' },
              ]}
            />
            <SelectDropdown
              aria-label="Experience level"
              value={level}
              onChange={setLevel}
              options={[
                { value: 'FRESHER', label: 'Fresher' },
                { value: 'INTERMEDIATE', label: 'Intermediate' },
                { value: 'EXPERIENCED', label: 'Experienced' },
              ]}
            />
            <SelectDropdown
              aria-label="Interview type"
              value={type}
              onChange={setType}
              options={[
                { value: 'TECHNICAL', label: 'Technical' },
                { value: 'HR', label: 'HR' },
                { value: 'MIXED', label: 'Mixed' },
              ]}
            />
          </div>

          <button
            onClick={startMockTest}
            disabled={loading}
            className="mt-6 px-6 py-2 rounded-lg text-white bg-gradient-to-r from-blue-500 to-purple-600 disabled:opacity-50"
          >
            {loading ? 'Starting...' : 'Start Mock Test'}
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default MockTest;
