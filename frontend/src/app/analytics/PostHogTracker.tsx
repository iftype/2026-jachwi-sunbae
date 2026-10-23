import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useCurrentMember } from '@/features/auth/api/useCurrentMember';
import { getAuthenticationSnapshot } from '@/features/auth/model/authStore';
import { useAuthentication } from '@/features/auth/model/useAuthentication';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import { getAnalyticsDeviceContext } from '@/shared/lib/analytics/deviceContext';
import {
  identifyPostHogMember,
  initPostHog,
  resetPostHogIdentity,
  setPostHogAuthenticationReader,
  setPostHogSessionContext,
  trackPostHogPageView,
} from '@/shared/lib/analytics/posthog';

const PostHogTracker = () => {
  const config = usePublicConfig();
  const location = useLocation();
  const { session, terminationReason } = useAuthentication();
  const currentMember = useCurrentMember(session !== null);

  useLayoutEffect(() => {
    setPostHogAuthenticationReader(() =>
      getAuthenticationSnapshot().session === null ? 'anonymous' : 'authenticated',
    );
    initPostHog(config.posthogProjectToken ?? '', config.posthogHost ?? '');
  }, [config.posthogProjectToken, config.posthogHost]);

  useLayoutEffect(() => {
    const updateContext = () =>
      setPostHogSessionContext({
        environment: config.appEnvironment ?? 'production',
        app_version: config.appVersion ?? 'unknown',
        ...getAnalyticsDeviceContext(),
      });
    updateContext();
    window.addEventListener('jachwi-native-ready', updateContext);
    return () => window.removeEventListener('jachwi-native-ready', updateContext);
  }, [config.appEnvironment, config.appVersion, config.posthogProjectToken, config.posthogHost]);

  useEffect(() => {
    trackPostHogPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search, config.posthogProjectToken, config.posthogHost]);

  useLayoutEffect(() => {
    // 토큰은 메모리에만 있어 새로고침 직후에는 늘 세션이 없다. 서버가 복원을 거절해 인증이 끝났을 때만 식별을 지운다.
    if (session === null) {
      if (terminationReason !== null) resetPostHogIdentity();
      return;
    }

    if (currentMember.data !== undefined) {
      identifyPostHogMember(currentMember.data.memberId);
    }
  }, [session, terminationReason, currentMember.data, config.posthogProjectToken, config.posthogHost]);

  return null;
};

export default PostHogTracker;
