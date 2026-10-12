import { classifyPostHogException } from './errorClassification';
import { runPostHogAction } from './runtime';
export const capturePostHogException = (error: unknown, properties?: Record<string, unknown>): boolean =>
  runPostHogAction((client) => client.captureException(error, classifyPostHogException(error, properties)));
