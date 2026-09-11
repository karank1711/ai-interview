export const PRESET_AVATARS = [
  { id: 'preset:1', src: '/avatars/01.png' },
  { id: 'preset:2', src: '/avatars/02.png' },
  { id: 'preset:3', src: '/avatars/03.png' },
  { id: 'preset:4', src: '/avatars/04.png' },
  { id: 'preset:5', src: '/avatars/05.png' },
  { id: 'preset:6', src: '/avatars/06.png' },
  { id: 'preset:7', src: '/avatars/07.png' },
  { id: 'preset:8', src: '/avatars/08.png' },
];

export const DEFAULT_AVATAR_ID = PRESET_AVATARS[0].id;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function resolveAvatarSrc(value) {
  if (!value) return PRESET_AVATARS[0].src;
  const preset = PRESET_AVATARS.find((item) => item.id === value);
  if (preset) return preset.src;
  if (value.startsWith('data:image/') || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
    return value;
  }
  return PRESET_AVATARS[0].src;
}

export function isPresetAvatar(value) {
  return PRESET_AVATARS.some((item) => item.id === value);
}

export async function fileToProfileImage(file) {
  const type = String(file?.type || '').toLowerCase();
  if (type !== 'image/jpeg' && type !== 'image/jpg' && type !== 'image/png') {
    throw new Error('Please choose a JPG or PNG image.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Image must be 5MB or smaller.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.src = objectUrl;
    });
    const edge = 384;
    const source = Math.min(image.width, image.height);
    const sx = Math.max(0, (image.width - source) / 2);
    const sy = Math.max(0, (image.height - source) / 2);
    const canvas = document.createElement('canvas');
    canvas.width = edge;
    canvas.height = edge;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, edge, edge);
    ctx.drawImage(image, sx, sy, source, source, 0, 0, edge, edge);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
