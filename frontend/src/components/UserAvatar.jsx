import { resolveAvatarSrc } from '../utils/profileAvatars';

export default function UserAvatar({ user, src, className = 'h-8 w-8' }) {
  const imageSrc = src || resolveAvatarSrc(user?.avatarUrl);
  const label = user?.name || user?.email || 'Profile photo';
  return (
    <img
      src={imageSrc}
      alt={label}
      className={`rounded-full object-cover ${className}`}
    />
  );
}
