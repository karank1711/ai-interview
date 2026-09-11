import { Link } from 'react-router-dom';

export default function ComingSoonPage({ title, description }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 px-4 py-16 dark:bg-[#070b16]">
      <div className="mx-auto max-w-xl rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          {description || 'This page is not available yet.'}
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">Coming soon.</p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex cursor-pointer text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
