import { resolveAvatarSrc } from '../utils/profileAvatars';

export default function UserAvatar({ user, src, className = 'h-8 w-8' }) {
  const imageSrc = src || resolveAvatarSrc(user?.avatarUrl);
  const label = user?.name || user?.email || 'Profile photo';

  // Avatar available nahi hai
  if (!imageSrc) {
    const initial = (user?.name || user?.email || 'U')
      .charAt(0)
      .toUpperCase();

    return (
      <div
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 font-semibold text-white ${className}`}
        aria-label={label}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={label}
      className={`rounded-full object-cover ${className}`}
    />
  );
}