import { getPostHogOptions, isValidPostHogConfiguration } from './configuration';
import type { PostHogAction, PostHogClient, PostHogSessionContext } from './types';
type Configuration = { key: string; projectToken: string; host: string };
let requestedConfiguration: Configuration | null = null;
let initializedConfiguration: string | null = null;
let client: PostHogClient | null = null;
let loadPromise: Promise<void> | null = null;
let pendingActions: PostHogAction[] = [];
const MAX_PENDING_ACTIONS = 100;
let generation = 0;
let sessionContext: PostHogSessionContext | null = null;
let identifiedMember: string | null = null;
let lastTrackedPath: string | null = null;
let status: 'disabled' | 'loading' | 'ready' | 'failed' = 'disabled';
let failedActions = 0;
let droppedActions = 0;
const diagnoseFailure = (reason: 'sdk_action' | 'sdk_load' | 'queue_full'): void => {
  if (sessionContext?.environment === 'development') console.warn(`[analytics] ${reason}`);
};
export const getPostHogDiagnostics = () => ({
  status,
  pendingActions: pendingActions.length,
  failedActions,
  droppedActions,
});
const resetTrackingState = (): void => {
  sessionContext = null;
  identifiedMember = null;
  lastTrackedPath = null;
};
const executeAction = (action: PostHogAction, loadedClient: PostHogClient): boolean => {
  try {
    action(loadedClient);
    return true;
  } catch {
    // 분석 SDK 오류가 로그인·저장 등 제품 동작을 실패시키면 안 된다.
    failedActions += 1;
    diagnoseFailure('sdk_action');
    return false;
  }
};
const initializeClient = (loadedClient: PostHogClient): void => {
  const configuration = requestedConfiguration;
  if (configuration === null || initializedConfiguration === configuration.key) return;
  loadedClient.init(
    configuration.projectToken,
    getPostHogOptions(configuration.host, () => sessionContext),
  );
  initializedConfiguration = configuration.key;
};
const flushActions = (loadedClient: PostHogClient): void => {
  const actions = pendingActions;
  pendingActions = [];
  actions.forEach((action) => executeAction(action, loadedClient));
};
const loadClient = (): void => {
  if (loadPromise !== null) return;
  status = 'loading';
  const currentGeneration = generation;
  loadPromise = import('posthog-js')
    .then(({ default: loadedClient }) => {
      if (currentGeneration !== generation || requestedConfiguration === null) return;
      initializeClient(loadedClient);
      client = loadedClient;
      status = 'ready';
      flushActions(loadedClient);
    })
    .catch(() => {
      if (currentGeneration !== generation) return;
      status = 'failed';
      diagnoseFailure('sdk_load');
      // 일시적인 로딩 실패 후에도 큐를 보존하고 다음 수집 요청에서 다시 시도한다.
    })
    .finally(() => {
      if (currentGeneration === generation) loadPromise = null;
    });
};
export const initPostHog = (projectToken: string, host: string): boolean => {
  const normalizedToken = projectToken.trim();
  const normalizedHost = host.trim().replace(/\/$/, '');
  if (!isValidPostHogConfiguration(normalizedToken, normalizedHost)) {
    requestedConfiguration = null;
    pendingActions = [];
    status = 'disabled';
    resetTrackingState();
    return false;
  }
  const key = `${normalizedHost}:${normalizedToken}`;
  if (requestedConfiguration?.key !== key) {
    pendingActions = [];
    resetTrackingState();
  }
  requestedConfiguration = { key, projectToken: normalizedToken, host: normalizedHost };
  if (client === null) {
    loadClient();
    return true;
  }
  try {
    initializeClient(client);
    flushActions(client);
    status = 'ready';
    return true;
  } catch {
    client = null;
    initializedConfiguration = null;
    status = 'failed';
    diagnoseFailure('sdk_load');
    return false;
  }
};
export const runPostHogAction = (action: PostHogAction): boolean => {
  if (requestedConfiguration === null) return false;
  if (client !== null && initializedConfiguration === requestedConfiguration.key) return executeAction(action, client);
  if (pendingActions.length >= MAX_PENDING_ACTIONS) {
    droppedActions += 1;
    diagnoseFailure('queue_full');
    return false;
  }
  pendingActions.push(action);
  loadClient();
  return true;
};
export const resetPostHogClientForTests = (): void => {
  generation += 1;
  requestedConfiguration = null;
  initializedConfiguration = null;
  client = null;
  loadPromise = null;
  pendingActions = [];
  status = 'disabled';
  failedActions = 0;
  droppedActions = 0;
  resetTrackingState();
};

export const setPostHogSessionContext = (context: PostHogSessionContext): boolean => {
  if (context.app_version.trim().length === 0) return false;
  sessionContext = { ...context };
  return runPostHogAction((loadedClient) => loadedClient.register(context));
};
export const identifyPostHogMember = (memberId: number, nickname?: string): boolean => {
  if (!Number.isInteger(memberId) || memberId <= 0) return false;
  const distinctId = `member-${memberId}`;
  const identityKey = JSON.stringify([distinctId, nickname]);
  return runPostHogAction((loadedClient) => {
    if (identifiedMember === identityKey) return;
    loadedClient.identify(distinctId, nickname === undefined ? undefined : { name: nickname, nickname });
    identifiedMember = identityKey;
  });
};
export const resetPostHogIdentity = (): void => {
  runPostHogAction((loadedClient) => {
    if (identifiedMember === null && !loadedClient.get_property('$user_id')) return;
    loadedClient.reset();
    identifiedMember = null;
    if (sessionContext !== null) loadedClient.register(sessionContext);
  });
};
export const trackPostHogEvent = (eventName: string, properties?: Record<string, unknown>): boolean =>
  runPostHogAction((loadedClient) => loadedClient.capture(eventName, { ...properties, ...sessionContext }));
export const trackPostHogPageView = (path: string): boolean => {
  if (lastTrackedPath === path) return false;
  const accepted = trackPostHogEvent('$pageview', { path });
  if (accepted) lastTrackedPath = path;
  return accepted;
};
