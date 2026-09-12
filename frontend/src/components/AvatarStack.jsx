export const TESTIMONIAL_AVATARS = [
  {
    src: '/avatars/shubham.jpg',
    alt: 'Shubham',
    objectPosition: '42% 18%',
  },
  {
    src: '/avatars/ankit-jha.jpg',
    alt: 'Ankit Jha',
    objectPosition: '50% 28%',
  },
  {
    src: '/avatars/karan.jpg',
    alt: 'Karan',
    objectPosition: '72% 22%',
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
          style={{ zIndex: index + 1, objectPosition: avatar.objectPosition || '50% 20%' }}
        />
      ))}
    </div>
  );
}
