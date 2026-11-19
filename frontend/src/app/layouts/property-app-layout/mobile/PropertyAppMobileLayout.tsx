import { Outlet } from 'react-router-dom';

import { HOME_PATH } from '@/shared/lib/navigation/appPaths';
import AppBar from '@/shared/ui/app-bar/AppBar';
import MobileBottomTabs from '@/shared/ui/bottom-tab-bar/MobileBottomTabs';

import type { AppShellState } from '../appShell';
import { appShellAttributes } from '../appShell';

import * as shared from '../PropertyAppLayout.styles';

type Props = {
  shell: AppShellState;
  /** 상단 바를 숨기는 화면(방 비교·지도)인지 */
  hidesAppBar: boolean;
  appBarTitle?: string;
};

/** 휴대폰과 태블릿 앱 셸. 홈으로 돌아가는 상단 바와, 체크리스트와 방 비교 화면에 보이는 하단 탭을 둔다. */
const PropertyAppMobileLayout = ({ shell, hidesAppBar, appBarTitle }: Props) => (
  <div className={shared.root} {...appShellAttributes(shell)}>
    {!shell.fullScreen && !hidesAppBar && <AppBar title={appBarTitle} backTo={HOME_PATH} backLabel="홈으로 돌아가기" />}
    <div className={shared.content}>
      <Outlet />
    </div>
    <MobileBottomTabs />
  </div>
);

export default PropertyAppMobileLayout;
