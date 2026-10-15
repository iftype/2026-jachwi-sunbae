export const getLandingMobilePlatform = (userAgent: string, maxTouchPoints = 0): 'ios' | 'android' | null => {
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return 'ios';
  return null;
};
export const LANDING_APP_URLS = {
  ios: 'https://apps.apple.com/us/app/%EC%9E%90%EC%B7%A8%EC%84%A0%EB%B0%B0/id6816321229',
  android: 'https://play.google.com/store/apps/details?id=com.jachwisunbae',
};
