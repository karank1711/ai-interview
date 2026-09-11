import { Link } from 'react-router-dom';

export default function ProgressViewAllLink({ className = '' }) {
  return (
    <Link
      to="/progress"
      className={`text-sm font-medium text-blue-600 dark:text-blue-400 ${className}`}
    >
      Open detailed progress tracking
    </Link>
  );
}
