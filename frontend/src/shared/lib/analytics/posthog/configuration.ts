import type { PostHogConfig } from 'posthog-js';

import { getAnalyticsDeviceContext } from '../deviceContext';
import { getAnalyticsTrafficContext } from '../trafficContext';
import { classifyPostHogException } from './errorClassification';
import type { PostHogSessionContext } from './types';
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
): Partial<PostHogConfig> => ({
  api_host: host,
  autocapture: true,
  capture_exceptions: { capture_unhandled_errors: true, capture_unhandled_rejections: true },
  before_send: (event) => {
    if (event === null || !isEnabled()) return null;
    const context = getContext();
    const properties = {
      ...event.properties,
      ...context,
      ...getAnalyticsDeviceContext(),
      ...getAnalyticsTrafficContext(context?.environment ?? event.properties.environment),
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
