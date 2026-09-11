const memory = new Map();
const STORAGE_PREFIX = 'interviewiq:page:';

export function readPageCache(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const value = JSON.parse(raw);
    memory.set(key, value);
    return value;
  } catch {
    return null;
  }
}

export function writePageCache(key, value) {
  memory.set(key, value);
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPageCache() {
  memory.clear();
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const itemKey = sessionStorage.key(i);
      if (itemKey?.startsWith(STORAGE_PREFIX)) keys.push(itemKey);
    }
    keys.forEach((itemKey) => sessionStorage.removeItem(itemKey));
  } catch {
    /* ignore */
  }
}
