import type { MapAddress } from '@/features/map/model/Map';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

type Journey = {
  id: string;
  mode: 'commute' | 'price';
  createdAt: number;
  mock: boolean;
  completed: boolean;
  converted?: boolean;
  selectedLocation?: MapAddress;
  formViewed?: boolean;
};
const KEY = 'jachwi.exploration-journey';
let memoryJourney: Journey | null = null;
const read = (): Journey | null => {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Journey | null;
    return value &&
      typeof value.id === 'string' &&
      ['commute', 'price'].includes(value.mode) &&
      typeof value.mock === 'boolean' &&
      typeof value.completed === 'boolean' &&
      typeof value.createdAt === 'number' &&
      Date.now() - value.createdAt >= 0 &&
      Date.now() - value.createdAt < 30 * 60 * 1000
      ? value
      : null;
  } catch {
    return memoryJourney && Date.now() - memoryJourney.createdAt < 30 * 60 * 1000 ? memoryJourney : null;
  }
};
const write = (value: Journey) => {
  memoryJourney = value;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* 저장소가 차단되면 현재 탭의 메모리로 이어간다. */
  }
};
const capture = (event: string, journey: Journey, extra: Record<string, unknown> = {}) =>
  trackPostHogEvent(event, {
    journey_id: journey.id,
    exploration_mode: journey.mode,
    source: 'landing',
    mock_data: journey.mock,
    ...extra,
  });
export const startExploration = (mode: Journey['mode'], mock: boolean) => {
  const journey: Journey = { id: crypto.randomUUID(), mode, mock, createdAt: Date.now(), completed: false };
  write(journey);
  capture('exploration_started', journey);
};
export const completeExploration = (count: number) => {
  const journey = read();
  if (!journey || journey.completed) return;
  write({ ...journey, completed: true });
  capture('exploration_completed', journey, { result_count: count });
};
export const prepareExplorationRecord = (selectedLocation: MapAddress) => {
  const journey = read();
  if (!journey?.completed) return;
  write({ ...journey, converted: true, selectedLocation });
  capture('exploration_record_cta_clicked', journey);
};
export const getExplorationRecordLocation = () => {
  const journey = read();
  const value = journey?.converted ? journey.selectedLocation : undefined;
  return value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude) ? value : undefined;
};
export const trackExplorationLogin = (newMember: boolean) => {
  const journey = read();
  if (journey?.converted) capture('exploration_login_completed', journey, { new_member: newMember });
};
export const trackExplorationRecordView = () => {
  const journey = read();
  if (!journey?.converted || journey.formViewed) return;
  write({ ...journey, formViewed: true });
  capture('exploration_record_form_viewed', journey);
};
export const trackExplorationSaved = () => {
  const journey = read();
  if (!journey?.converted || !journey.formViewed) return;
  capture('exploration_property_saved', journey);
  memoryJourney = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* 다음 화면 이동을 막지 않는다. */
  }
};
