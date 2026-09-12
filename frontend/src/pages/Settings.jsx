import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightIcon,
  BellIcon,
  BriefcaseIcon,
  CameraIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  ComputerDesktopIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  MoonIcon,
  PaintBrushIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  SunIcon,
  TrashIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { usePopup } from '../components/AppPopup';
import UserAvatar from '../components/UserAvatar';
import { authService } from '../services/authService';
import { interviewService } from '../services/interviewService';
import { clearPageCache } from '../utils/pageDataCache';
import { fileToProfileImage, resolveAvatarSrc } from '../utils/profileAvatars';
import { DEFAULT_SETTINGS, applyTheme, setAppTheme, THEME_CHANGE_EVENT } from '../utils/userSettings';

function Toggle({ enabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
        enabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          enabled ? 'left-5' : 'left-0.5'
        }`}
      />
    </button>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex min-h-[2.75rem] min-w-0 cursor-pointer items-center justify-center rounded-xl px-1.5 py-2 text-center text-[clamp(0.68rem,2.6vw,0.875rem)] font-medium leading-tight ring-1 transition sm:px-3 ${
              selected
                ? 'bg-blue-50 text-blue-700 ring-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900/40 dark:text-slate-300 dark:ring-slate-700'
            }`}
          >
            <span className="max-w-full break-words">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function AccountField({
  label,
  icon: Icon,
  value,
  onChange,
  editing,
  onEdit,
  type = 'text',
  disabled,
  autoComplete,
  trailing,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</label>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/50">
        <Icon className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          type={type}
          value={value}
          onChange={onChange}
          readOnly={!editing || disabled}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100 ${
            editing && !disabled ? 'cursor-text' : 'cursor-default'
          }`}
        />
        {trailing}
        <button
          type="button"
          aria-label={`Edit ${label}`}
          onClick={onEdit}
          disabled={disabled}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800"
        >
          <PencilSquareIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

const Settings = ({ user, setUser }) => {
  const navigate = useNavigate();
  const { showPopup } = usePopup();
  const fileInputRef = useRef(null);
  const saveTimer = useRef(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [editing, setEditing] = useState({ name: false, email: false, password: false });
  const passwordLogin = user?.passwordLogin !== false;

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    if (user?.avatarUrl) setAvatarUrl(user.avatarUrl);
  }, [user?.name, user?.email, user?.avatarUrl]);

  useEffect(() => {
    let cancelled = false;
    authService.getSettings(user?.id).then((next) => {
      if (!cancelled) {
        setSettings(next);
        setLoaded(true);
      }
    }).catch(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const onTheme = (event) => {
      const nextTheme = event.detail?.theme;
      if (!nextTheme) return;
      setSettings((current) => (current.theme === nextTheme ? current : { ...current, theme: nextTheme }));
    };
    window.addEventListener(THEME_CHANGE_EVENT, onTheme);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onTheme);
  }, []);

  useEffect(() => {
    if (settings.theme !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyTheme('system');
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [settings.theme]);

  const persist = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (patch.theme) setAppTheme(patch.theme, user?.id);
    else applyTheme(next.theme);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await authService.saveSettings(user?.id, next);
      } catch (error) {
        showPopup({
          type: 'error',
          title: 'Could not save settings',
          message: error.message || 'Please try again.',
        });
      }
    }, 350);
  };

  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await fileToProfileImage(file);
      setAvatarUrl(dataUrl);
    } catch (error) {
      showPopup({
        type: 'error',
        title: 'Could not use that photo',
        message: error.message || 'Please choose a JPG or PNG under 5MB.',
      });
    }
  };

  const handleSaveAccount = async (event) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      showPopup({ type: 'error', title: 'Name required', message: 'Please enter your full name.' });
      return;
    }
    if (editing.email && passwordLogin && !email.trim()) {
      showPopup({ type: 'error', title: 'Email required', message: 'Please enter a valid email address.' });
      return;
    }
    if (editing.password && passwordLogin && password && password.length < 8) {
      showPopup({
        type: 'error',
        title: 'Password too short',
        message: 'Use a strong password with at least 8 characters.',
      });
      return;
    }

    setSavingAccount(true);
    try {
      const payload = {
        name: nextName,
        phoneNumber: user?.phoneNumber || '',
        avatarUrl,
      };
      if (editing.email && passwordLogin && email.trim().toLowerCase() !== String(user?.email || '').toLowerCase()) {
        payload.email = email.trim().toLowerCase();
      }
      if (editing.password && passwordLogin && password) {
        payload.password = password;
      }
      const response = await authService.updateProfile(payload);
      const saved = response.data || {};
      setUser((current) => ({
        ...current,
        ...saved,
        name: saved.name || nextName,
        email: saved.email || payload.email || current.email,
        avatarUrl: saved.avatarUrl || avatarUrl,
        id: current.id,
        phoneNumber: current.phoneNumber,
      }));
      setPassword('');
      setShowPassword(false);
      setEditing({ name: false, email: false, password: false });
      showPopup({
        type: 'success',
        title: 'Changes saved',
        message: payload.email
          ? 'Check your inbox if email confirmation is required.'
          : 'Your account settings were updated.',
      });
    } catch (error) {
      showPopup({
        type: 'error',
        title: 'Could not save changes',
        message: error.message || 'Please try again.',
      });
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDeleteHistory = () => {
    showPopup({
      type: 'confirm',
      title: 'Delete interview history?',
      message: 'This removes your saved interviews and reports. This cannot be undone.',
      confirmLabel: 'Delete history',
      onConfirm: async () => {
        try {
          const response = await interviewService.getUserInterviews(0, 100);
          const rows = response.data || [];
          await Promise.all(rows.map((item) => interviewService.deleteInterview(item.id || item._id)));
          clearPageCache();
          showPopup({ type: 'success', title: 'History deleted', message: 'Your interview history was removed.' });
        } catch (error) {
          showPopup({
            type: 'error',
            title: 'Could not delete history',
            message: error.message || error.response?.data?.message || 'Please try again.',
          });
        }
      },
    });
  };

  const handleSignOutAll = () => {
    showPopup({
      type: 'confirm',
      title: 'Sign out from all devices?',
      message: 'You will need to sign in again on this device and any others.',
      confirmLabel: 'Sign out everywhere',
      onConfirm: async () => {
        try {
          await authService.signOutAllDevices();
          setUser(null);
          navigate('/login');
        } catch (error) {
          showPopup({
            type: 'error',
            title: 'Could not sign out',
            message: error.message || 'Please try again.',
          });
        }
      },
    });
  };

  const handleDeleteAccount = () => {
    showPopup({
      type: 'confirm',
      title: 'Delete your account?',
      message: 'Your profile and interview data will be removed. This cannot be undone.',
      confirmLabel: 'Delete account',
      onConfirm: async () => {
        try {
          await authService.deleteAccount();
          setUser(null);
          navigate('/signup');
        } catch (error) {
          showPopup({
            type: 'error',
            title: 'Could not delete account',
            message: error.message || 'Please try again.',
          });
        }
      },
    });
  };

  const themes = [
    { id: 'light', label: 'Light', icon: SunIcon },
    { id: 'dark', label: 'Dark', icon: MoonIcon },
    { id: 'system', label: 'System', icon: Squares2X2Icon },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-3 py-6 dark:bg-[#070b16] sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white shadow-sm">
            <Cog6ToothIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white sm:text-3xl">Settings</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              Manage your account, interview preferences and app settings.
            </p>
          </div>
        </div>

        <div className={`grid grid-cols-1 items-start gap-6 lg:grid-cols-2 ${loaded ? '' : 'opacity-80'}`}>
          <div className="space-y-6">
            <form
              onSubmit={handleSaveAccount}
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-gray-800 dark:ring-slate-700"
            >
              <div className="mb-5 flex items-start gap-3">
                <UserIcon className="mt-0.5 h-5 w-5 text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Account Settings</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Update your personal information and account details.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="relative mx-auto shrink-0 sm:mx-0">
                  <UserAvatar
                    user={user}
                    src={resolveAvatarSrc(avatarUrl)}
                    className="h-28 w-28 ring-4 ring-blue-50 dark:ring-blue-900/30"
                  />
                  <button
                    type="button"
                    aria-label="Change profile photo"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-1 right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-blue-500 text-white shadow-md hover:bg-blue-600"
                  >
                    <CameraIcon className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={handleAvatarFile}
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <AccountField
                    label="Full Name"
                    icon={UserIcon}
                    value={name}
                    editing={editing.name}
                    onChange={(event) => setName(event.target.value)}
                    onEdit={() => setEditing((current) => ({ ...current, name: true }))}
                    autoComplete="name"
                  />
                  <AccountField
                    label="Email Address"
                    icon={EnvelopeIcon}
                    type="email"
                    value={email}
                    editing={editing.email}
                    disabled={!passwordLogin}
                    onChange={(event) => setEmail(event.target.value)}
                    onEdit={() => setEditing((current) => ({ ...current, email: true }))}
                    autoComplete="email"
                  />
                  <AccountField
                    label="Password"
                    icon={LockClosedIcon}
                    type={editing.password && showPassword ? 'text' : 'password'}
                    value={editing.password ? password : '••••••••'}
                    editing={editing.password}
                    disabled={!passwordLogin}
                    onChange={(event) => setPassword(event.target.value)}
                    onEdit={() => {
                      if (!passwordLogin) return;
                      setPassword('');
                      setShowPassword(false);
                      setEditing((current) => ({ ...current, password: true }));
                    }}
                    autoComplete="new-password"
                    trailing={
                      <button
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((current) => !current)}
                        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                      </button>
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingAccount}
                className="mt-6 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                {savingAccount ? 'Saving…' : 'Save Changes'}
              </button>
            </form>

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-gray-800 dark:ring-slate-700">
              <div className="mb-4 flex items-start gap-3">
                <BellIcon className="mt-0.5 h-5 w-5 text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Notifications</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Get notified about important updates and events.
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {[
                  {
                    key: 'interviewReminders',
                    title: 'Interview reminders',
                    icon: BellIcon,
                    enabled: settings.interviewReminders,
                  },
                  {
                    key: 'interviewCompletionNotifications',
                    title: 'Interview completion notifications',
                    icon: CheckBadgeIcon,
                    enabled: settings.interviewCompletionNotifications,
                  },
                  {
                    key: 'productUpdateNotifications',
                    title: 'Product / feature updates',
                    icon: BriefcaseIcon,
                    enabled: settings.productUpdateNotifications,
                  },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 text-slate-400" />
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.title}</p>
                    </div>
                    <Toggle
                      enabled={item.enabled}
                      label={item.title}
                      onChange={(value) => persist({ [item.key]: value })}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-gray-800 dark:ring-slate-700">
              <div className="mb-4 flex items-start gap-3">
                <ShieldCheckIcon className="mt-0.5 h-5 w-5 text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Privacy & Security</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Manage your data and account security.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDeleteHistory}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl px-1 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900/40"
              >
                <span className="flex items-center gap-3">
                  <TrashIcon className="h-5 w-5 text-slate-400" />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">Delete Interview History</span>
                </span>
                <ArrowRightIcon className="h-4 w-4 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={handleSignOutAll}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl px-1 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900/40"
              >
                <span className="flex items-center gap-3">
                  <ComputerDesktopIcon className="h-5 w-5 text-slate-400" />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">Logout from All Devices</span>
                </span>
                <ArrowRightIcon className="h-4 w-4 text-slate-400" />
              </button>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-gray-800 dark:ring-slate-700">
              <div className="mb-5 flex items-start gap-3">
                <ChatBubbleLeftRightIcon className="mt-0.5 h-5 w-5 text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Interview Preferences</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Customize your interview experience.</p>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Default Interview Difficulty</p>
                  <Segmented
                    value={settings.defaultDifficulty}
                    onChange={(defaultDifficulty) => persist({ defaultDifficulty })}
                    options={[
                      { value: 'FRESHER', label: 'Easy' },
                      { value: 'INTERMEDIATE', label: 'Intermediate' },
                      { value: 'EXPERIENCED', label: 'Hard' },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Default Interview Type</p>
                  <Segmented
                    value={settings.defaultInterviewType}
                    onChange={(defaultInterviewType) => persist({ defaultInterviewType })}
                    options={[
                      { value: 'TECHNICAL', label: 'Technical' },
                      { value: 'HR', label: 'HR' },
                      { value: 'MIXED', label: 'Mixed' },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Speaking Speed</p>
                  <Segmented
                    value={settings.speakingSpeed}
                    onChange={(speakingSpeed) => persist({ speakingSpeed })}
                    options={[
                      { value: 'slow', label: 'Slow' },
                      { value: 'normal', label: 'Normal' },
                      { value: 'fast', label: 'Fast' },
                    ]}
                  />
                </div>
                <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">AI Follow-up Questions</p>
                    <p className="mt-0.5 text-xs text-slate-500">Allow AI to ask follow-up questions after each response.</p>
                  </div>
                  <Toggle
                    enabled={settings.aiFollowUpQuestions}
                    label="AI Follow-up Questions"
                    onChange={(aiFollowUpQuestions) => persist({ aiFollowUpQuestions })}
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Auto-play AI Voice</p>
                    <p className="mt-0.5 text-xs text-slate-500">Automatically play AI voice for questions.</p>
                  </div>
                  <Toggle
                    enabled={settings.autoPlayAiVoice}
                    label="Auto-play AI Voice"
                    onChange={(autoPlayAiVoice) => persist({ autoPlayAiVoice })}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-gray-800 dark:ring-slate-700">
              <div className="mb-4 flex items-start gap-3">
                <PaintBrushIcon className="mt-0.5 h-5 w-5 text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Appearance</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Customize how InterviewIQ looks for you.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {themes.map((theme) => {
                  const selected = settings.theme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => persist({ theme: theme.id })}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium ring-1 ${
                        selected
                          ? 'bg-blue-50 text-blue-700 ring-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900/40 dark:text-slate-300 dark:ring-slate-700'
                      }`}
                    >
                      <theme.icon className="h-4 w-4" />
                      {theme.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-rose-100 bg-rose-50 p-6 dark:border-rose-900/50 dark:bg-rose-950/30">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/60">
                  <ExclamationTriangleIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-rose-700 dark:text-rose-300">Danger Zone</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Permanent account actions. Please proceed with caution.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
              >
                <TrashIcon className="h-4 w-4" />
                Delete Account
              </button>
              <p className="mt-3 text-xs text-slate-500">This action cannot be undone.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
