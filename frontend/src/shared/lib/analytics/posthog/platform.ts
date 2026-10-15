import { getAnalyticsDeviceContext } from '../deviceContext';
import type { PostHogSessionContext } from './types';
export const getPostHogPlatform = (): PostHogSessionContext['platform'] => getAnalyticsDeviceContext().platform;
