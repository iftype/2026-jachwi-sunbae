export type MetricComparison = {
  before: number[];
  after: number[];
  missingBefore: number;
  missingAfter: number;
  beforeMedian?: number;
  afterMedian?: number;
  diff?: number;
  spread?: number;
  threshold?: number;
  verdict: string;
};

export const JITTER_VERDICT: string;
export const compareMetric: (
  beforeValues: (number | null)[],
  afterValues: (number | null)[],
  options?: { spreadFactor?: number; minDiff?: number; maxSpread?: number },
) => MetricComparison;
