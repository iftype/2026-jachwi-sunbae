import { css } from '@emotion/css';
import { Suspense } from 'react';

import HomeFooter from '@/pages/design-home/ui/HomeFooter';
import { formatAppVersionLabel } from '@/pages/my/lib/appVersionLabel';
import MyPageContent from '@/pages/my/ui/MyPageContent';
import { useMember } from '@/features/auth/api/useCurrentMember';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import AreaSkeleton from '@/shared/ui/area-skeleton/AreaSkeleton';
import DetailHeader from '@/shared/ui/detail-header/DetailHeader';

import * as myStyles from '@/pages/my/MyPage.styles';

const MyMapPanelContent = ({ onClose }: { onClose: () => void }) => {
  useMember();
  const config = usePublicConfig();
  return (
    <section className={`${myStyles.page} ${styles.panel}`} aria-label="목록 안의 마이페이지">
      <DetailHeader title="마이" backLabel="목록으로 돌아가기" onBack={onClose} />
      <MyPageContent />
      <HomeFooter className={styles.siteFooter} />
      <footer className={`${myStyles.footer} ${styles.version}`}>{formatAppVersionLabel(config)}</footer>
    </section>
  );
};
const MyMapPanel = ({ onClose }: { onClose: () => void }) => (
  <Suspense fallback={<AreaSkeleton area="list" label="마이를 불러오는 중이에요." />}>
    <MyMapPanelContent onClose={onClose} />
  </Suspense>
);
const styles = {
  siteFooter: css`
    label: MyMapPanel-siteFooter;
    [data-desktop='false'] & {
      flex: none;
      margin-top: 0;
      gap: 0.25rem;
      padding: 0.5rem 1rem;
      border: 0;
      background: var(--color-surface);
      & p {
        display: none;
      }
    }
  `,
  version: css`
    label: MyMapPanel-version;
    [data-desktop='false'] & {
      flex: none;
      padding: 0.25rem 1rem calc(env(safe-area-inset-bottom) + 0.5rem);
      background: var(--color-surface);
    }
  `,
  panel: css`
    label: MyMapPanel-panel;
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    gap: 0.75rem;
    padding: 0.5rem 1rem 1rem;
    & nav[aria-label='내 도구'] {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    [data-desktop='false'] & {
      height: 100%;
      min-height: 0;
      overflow: hidden;
      padding: 0;
      gap: 0;
      & > header {
        flex: none;
        padding: 0.75rem 1rem;
        background: var(--color-surface);
      }
    }
  `,
};
export default MyMapPanel;
