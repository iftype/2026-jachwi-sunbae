import type { ErrorInfo, ReactNode } from 'react';
import { Component, Suspense } from 'react';

import { capturePostHogException, trackPostHogEvent } from '@/shared/lib/analytics/posthog';
import ContentState from '@/shared/ui/content-state/ContentState';

import RouteLoading from './RouteLoading';

class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    capturePostHogException(error, {
      boundary: 'lazy_route',
      component_stack: info.componentStack,
      error_category: 'render',
      severity: 'P0',
    });
    trackPostHogEvent('error_state_viewed', { screen: 'lazy_route_boundary', error_kind: 'render' });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ContentState
          tone="error"
          title="화면을 불러오지 못했어요."
          description="새 배포로 화면 파일이 바뀌었을 수 있어요."
          retryLabel="새로고침해 다시 시도"
          onRetry={() => {
            trackPostHogEvent('error_retry_clicked', { screen: 'lazy_route_boundary' });
            window.location.reload();
          }}
        />
      );
    }

    return this.props.children;
  }
}

const LazyRouteBoundary = ({
  children,
  fallback = <RouteLoading />,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) => (
  <RouteErrorBoundary>
    <Suspense fallback={fallback}>{children}</Suspense>
  </RouteErrorBoundary>
);

export default LazyRouteBoundary;
