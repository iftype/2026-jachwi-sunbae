import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useCurrentMember } from '@/features/auth/api/useCurrentMember';
import { useAuthentication } from '@/features/auth/model/useAuthentication';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import {
  getPostHogPlatform,
  identifyPostHogMember,
  initPostHog,
  resetPostHogIdentity,
  setPostHogSessionContext,
  trackPostHogPageView,
} from '@/shared/lib/analytics/posthog';

const PostHogTracker = () => {
  const config = usePublicConfig();
  const location = useLocation();
  const { session } = useAuthentication();
  const currentMember = useCurrentMember(session !== null);

  useLayoutEffect(() => {
    initPostHog(config.posthogProjectToken ?? '', config.posthogHost ?? '');
  }, [config.posthogProjectToken, config.posthogHost]);

  useLayoutEffect(() => {
    setPostHogSessionContext({
      environment: config.appEnvironment ?? 'production',
      app_version: config.appVersion ?? 'unknown',
      platform: getPostHogPlatform(),
    });
  }, [config.appEnvironment, config.appVersion, config.posthogProjectToken, config.posthogHost]);

  useEffect(() => {
    trackPostHogPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search, config.posthogProjectToken, config.posthogHost]);

  useLayoutEffect(() => {
    if (session === null) {
      resetPostHogIdentity();
      return;
    }

    if (currentMember.data !== undefined) {
      identifyPostHogMember(currentMember.data.memberId, currentMember.data.displayName);
    }
  }, [session, currentMember.data, config.posthogProjectToken, config.posthogHost]);

  return null;
};

export default PostHogTracker;
