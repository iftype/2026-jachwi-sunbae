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

export type VerdictSection = { result?: string; routes?: string; evidence?: string; text: string };

export const VERDICT_HEADING: string;
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
export const readVerdictSection: (body: string | null | undefined) => VerdictSection | undefined;
export const checkPrBody: (input: { scope: VisualScope; title: string; body: string }) => string[];
export const renderVerdictTemplate: (scope: VisualScope) => string;
