const isChunkLoadError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  if ('name' in error && error.name === 'ChunkLoadError') return true;
  if ('type' in error && error.type === 'ChunkLoadError') return true;
  const message = 'message' in error ? error.message : 'value' in error ? error.value : undefined;
  return typeof message === 'string' && /^Loading (?:CSS )?chunk \S+ failed\b/.test(message);
};
export const classifyPostHogException = (
  error: unknown,
  properties: Record<string, unknown> = {},
): Record<string, unknown> => {
  const exceptionList: unknown = properties.$exception_list;
  const isChunkFailure =
    isChunkLoadError(error) || (Array.isArray(exceptionList) && exceptionList.some(isChunkLoadError));
  return {
    ...properties,
    error_category: isChunkFailure ? 'chunk_load' : (properties.error_category ?? 'uncaught'),
    severity: isChunkFailure ? 'P2' : (properties.severity ?? 'P0'),
  };
};
