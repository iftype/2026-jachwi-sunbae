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
      <DetailHeader title="마이페이지" backLabel="목록으로 돌아가기" onBack={onClose} hasBackButton={false} />
      <MyPageContent />
      <HomeFooter className={styles.siteFooter} />
      <footer className={`${myStyles.footer} ${styles.version}`}>{formatAppVersionLabel(config)}</footer>
    </section>
  );
};
const MyMapPanel = ({ onClose }: { onClose: () => void }) => (
  <Suspense fallback={<AreaSkeleton area="list" label="마이페이지를 불러오는 중이에요." />}>
    <MyMapPanelContent onClose={onClose} />
  </Suspense>
);
/* 제목줄, 본문, 푸터가 모두 --my-gutter 한 값으로 좌우 끝을 맞춘다. 자식은 가로 여백을 따로 주지 않는다. */
const styles = {
  siteFooter: css`
    label: MyMapPanel-siteFooter;
    padding-inline: 0;
    [data-desktop='false'] & {
      flex: none;
      margin-top: 0;
      gap: 0.25rem;
      padding-top: 0.5rem;
      padding-bottom: 0.5rem;
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
      padding: 0.25rem 0 calc(env(safe-area-inset-bottom) + 0.5rem);
      background: var(--color-surface);
    }
  `,
  panel: css`
    label: MyMapPanel-panel;
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    gap: 1rem;
    padding: 0.5rem var(--my-gutter) 1rem;
    & > header {
      padding: 0;
    }
    [data-desktop='false'] & {
      height: 100%;
      min-height: 0;
      overflow: hidden;
      padding: 0 var(--my-gutter);
      gap: 0;
      & > header {
        flex: none;
        padding: 0.75rem 0;
        background: var(--color-surface);
      }
    }
  `,
};
export default MyMapPanel;
