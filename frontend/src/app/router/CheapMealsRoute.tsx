import DesktopRailShell from '@/app/layouts/desktop-rail-shell/DesktopRailShell';
import CheapMealsPage from '@/pages/cheap-meals/CheapMealsPage';

/** 저렴한 한 끼 화면을 데스크탑 네비 레일 틀로 감싼다. 첫 화면 번들에 레일 틀이 들어가지 않게 한 청크로 묶어 늦게 읽는다. */
const CheapMealsRoute = () => (
  <DesktopRailShell>
    <CheapMealsPage />
  </DesktopRailShell>
);

export default CheapMealsRoute;
