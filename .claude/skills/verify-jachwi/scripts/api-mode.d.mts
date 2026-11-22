export const DEV_API_ENV: string;
export const resolveApiMode: (requested?: string, env?: Record<string, string | undefined>) => 'mock' | 'dev';
