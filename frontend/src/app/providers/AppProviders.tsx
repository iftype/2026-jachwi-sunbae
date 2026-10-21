import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { UNSAFE_createBrowserHistory, unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';

import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';
import { PUBLIC_PATH } from '@/shared/config/publicPath';
import { createGuardedHistory } from '@/shared/lib/navigation/guardedHistory';

type AppProvidersProps = {
  config: PublicConfig;
  children: ReactNode;
};

let browserHistory: ReturnType<typeof createGuardedHistory> | null = null;

const getBrowserHistory = () => {
  browserHistory ??= createGuardedHistory(UNSAFE_createBrowserHistory({ v5Compat: true }));
  return browserHistory;
};

const AppProviders = ({ config, children }: AppProvidersProps) => {
  const history = getBrowserHistory();

  return (
    <PublicConfigProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <HistoryRouter history={history} basename={PUBLIC_PATH}>{children}</HistoryRouter>
      </QueryClientProvider>
    </PublicConfigProvider>
  );
};

export default AppProviders;
