// 호출부는 SDK 상태를 모르고 이 진입점만 사용한다.
export { isValidPostHogConfiguration } from './posthog/configuration';
export { capturePostHogException } from './posthog/exceptions';
export { getPostHogPlatform } from './posthog/platform';
export {
  getPostHogDiagnostics,
  identifyPostHogMember,
  initPostHog,
  resetPostHogClientForTests as resetPostHogForTests,
  resetPostHogIdentity,
  setPostHogSessionContext,
  trackPostHogEvent,
  trackPostHogPageView,
} from './posthog/runtime';
export type { PostHogErrorCategory, PostHogErrorSeverity } from './posthog/types';
