export type RouteKind = 'reachable' | 'exception' | 'known-unreachable' | 'unreachable' | 'redirect';

export type ClassifiedRoute = {
  path: string;
  symbol: string;
  isRedirect: boolean;
  kind: RouteKind;
  reason?: string;
  symbols?: string[];
  links: string[];
};

export const linkSymbols: Record<string, string[]>;
export const entryExceptions: Record<string, string>;
export const knownUnreachable: Record<string, string>;
export const classifyRoutes: () => Promise<ClassifiedRoute[]>;
export const findReachableRoute: (routes: ClassifiedRoute[], url: string) => ClassifiedRoute | undefined;
