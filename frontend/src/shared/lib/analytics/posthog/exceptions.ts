import { classifyPostHogException } from './errorClassification';
import { getPostHogEventProperties, runPostHogAction } from './runtime';
export const capturePostHogException = (error: unknown, properties?: Record<string, unknown>): boolean => {
  const eventProperties = getPostHogEventProperties(classifyPostHogException(error, properties));
  return runPostHogAction((client) => client.captureException(error, eventProperties));
};
