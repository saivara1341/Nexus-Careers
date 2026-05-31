import { Capacitor } from '@capacitor/core';

export const NATIVE_AUTH_REDIRECT_URL = 'com.nexuscareers.platform://auth/callback';

export const isNativeApp = () => Capacitor.isNativePlatform();

export const getAuthRedirectUrl = () => {
  if (isNativeApp()) return NATIVE_AUTH_REDIRECT_URL;

  const basePath = import.meta.env.BASE_URL || '/';
  const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${window.location.origin}${normalizedBasePath}auth/callback`;
};

export const getAuthCodeFromUrl = (url: string) => {
  try {
    return new URL(url).searchParams.get('code');
  } catch {
    return null;
  }
};

export const isNativeAuthCallback = (url: string) => url.startsWith(NATIVE_AUTH_REDIRECT_URL);
