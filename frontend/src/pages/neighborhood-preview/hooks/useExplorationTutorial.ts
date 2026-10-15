import { useEffect, useRef, useState } from 'react';

import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

type Options = { enabled: boolean; mode: 'commute' | 'price'; hasLocation: boolean; mock: boolean };
const keyFor = (mode: Options['mode']) => `jachwi.exploration-tutorial.v1.${mode}`;
const hasSeen = (mode: Options['mode']) => {
  try {
    return localStorage.getItem(keyFor(mode)) !== null;
  } catch {
    return false;
  }
};

const useExplorationTutorial = ({ enabled, mode, hasLocation, mock }: Options) => {
  const [isDismissed, setDismissed] = useState(() => hasSeen(mode));
  const [hasAppliedFilter, setAppliedFilter] = useState(false);
  const hasTrackedView = useRef(false);
  const isOpen = enabled && !isDismissed;
  const step: 'location' | 'filter' | 'search' = !hasLocation ? 'location' : hasAppliedFilter ? 'search' : 'filter';
  useEffect(() => {
    if (!isOpen || hasTrackedView.current) return;
    hasTrackedView.current = true;
    trackPostHogEvent('exploration_tutorial_viewed', { exploration_mode: mode, mock_data: mock });
  }, [isOpen, mode, mock]);
  const finish = (reason: 'skipped' | 'completed') => {
    if (!isOpen) return;
    setDismissed(true);
    try {
      localStorage.setItem(keyFor(mode), reason);
    } catch {
      /* 현재 방문에서는 닫힌 상태를 유지한다. */
    }
    trackPostHogEvent(`exploration_tutorial_${reason}`, { exploration_mode: mode, mock_data: mock });
  };
  return {
    isOpen,
    step,
    skip: () => finish('skipped'),
    complete: () => finish('completed'),
    applyFilter: () => setAppliedFilter(true),
  };
};
export default useExplorationTutorial;
