import type { PostHogConfig } from 'posthog-js';

import { getAnalyticsDeviceContext } from '../deviceContext';
import { getAnalyticsTrafficContext } from '../trafficContext';
import { classifyPostHogException } from './errorClassification';
import type { PostHogAuthStatus, PostHogSessionContext } from './types';
export const isValidPostHogConfiguration = (projectToken: string, host: string): boolean => {
  if (projectToken.trim().length === 0) return false;
  try {
    const url = new URL(host);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};
export const getPostHogOptions = (
  host: string,
  getContext: () => PostHogSessionContext | null,
  isEnabled: () => boolean = () => true,
  getAuthStatus: () => PostHogAuthStatus | undefined = () => undefined,
): Partial<PostHogConfig> => ({
  api_host: host,
  autocapture: true,
  capture_exceptions: { capture_unhandled_errors: true, capture_unhandled_rejections: true },
  before_send: (event) => {
    if (event === null || !isEnabled()) return null;
    const context = getContext();
    // 수동 이벤트는 발생 당시 값을 보존한다. 자동 이벤트만 현재 상태로 보강한다.
    const authStatus =
      event.properties.auth_status === 'anonymous' || event.properties.auth_status === 'authenticated'
        ? event.properties.auth_status
        : getAuthStatus();
    const trafficType = event.properties.traffic_type;
    const properties = {
      ...event.properties,
      ...context,
      ...getAnalyticsDeviceContext(),
      ...getAnalyticsTrafficContext(context?.environment ?? event.properties.environment),
      ...(['test', 'development', 'external'].includes(trafficType) ? { traffic_type: trafficType } : {}),
      ...(authStatus ? { auth_status: authStatus } : {}),
    };
    return {
      ...event,
      properties: event.event === '$exception' ? classifyPostHogException(undefined, properties) : properties,
    };
  },
  capture_pageview: false,
  disable_session_recording: false,
  mask_all_text: true,
  mask_all_element_attributes: true,
});
