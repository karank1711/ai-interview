import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRightOnRectangleIcon,
  ArrowsPointingOutIcon,
  Bars3Icon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
  SpeakerWaveIcon,
  StopIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import AnimatedBrain from '../components/AnimatedBrain';
import { AppModalShell } from '../components/AppPopup';
import InterviewerAvatarVideo from '../components/InterviewerAvatarVideo';
import InterviewFriendComposer, { INTERVIEW_FRIEND_QUICK_ACTIONS } from '../components/InterviewFriendComposer';
import InterviewFriendAnswer from '../components/InterviewFriendAnswer';
import InterviewFriendVideos from '../components/InterviewFriendVideos';
import UserAvatar from '../components/UserAvatar';
import { useInterviewFriendSession } from '../hooks/useInterviewFriendSession';
import { readFriendUiPrefs, writeFriendUiPrefs } from '../utils/friendUiPrefs';

const QUICK_COPY = {
  explain: 'Learn concepts in simple terms',
  practice: 'Get real interview questions',
  analyze: 'Personalized feedback & tips',
  communication: 'Better answers, more confidence',
};

function formatStamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString();
}

function statusLabel(status) {
  if (status === 'listening') return 'Listening';
  if (status === 'thinking') return 'Thinking';
  if (status === 'preparing') return 'Preparing';
  if (status === 'speaking') return 'Speaking';
  return 'Ready';
}

function SidebarToggleButton({ collapsed, onClick, className = '', tooltip = 'right' }) {
  const label = collapsed ? 'Open sidebar' : 'Close sidebar';
  const tipPos = tooltip === 'bottom'
    ? 'left-1/2 top-full mt-2 -translate-x-1/2'
    : 'left-full top-1/2 ml-2 -translate-y-1/2';
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      onClick={onClick}
      className={`group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 outline-none ring-violet-400 hover:bg-slate-100 focus-visible:ring-2 dark:text-slate-300 dark:hover:bg-slate-800 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5 stroke-current">
        <rect x="3.5" y="4.5" width="17" height="15" rx="3" strokeWidth="1.6" />
        <path d="M9.5 4.5v15" strokeWidth="1.6" />
      </svg>
      <span className={`pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 lg:block ${tipPos}`}>
        {label}
      </span>
    </button>
  );
}

const InterviewFriend = ({ user, logout }) => {
  const session = useInterviewFriendSession(user);
  const location = useLocation();
  const navigate = useNavigate();
  const profileMenuRef = useRef(null);
  const speaking = session.isVideoPlaying;
  const preparing = session.status === 'preparing';
  const firstName = String(user?.name || '').trim().split(/\s+/)[0] || 'there';
  const videoWrapRef = useRef(null);
  const searchRef = useRef(null);
  const prefs = useMemo(() => readFriendUiPrefs(user?.id), [user?.id]);
  const [simpleChat, setSimpleChat] = useState(prefs.simpleChatMode);
  const [coachName, setCoachName] = useState(prefs.coachName);
  const [quickActionsOpen, setQuickActionsOpen] = useState(prefs.quickActionsOpen);
  const [nameDraft, setNameDraft] = useState(prefs.coachName);
  const [editingName, setEditingName] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const displayName = String(user?.name || user?.email || 'Account').trim();
  const planLabel = String(user?.plan || user?.subscription || user?.tier || 'Free').trim() || 'Free';

  useEffect(() => {
    const next = readFriendUiPrefs(user?.id);
    setSimpleChat(next.simpleChatMode);
    setCoachName(next.coachName);
    setNameDraft(next.coachName);
    setQuickActionsOpen(next.quickActionsOpen);
  }, [user?.id]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!profileMenuOpen && !settingsModalOpen) return undefined;
    const onPointerDown = (event) => {
      if (profileMenuOpen && !profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setProfileMenuOpen(false);
      setSettingsModalOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileMenuOpen, settingsModalOpen]);

  const persistUi = (patch) => {
    const next = writeFriendUiPrefs(user?.id, patch);
    setSimpleChat(next.simpleChatMode);
    setCoachName(next.coachName);
    setQuickActionsOpen(next.quickActionsOpen);
  };

  const toggleSimpleChat = () => {
    persistUi({ simpleChatMode: !simpleChat, coachName });
  };

  const toggleQuickActions = () => {
    persistUi({ quickActionsOpen: !quickActionsOpen });
  };

  const saveCoachName = () => {
    persistUi({ simpleChatMode: simpleChat, coachName: nameDraft });
    setEditingName(false);
  };

  const enterFullscreen = () => {
    const node = videoWrapRef.current;
    if (!node?.requestFullscreen) return;
    node.requestFullscreen().catch(() => {});
  };

  const closeSidebar = () => {
    setSidebarCollapsed(true);
    setProfileMenuOpen(false);
    session.setHistoryOpen(false);
  };

  const closeProfileMenu = () => setProfileMenuOpen(false);

  const goProfile = () => {
    closeProfileMenu();
    navigate('/profile');
  };

  const openSettings = () => {
    closeProfileMenu();
    setSettingsModalOpen(true);
  };

  const goHelp = () => {
    closeProfileMenu();
    navigate('/contact');
  };

  const signOut = async () => {
    closeProfileMenu();
    if (typeof logout === 'function') await logout();
  };

  const openSidebar = () => {
    setSidebarCollapsed(false);
    session.setHistoryOpen(true);
  };

  const filteredHistory = useMemo(() => {
    const rows = Array.isArray(session.history) ? session.history : [];
    const q = historyQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((item) => String(item.title || '').toLowerCase().includes(q));
  }, [session.history, historyQuery]);

  const turns = session.messages.length
    ? session.messages
    : [
      session.currentQuestion ? { id: 'live-user', role: 'user', content: session.currentQuestion } : null,
      session.currentQuestion ? { id: 'live-ai', role: 'assistant', content: session.currentAnswer } : null,
    ].filter(Boolean);

  const mobileOpen = session.historyOpen;
  const desktopHidden = sidebarCollapsed;

  return (
    <div className="relative flex h-dvh min-h-0 overflow-x-hidden overflow-y-hidden bg-slate-100 text-slate-900 dark:bg-[#070b16] dark:text-white">
      {desktopHidden ? (
        <div className="absolute left-3 top-3 z-30 hidden lg:block">
          <SidebarToggleButton collapsed onClick={openSidebar} />
        </div>
      ) : null}

      <aside
        className={`z-20 flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-slate-200 bg-white dark:border-white/10 dark:bg-[#0b1224] max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:shadow-xl ${
          desktopHidden ? 'lg:w-0 lg:border-0' : 'lg:w-72 lg:border-r'
        } ${mobileOpen ? 'max-lg:w-72 max-lg:translate-x-0 max-lg:border-r' : 'max-lg:w-72 max-lg:-translate-x-full'}`}
        style={{ transition: 'width 280ms ease, transform 280ms ease, border-width 280ms ease' }}
      >
        <div className="flex h-full w-72 min-w-72 max-w-72 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-3">
            <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
              <AnimatedBrain className="h-8 w-8 shrink-0" />
              <span className="truncate text-base font-semibold">InterviewIQ</span>
            </Link>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Search conversations"
                onClick={() => setSearchOpen((open) => !open)}
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
              </button>
              <SidebarToggleButton collapsed={false} onClick={closeSidebar} tooltip="bottom" className="hidden lg:inline-flex" />
              <button
                type="button"
                aria-label="Close sidebar"
                onClick={closeSidebar}
                className="rounded-lg p-2 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={session.resetConversation}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
            >
              <PlusIcon className="h-4 w-4" />
              New chat
            </button>
          </div>

          {searchOpen ? (
            <div className="px-3 pb-2">
              <input
                ref={searchRef}
                value={historyQuery}
                onChange={(event) => setHistoryQuery(event.target.value)}
                placeholder="Search conversations"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
          ) : null}

          <nav className="space-y-1 px-3 pb-3">
            <Link to="/dashboard" className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${location.pathname.startsWith('/dashboard') ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <HomeIcon className="h-4 w-4 shrink-0" /> Dashboard
            </Link>
            <Link to="/interview-friend" className="flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white">
              <ChatBubbleLeftRightIcon className="h-4 w-4 shrink-0" /> Interview Friend
            </Link>
            <Link to="/progress" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
              <ChartBarIcon className="h-4 w-4 shrink-0" /> Reports
            </Link>
          </nav>

          {!simpleChat ? (
            <div className="px-3 pb-3">
              <button
                type="button"
                aria-expanded={quickActionsOpen}
                onClick={toggleQuickActions}
                className="mb-1 flex w-full items-center justify-between rounded-xl px-1 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quick Actions</span>
                <ChevronDownIcon className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${quickActionsOpen ? '' : '-rotate-90'}`} />
              </button>
              {quickActionsOpen ? (
                <div className="space-y-1">
                  {INTERVIEW_FRIEND_QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => session.applyQuickAction(action.id)}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${action.wrap}`}>
                        <action.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{action.label}</span>
                        <span className="block truncate text-[11px] text-slate-500">{QUICK_COPY[action.id]}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recents</p>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
            {session.historyLoading ? (
              <p className="px-2 py-6 text-xs text-slate-500">Loading conversations…</p>
            ) : session.historyError ? (
              <p className="px-2 py-6 text-xs text-rose-600 dark:text-rose-400">{session.historyError}</p>
            ) : filteredHistory.length ? (
              filteredHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => session.loadConversation(item.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left ${
                    session.conversationId === item.id
                      ? 'bg-violet-100 dark:bg-violet-950/50'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <p className="truncate text-sm font-medium">{item.title || 'New conversation'}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{formatStamp(item.updatedAt)}</p>
                </button>
              ))
            ) : (
              <p className="px-2 py-6 text-xs text-slate-500">
                {historyQuery.trim() ? 'No matching conversations.' : 'No saved conversations yet.'}
              </p>
            )}
          </div>

          <div className="relative mt-auto border-t border-slate-200 p-3 dark:border-white/10" ref={profileMenuRef}>
            {profileMenuOpen ? (
              <div className="absolute bottom-full left-2 right-2 z-40 mb-2 max-h-[min(70vh,20rem)] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-[#0f172a]">
                <button
                  type="button"
                  onClick={goProfile}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-700"
                >
                  <UserCircleIcon className="h-4 w-4 shrink-0" />
                  Profile
                </button>
                <button
                  type="button"
                  onClick={openSettings}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-700"
                >
                  <Cog6ToothIcon className="h-4 w-4 shrink-0" />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={goHelp}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-700"
                >
                  <QuestionMarkCircleIcon className="h-4 w-4 shrink-0" />
                  Help
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 active:bg-rose-50 dark:hover:bg-slate-800 dark:active:bg-slate-700"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4 shrink-0" />
                  Sign out
                </button>
              </div>
            ) : null}

            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((open) => !open)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <UserAvatar user={user} className="h-9 w-9 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{displayName}</span>
                  <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{planLabel}</span>
                </span>
              </button>
              <Link
                to="/pricing"
                className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Upgrade
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <button type="button" aria-label="Close sidebar" className="fixed inset-0 z-10 bg-slate-900/40 lg:hidden" onClick={closeSidebar} />
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className={`flex min-h-0 min-w-0 flex-1 overflow-hidden ${simpleChat ? '' : 'lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]'}`}>
          <section
            className={`min-h-0 min-w-0 flex-col overflow-hidden p-3 dark:border-white/10 lg:p-4 ${
              simpleChat ? 'hidden' : 'hidden min-[900px]:flex'
            }`}
          >
            {desktopHidden ? <div className="mb-8 hidden lg:block" /> : null}
            <div ref={videoWrapRef} className="relative mx-auto w-full max-w-3xl shrink-0">
              <InterviewerAvatarVideo speaking={speaking} playbackId={session.playbackId} label={coachName} className="w-full" />
              <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between">
                <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] text-white">{statusLabel(session.status)}</span>
                <div className="pointer-events-auto flex gap-1">
                  <button type="button" aria-label="Microphone" onClick={session.handleVoicePress} className="rounded-full bg-black/55 p-2 text-white">
                    {session.status === 'listening' ? <StopIcon className="h-4 w-4" /> : <MicrophoneIcon className="h-4 w-4" />}
                  </button>
                  <button type="button" aria-label="Replay voice" onClick={session.replayLastSpeech} className="rounded-full bg-black/55 p-2 text-white">
                    <SpeakerWaveIcon className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Fullscreen" onClick={enterFullscreen} className="rounded-full bg-black/55 p-2 text-white">
                    <ArrowsPointingOutIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
              {session.currentQuestion ? (
                <div className="mb-3 flex justify-end">
                  <div className="max-w-[90%] break-words rounded-2xl bg-violet-600 px-3 py-2 text-sm text-white">{session.currentQuestion}</div>
                </div>
              ) : null}
              <div className="mb-3 min-w-0 rounded-2xl bg-white p-3 dark:bg-slate-900">
                {(session.currentAnswer || session.status === 'thinking' || preparing) ? (
                  <>
                    <p className="mb-2 text-xs font-semibold text-slate-500">{coachName}</p>
                    {session.status === 'thinking' && !session.currentAnswer ? (
                      <p className="text-sm text-slate-500">Thinking…</p>
                    ) : preparing && !session.currentAnswer ? (
                      <p className="text-sm text-slate-500">Preparing response…</p>
                    ) : (
                      <InterviewFriendAnswer text={session.currentAnswer} />
                    )}
                  </>
                ) : null}
                <div className={session.currentAnswer ? 'mt-3 min-w-0' : 'min-w-0'}>
                  <InterviewFriendVideos
                    videos={session.videos}
                    loading={session.videosLoading}
                    exhausted={session.videosExhausted}
                    activeVideoId={session.activeVideoId}
                    onSelect={(video) => session.setActiveVideoId(video.videoId)}
                    showPlayer
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-2 sm:p-3">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/15 dark:bg-[#0b1224]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  aria-label="Open sidebar"
                  onClick={openSidebar}
                  className="rounded-lg p-2 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
                >
                  <Bars3Icon className="h-5 w-5" />
                </button>
                <p className="text-sm font-semibold">Chat</p>
              </div>
              <button type="button" onClick={session.clearChat} className="shrink-0 text-xs font-medium text-slate-500 hover:text-violet-600">
                Clear
              </button>
            </div>
            <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 py-4">
              {!turns.length ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-5 dark:bg-slate-900/60">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Welcome, {firstName}. How can I help you?
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    I am listening. Ask anything — a greeting, a topic, or a playlist.
                  </p>
                </div>
              ) : turns.map((item, index) => {
                const last = index === turns.length - 1;
                const text = item.role === 'assistant' && last ? (session.currentAnswer || item.content) : item.content;
                return (
                  <div key={item.id || `${item.role}-${index}`} className={item.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    {item.role === 'user' ? (
                      <div className="max-w-[85%] break-words rounded-2xl bg-violet-600 px-3.5 py-2 text-sm leading-relaxed text-white">{item.content}</div>
                    ) : (
                      <div className="max-w-[90%] min-w-0 break-words rounded-2xl bg-slate-100 px-3.5 py-2 text-sm leading-relaxed text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                        {session.status === 'thinking' && last && !text ? (
                          <span className="text-slate-500 dark:text-slate-400">Thinking…</span>
                        ) : preparing && last && !text ? (
                          <span className="text-slate-500 dark:text-slate-400">Preparing response…</span>
                        ) : (
                          <InterviewFriendAnswer text={text} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {simpleChat ? (
                <InterviewFriendVideos
                  videos={session.videos}
                  loading={session.videosLoading}
                  exhausted={session.videosExhausted}
                  activeVideoId={session.activeVideoId}
                  onSelect={(video) => session.setActiveVideoId(video.videoId)}
                  compact
                  showPlayer
                />
              ) : (
                <InterviewFriendVideos
                  videos={session.videos}
                  loading={false}
                  exhausted={false}
                  activeVideoId={session.activeVideoId}
                  onSelect={(video) => session.setActiveVideoId(video.videoId)}
                  compact
                  showPlayer={false}
                />
              )}
              {session.audioError ? (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
                  Audio is temporarily unavailable. You can still read the response.
                </p>
              ) : null}
              {session.voiceHint ? <p className="text-xs text-amber-600 dark:text-amber-300">{session.voiceHint}</p> : null}
              {session.error ? <p className="text-xs text-rose-600">{session.error}</p> : null}
            </div>
            <div className="shrink-0 border-t border-slate-100 p-3 dark:border-white/10">
              <InterviewFriendComposer
                compact
                draft={session.draft}
                onDraftChange={session.setDraft}
                onSend={session.sendDraft}
                onVoicePress={session.handleVoicePress}
                onStop={session.stopSpeaking}
                onReplay={session.replayLastSpeech}
                listenBlocked={session.listenBlocked}
                voiceListening={session.status === 'listening'}
                micEnabled={session.micEnabled}
                speaking={speaking || preparing}
                thinking={session.status === 'thinking'}
                activeMode={session.mode}
              />
            </div>
          </section>
          </div>
        </div>
      </div>

      <AppModalShell
        open={settingsModalOpen}
        title="AI Coach Settings"
        icon="settings"
        onClose={() => setSettingsModalOpen(false)}
      >
        <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
          Update your coach name and chat layout.
        </p>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Coach Name</p>
            <p className="truncate text-[11px] text-slate-500">{coachName}</p>
            {editingName ? (
              <div className="mt-2 flex min-w-0 gap-2">
                <input
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
                <button type="button" onClick={saveCoachName} className="shrink-0 rounded-lg bg-violet-600 px-2 py-1 text-xs font-semibold text-white">
                  Save
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setEditingName(true)} className="mt-2 text-xs font-medium text-violet-600">
                Change
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-900 dark:text-white">Simple Chat Mode</span>
              <span className="text-[11px] text-slate-500">Hide the coach video and expand chat</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={simpleChat}
              onClick={toggleSimpleChat}
              className={`relative h-6 w-11 shrink-0 rounded-full ${simpleChat ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${simpleChat ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </AppModalShell>
    </div>
  );
};

export default InterviewFriend;
