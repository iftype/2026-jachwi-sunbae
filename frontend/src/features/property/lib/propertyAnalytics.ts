import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

export type PropertyCreationEntrypoint = 'form' | 'map';
type PropertyEvents = {
  property_creation_started: { entrypoint: PropertyCreationEntrypoint };
  property_creation_submitted: { entrypoint: PropertyCreationEntrypoint };
  property_created: { entrypoint: PropertyCreationEntrypoint; property_id: number; first_property?: boolean };
  property_creation_failed: { entrypoint: PropertyCreationEntrypoint; error_kind: 'request' };
  property_memo_saved: { property_id: number };
  property_memo_save_failed: { property_id: number; error_kind: 'request' };
};

/** 성공·실패는 API 경계에서 기록하고 사용자 입력 원문은 보내지 않는다. */
export const trackPropertyEvent = <Event extends keyof PropertyEvents>(
  event: Event,
  properties: PropertyEvents[Event],
) => trackPostHogEvent(event, properties);
