import { css } from '@emotion/css';

import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

import ChecklistDefaultIntro from './ui/ChecklistDefaultIntro';
import ChecklistManagement from './ui/ChecklistManagement';

/**
 * 체크리스트 관리 첫 화면. 데스크탑은 통합 지도의 왼쪽 칸 안에서 내 체크리스트 목록 아래에 기본 체크리스트 안내를 둔다.
 * 만들기와 편집은 같은 칸 안에서 이 화면을 대신한다(`ChecklistsRoute`의 `Outlet`).
 */
const ChecklistListPage = () =>
  useIsDesktop() ? (
    <div className={styles.column}>
      <ChecklistManagement />
      <ChecklistDefaultIntro />
    </div>
  ) : (
    <ChecklistManagement />
  );

const styles = {
  column: css`
    label: ChecklistListPage-column;
    display: grid;
    gap: 0.5rem;
    padding-bottom: 2rem;
  `,
};

export default ChecklistListPage;
