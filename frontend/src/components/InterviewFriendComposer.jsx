import {
  AcademicCapIcon,
  ChatBubbleLeftRightIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
  PresentationChartLineIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  StopIcon,
} from '@heroicons/react/24/outline';

export const INTERVIEW_FRIEND_QUICK_ACTIONS = [
  {
    id: 'explain',
    label: 'Explain a topic',
    icon: AcademicCapIcon,
    wrap: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
  },
  {
    id: 'practice',
    label: 'Practice interview',
    icon: ChatBubbleLeftRightIcon,
    wrap: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
  },
  {
    id: 'analyze',
    label: 'Analyze my last interview',
    icon: PresentationChartLineIcon,
    wrap: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    id: 'communication',
    label: 'Improve communication',
    icon: SparklesIcon,
    wrap: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
  },
];

export default function InterviewFriendComposer({
  draft,
  onDraftChange,
  onSend,
  onQuickAction,
  onVoicePress,
  onStop,
  onReplay,
  listenBlocked = false,
  voiceListening = false,
  micEnabled = false,
  speaking = false,
  thinking = false,
  activeMode = 'general',
  compact = false,
}) {
  const handleSubmit = (event) => {
    event.preventDefault();
    onSend?.();
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        {listenBlocked ? (
          <button
            type="button"
            onClick={() => onVoicePress?.()}
            className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-3 text-sm font-semibold text-white"
          >
            Start listening
          </button>
        ) : (
          <button
            type="button"
            aria-label={micEnabled ? 'Turn microphone off' : 'Turn microphone on'}
            aria-pressed={micEnabled}
            onClick={() => onVoicePress?.()}
            className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-white ${
              micEnabled
                ? voiceListening
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-blue-500 to-purple-600'
                : 'bg-slate-400 dark:bg-slate-600'
            }`}
          >
            <MicrophoneIcon className="h-5 w-5" />
          </button>
        )}
        <label className="sr-only" htmlFor="interview-friend-draft">Type your question</label>
        <input
          id="interview-friend-draft"
          type="text"
          value={draft}
          onChange={(event) => onDraftChange?.(event.target.value)}
          placeholder="Type if you prefer not to speak…"
          className="min-h-11 min-w-[8rem] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-violet-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
        <button
          type="button"
          aria-label="Replay last answer"
          onClick={() => onReplay?.()}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-300"
        >
          <SpeakerWaveIcon className="h-5 w-5" />
        </button>
        {speaking ? (
          <button
            type="button"
            aria-label="Stop speaking"
            onClick={() => onStop?.()}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-1 rounded-xl bg-rose-500 px-3 text-sm font-semibold text-white"
          >
            <StopIcon className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="submit"
          disabled={thinking}
          className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-3 text-white disabled:opacity-60"
        >
          <PaperAirplaneIcon className="h-4 w-4" />
        </button>
      </form>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-gray-800 dark:ring-slate-700 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Ask with your voice</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Tap the microphone when you are ready to speak, or type a question below.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          Mode: {modeLabel(activeMode)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {INTERVIEW_FRIEND_QUICK_ACTIONS.map((action) => {
          const selected = activeMode === action.id;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onQuickAction?.(action.id)}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                selected
                  ? 'border-violet-400 bg-violet-50 dark:border-violet-500 dark:bg-violet-950/40'
                  : 'border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-white dark:border-slate-600 dark:bg-slate-900 dark:hover:border-violet-500 dark:hover:bg-slate-800'
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${action.wrap}`}>
                <action.icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{action.label}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <button
          type="button"
          aria-label={micEnabled ? 'Turn microphone off' : 'Turn microphone on'}
          aria-pressed={micEnabled}
          onClick={() => onVoicePress?.()}
          className={`flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center self-start rounded-xl text-white shadow-sm transition-transform hover:scale-105 sm:self-auto ${
            micEnabled
              ? voiceListening
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-blue-500 to-purple-600'
              : 'bg-slate-400 dark:bg-slate-600'
          }`}
        >
          <MicrophoneIcon className="h-6 w-6" />
        </button>

        <label className="sr-only" htmlFor="interview-friend-draft">
          Type your question
        </label>
        <input
          id="interview-friend-draft"
          type="text"
          value={draft}
          onChange={(event) => onDraftChange?.(event.target.value)}
          placeholder="Type a question if you prefer text…"
          disabled={thinking}
          className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          {speaking ? (
            <button
              type="button"
              onClick={() => onStop?.()}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white transition hover:bg-rose-600"
            >
              <StopIcon className="h-4 w-4" />
              Stop
            </button>
          ) : null}
          <button
            type="submit"
            disabled={thinking}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 text-sm font-semibold text-white transition hover:from-blue-600 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function modeLabel(mode) {
  if (mode === 'explain') return 'Explain a topic';
  if (mode === 'practice') return 'Practice interview';
  if (mode === 'analyze') return 'Analyze my last interview';
  if (mode === 'communication') return 'Improve communication';
  return 'Ready for anything';
}
