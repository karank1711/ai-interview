import { Link } from 'react-router-dom';
import { AcademicCapIcon } from '@heroicons/react/24/outline';
import AnimatedCounter from './AnimatedCounter';

export default function InterviewTokenList({ interviews, results = [], showScores = false }) {
  const resultByInterviewId = results.reduce((acc, item) => {
    acc[item.interviewId] = item;
    return acc;
  }, {});

  if (!interviews.length) {
    return (
      <div className="py-8 text-center">
        <AcademicCapIcon className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <p className="text-gray-600 dark:text-gray-400">
          No interviews yet. Start your first interview!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {interviews.map((interview) => {
        const result = resultByInterviewId[interview.id] || resultByInterviewId[interview._id];
        return (
          <div
            key={interview._id || interview.id}
            className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {(interview.course || interview.category || 'GENERAL')?.replace('_', ' ')}
              </span>
              <span className={`rounded-full px-2 py-1 text-xs ${
                interview.status === 'COMPLETED'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : interview.status === 'IN_PROGRESS'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
              }`}>
                {interview.status?.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>{interview.level?.replace('_', ' ')}</span>
              <span>{new Date(interview.createdAt).toLocaleDateString()}</span>
            </div>
            {showScores && result && (
              <p className="mt-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                Score <AnimatedCounter value={`${result.overallScore ?? 0}%`} /> · {result.passFail ? 'Pass' : 'Needs practice'}
              </p>
            )}
            {interview.status === 'COMPLETED' ? (
              <Link
                to={`/interview/report/${interview._id || interview.id}`}
                className="mt-3 block border-t border-gray-200 pt-3 text-sm text-blue-600 hover:text-blue-500 dark:border-gray-700 dark:text-blue-400"
              >
                View Results
              </Link>
            ) : interview.status === 'IN_PROGRESS' ? (
              <Link
                to={`/interview/${interview._id || interview.id}`}
                className="mt-3 block border-t border-gray-200 pt-3 text-sm text-blue-600 hover:text-blue-500 dark:border-gray-700 dark:text-blue-400"
              >
                Continue Interview
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
