export type ChangedFiles = { runtime: string[]; config: string[]; ignored: string[] };

export type VisualScope = {
  runs: boolean;
  scope: 'none' | 'all' | 'routes';
  why: string;
  changed: string[];
  runtime?: string[];
  config?: string[];
  ignored: string[];
  routes: string[];
};

export const VERDICTS: string[];
export const isNonRuntimeSource: (file: string) => boolean;
export const classifyChangedFiles: (
  files: string[],
  options?: { packageDependenciesChanged?: boolean },
) => ChangedFiles;
export const findVisualScope: (
  changed: string[],
  options?: { packageDependenciesChanged?: boolean },
) => Promise<VisualScope>;
export const changedFilesSince: (base: string) => { mergeBase: string; changed: string[] };
export const checkVerdict: (input: { title: string; verdict: string }) => string[];
export const renderVerdictTemplate: (scope: VisualScope) => string;
