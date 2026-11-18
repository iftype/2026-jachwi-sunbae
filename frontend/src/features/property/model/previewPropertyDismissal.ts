const STORAGE_KEY = 'jachwi.hidden-preview-properties';
const CHANGE_EVENT = 'jachwi-preview-properties-changed';

export const hiddenPreviewSnapshot = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '[]';
  } catch {
    return '[]';
  }
};
export const parseHiddenPreviewIds = (raw: string): number[] => {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id < 0)
      : [];
  } catch {
    return [];
  }
};
export const subscribeHiddenPreviews = (notify: () => void) => {
  window.addEventListener(CHANGE_EVENT, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(CHANGE_EVENT, notify);
    window.removeEventListener('storage', notify);
  };
};
/** 서버에 없는 예시는 이 기기에서 숨기고, 실제 매물 삭제 요청을 보내지 않는다. */
export const dismissPreviewProperty = (id: number) => {
  const ids = parseHiddenPreviewIds(hiddenPreviewSnapshot());
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set([...ids, id])]));
  window.dispatchEvent(new Event(CHANGE_EVENT));
};
