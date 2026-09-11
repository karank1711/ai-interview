export const TESTIMONIAL_AVATARS = [
  {
    src: 'https://randomuser.me/api/portraits/women/44.jpg',
    alt: 'InterviewIQ user',
  },
  {
    src: 'https://randomuser.me/api/portraits/men/32.jpg',
    alt: 'InterviewIQ user',
  },
  {
    src: 'https://randomuser.me/api/portraits/women/68.jpg',
    alt: 'InterviewIQ user',
  },
  {
    src: 'https://randomuser.me/api/portraits/men/75.jpg',
    alt: 'InterviewIQ user',
  },
];

export default function AvatarStack({
  avatars = TESTIMONIAL_AVATARS,
  className = 'h-10 w-10',
}) {
  return (
    <div className="flex -space-x-2">
      {avatars.map((avatar, index) => (
        <img
          key={avatar.src || index}
          src={avatar.src}
          alt={avatar.alt || ''}
          className={`${className} relative rounded-full border-2 border-white object-cover`}
          style={{ zIndex: index + 1 }}
        />
      ))}
    </div>
  );
}
