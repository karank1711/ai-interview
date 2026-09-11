import { useState } from 'react';
import { motion } from 'framer-motion';
import BackButton from '../components/BackButton';
import SelectDropdown from '../components/SelectDropdown';
import { interviewService } from '../services/interviewService';

const AiQuestions = () => {
  const [course, setCourse] = useState('BTECH');
  const [level, setLevel] = useState('INTERMEDIATE');
  const [type, setType] = useState('TECHNICAL');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const generateQuestions = async () => {
    try {
      setLoading(true);
      const response = await interviewService.getQuestions({
        course,
        category: course,
        level,
        type,
        count: 5,
      });
      setQuestions(response.data || []);
    } catch (error) {
      console.error('Failed to generate AI questions:', error);
      alert('Unable to generate questions right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070b16] py-8">
      <div className="max-w-5xl mx-auto px-4">
        <BackButton />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">AI Powered Questions</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            onClick={generateQuestions}
            disabled={loading}
            className="mt-4 px-6 py-2 rounded-lg text-white bg-gradient-to-r from-blue-500 to-purple-600 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate 5 AI Questions'}
          </button>

          <div className="mt-6 space-y-3">
            {questions.map((item, index) => (
              <div key={item.id} className="p-4 rounded-lg border dark:border-gray-700">
                <p className="font-semibold text-gray-900 dark:text-white">Q{index + 1}</p>
                <p className="text-gray-700 dark:text-gray-300 mt-1">{item.questionText}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AiQuestions;
