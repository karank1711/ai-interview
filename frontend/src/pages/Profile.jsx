import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CameraIcon,
  CloudArrowUpIcon,
  CalendarDaysIcon,
  EnvelopeIcon,
  InformationCircleIcon,
  LockClosedIcon,
  PhotoIcon,
  PlusIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserCircleIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { usePopup } from '../components/AppPopup';
import UserAvatar from '../components/UserAvatar';
import { authService } from '../services/authService';
import {
  DEFAULT_AVATAR_ID,
  PRESET_AVATARS,
  fileToProfileImage,
  resolveAvatarSrc,
} from '../utils/profileAvatars';

function formatMemberSince(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const Profile = ({ user, setUser }) => {
  const { showPopup } = usePopup();
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || DEFAULT_AVATAR_ID);

  useEffect(() => {
    if (user?.avatarUrl) setAvatarUrl(user.avatarUrl);
  }, [user?.avatarUrl]);

  const previewSrc = useMemo(() => resolveAvatarSrc(avatarUrl), [avatarUrl]);
  const statusActive = user?.emailVerified !== false;

  const openFilePicker = () => fileInputRef.current?.click();

  const persistAvatar = async (nextAvatar) => {
    setAvatarUrl(nextAvatar);
    setSaving(true);
    try {
      const response = await authService.updateProfile({
        name: user?.name || 'User',
        phoneNumber: user?.phoneNumber || '',
        avatarUrl: nextAvatar,
      });
      const saved = response.data || {};
      setUser((current) => ({
        ...current,
        ...saved,
        avatarUrl: saved.avatarUrl || nextAvatar,
        id: current.id,
        name: current.name,
        email: current.email,
        phoneNumber: current.phoneNumber,
      }));
    } catch (error) {
      showPopup({
        type: 'error',
        title: 'Could not save photo',
        message: error.message || 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await fileToProfileImage(file);
      await persistAvatar(dataUrl);
    } catch (error) {
      showPopup({
        type: 'error',
        title: 'Could not use that photo',
        message: error.message || 'Please choose a JPG or PNG under 5MB.',
      });
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 dark:bg-[#070b16] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-sky-100 via-indigo-50 to-violet-100 px-6 py-7 sm:px-8 dark:from-slate-800 dark:via-indigo-950 dark:to-slate-800">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm dark:bg-slate-900">
                <UserCircleIcon className="h-8 w-8 text-indigo-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white sm:text-3xl">My Profile</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                  Manage your photo and view your account details.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2 text-sm font-medium text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300">
              <SparklesIcon className="h-4 w-4" />
              Better Interviews. Brighter Opportunities.
            </div>
          </div>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-gray-800 dark:ring-slate-700">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-indigo-900/50 dark:text-indigo-300">
              <PhotoIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Profile Photo & Avatar</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Choose an avatar or upload your own photo</p>
            </div>
          </div>

          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[auto_1fr]">
            <div className="flex justify-center md:justify-start">
              <div className="relative">
                <UserAvatar
                  user={user}
                  src={previewSrc}
                  className="h-36 w-36 shadow-sm ring-4 ring-indigo-50 dark:ring-indigo-900/40"
                />
                <button
                  type="button"
                  aria-label="Change profile photo"
                  onClick={openFilePicker}
                  disabled={saving}
                  className="absolute bottom-1 right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-violet-500 text-white shadow-md hover:bg-violet-600 disabled:opacity-60"
                >
                  <CameraIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-w-0">
              <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-white">Choose an Avatar</p>
              <div className="flex flex-wrap items-center gap-3">
                {PRESET_AVATARS.map((avatar) => {
                  const isSelected = avatarUrl === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      disabled={saving}
                      onClick={() => persistAvatar(avatar.id)}
                      className={`h-14 w-14 overflow-hidden rounded-full ring-2 transition ${
                        isSelected ? 'ring-violet-500 ring-offset-2' : 'ring-transparent hover:ring-violet-200'
                      }`}
                      aria-label="Select avatar"
                    >
                      <img src={avatar.src} alt="" className="h-full w-full object-cover" />
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-label="Upload a custom photo"
                  onClick={openFilePicker}
                  className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm hover:border-violet-300 hover:text-violet-500 dark:border-slate-600 dark:bg-slate-900"
                >
                  <PlusIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="mt-5 flex flex-col gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-600 dark:bg-slate-900/40">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-violet-500 dark:bg-violet-900/40">
                    <CloudArrowUpIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Upload Photo</p>
                    <p className="text-xs text-slate-500">JPG, PNG (Max 5MB)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={saving}
                  className="cursor-pointer rounded-lg bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-200 disabled:opacity-60 dark:bg-violet-900/40 dark:text-violet-300"
                >
                  {saving ? 'Saving…' : 'Choose File'}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleFile}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-gray-800 dark:ring-slate-700">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Account Information</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">View your account details.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <UserIcon className="mt-0.5 h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Full Name</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">{user?.name || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <EnvelopeIcon className="mt-0.5 h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Email Address</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">{user?.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <LockClosedIcon className="mt-0.5 h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Password</p>
                <p className="text-sm font-semibold tracking-widest text-slate-800 dark:text-white">••••••••</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDaysIcon className="mt-0.5 h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Member Since</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">{formatMemberSince(user?.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="mt-0.5 h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <span
                  className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    statusActive
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {statusActive ? 'Active' : 'Pending'}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-xl bg-sky-50 px-4 py-3 text-sm text-slate-600 dark:bg-sky-950/40 dark:text-slate-300">
            <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
            <p>
              To update your account details, go to{' '}
              <Link to="/settings" className="font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400">
                Settings
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Profile;
