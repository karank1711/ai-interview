import { Link } from 'react-router-dom';

export function isCompletedStatus(status) {
  return status === 'COMPLETED';
}

export function interviewStatusHref(status, interviewId) {
  if (!interviewId) return null;
  return isCompletedStatus(status) ? `/interview/report/${interviewId}` : `/interview/${interviewId}`;
}

export function interviewStatusLabel(status) {
  return isCompletedStatus(status) ? 'Completed' : 'Pending';
}

export default function InterviewStatusBadge({ status, interviewId }) {
  const completed = isCompletedStatus(status);
  const href = interviewStatusHref(status, interviewId);
  const label = interviewStatusLabel(status);
  const title = completed ? 'Open interview report' : 'Open pending interview';
  const classes = completed
    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50'
    : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500';

  if (!href) {
    return (
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>
        {label}
      </span>
    );
  }

  return (
    <Link
      to={href}
      title={title}
      aria-label={title}
      className={`inline-flex cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${classes}`}
    >
      {label}
    </Link>
  );
}
