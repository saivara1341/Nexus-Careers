export const isBrowser = typeof window !== 'undefined';

export const isNativeApp = () => {
  if (!isBrowser) return false;
  return window.location.protocol === 'capacitor:' || window.location.protocol === 'https:' && window.location.hostname === 'localhost';
};

export const safeGetStorage = (storage: Storage | undefined, key: string, fallback = '') => {
  try {
    return storage?.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

export const safeSetStorage = (storage: Storage | undefined, key: string, value: string) => {
  try {
    storage?.setItem(key, value);
  } catch {
    // Android WebView can reject storage writes in low-storage or private contexts.
  }
};

export const safeParseJson = <T,>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const supportsSpeechRecognition = () => {
  if (!isBrowser) return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
};

export const getSpeechSynthesis = () => {
  if (!isBrowser || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis;
};
