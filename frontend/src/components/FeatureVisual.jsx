import './featureVisual.css';

function QuestionsVisual() {
  return (
    <div className="relative flex h-32 w-32 items-center justify-center sm:h-36 sm:w-36">
      <div className="absolute inset-2 rounded-full bg-blue-100/80 dark:bg-blue-900/30" />
      <div className="absolute h-20 w-20 rounded-full bg-gradient-to-br from-sky-300 to-blue-500 opacity-90" />
      <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md dark:bg-slate-800">
        <span className="text-2xl">🤖</span>
      </div>
      <span className="absolute right-2 top-4 rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
        AI
      </span>
      <span className="absolute bottom-6 left-1 text-lg text-blue-500">?</span>
      <span className="absolute left-4 top-8 h-2 w-2 rounded-full bg-blue-400" />
      <span className="absolute bottom-8 right-4 h-2 w-2 rounded-full bg-violet-400" />
    </div>
  );
}

function MockVisual() {
  return (
    <div className="relative h-32 w-36 sm:h-36 sm:w-40">
      <div className="absolute inset-y-4 right-2 left-4 rounded-2xl bg-emerald-50 p-3 shadow-inner dark:bg-emerald-900/20">
        <div className="mb-2 flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-xs font-bold text-white">
          Q
        </div>
        <div className="mb-1.5 h-2 w-16 rounded bg-emerald-200 dark:bg-emerald-700" />
        <div className="h-2 w-12 rounded bg-emerald-200 dark:bg-emerald-700" />
      </div>
      <div className="absolute bottom-3 right-1 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 shadow-lg">
        <span className="ml-0.5 border-y-[7px] border-l-[12px] border-y-transparent border-l-white" />
      </div>
    </div>
  );
}

function FeedbackVisual() {
  return (
    <div className="relative h-32 w-36 sm:h-36 sm:w-40">
      <div className="absolute inset-y-3 right-1 left-3 rounded-2xl bg-violet-50 p-3 dark:bg-violet-900/20">
        <svg viewBox="0 0 80 40" className="feature-visual-line mb-2 h-8 w-full text-violet-400">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            points="2,28 18,22 32,24 48,12 62,16 78,6"
          />
        </svg>
        <div className="flex h-10 items-end gap-1.5">
          <span className="feature-visual-bar w-3 rounded-t bg-violet-300" style={{ height: '55%' }} />
          <span className="feature-visual-bar w-3 rounded-t bg-violet-400" style={{ height: '80%' }} />
          <span className="feature-visual-bar w-3 rounded-t bg-violet-500" style={{ height: '65%' }} />
        </div>
      </div>
      <div className="absolute bottom-2 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm text-white shadow-md">
        ★
      </div>
    </div>
  );
}

function ProgressVisual() {
  return (
    <div className="relative flex h-32 w-32 items-center justify-center sm:h-36 sm:w-36">
      <svg viewBox="0 0 96 96" className="h-28 w-28">
        <circle cx="48" cy="48" r="36" fill="none" stroke="#fce7f3" strokeWidth="10" />
        <circle
          className="feature-visual-ring-arc"
          cx="48"
          cy="48"
          r="36"
          fill="none"
          stroke="url(#progressRing)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="170 226"
          transform="rotate(-90 48 48)"
        />
        <defs>
          <linearGradient id="progressRing" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-lg font-bold text-gray-900 dark:text-white">85%</span>
      <span className="absolute right-2 top-6 text-pink-500">↑</span>
    </div>
  );
}

const VISUALS = {
  questions: QuestionsVisual,
  mock: MockVisual,
  feedback: FeedbackVisual,
  progress: ProgressVisual,
};

const MOTION_CLASS = {
  questions: 'feature-visual--float',
  mock: 'feature-visual--bob',
  feedback: 'feature-visual--chart',
  progress: 'feature-visual--ring',
};

export default function FeatureVisual({ kind }) {
  const Visual = VISUALS[kind] || QuestionsVisual;
  const motionClass = MOTION_CLASS[kind] || MOTION_CLASS.questions;

  return (
    <div className={`feature-visual ${motionClass} pointer-events-none shrink-0`}>
      <Visual />
    </div>
  );
}
