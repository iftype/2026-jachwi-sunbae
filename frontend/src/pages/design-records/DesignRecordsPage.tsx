import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

import RecordsDesktopPage from './desktop/RecordsDesktopPage';
import RecordsMobilePage from './mobile/RecordsMobilePage';

/** 본 방 기록(`/properties`). 데스크탑·휴대폰 화면을 여기서 한 번만 고르고, 데이터·조각은 두 화면이 함께 쓴다. */
const DesignRecordsPage = () => (useIsDesktop() ? <RecordsDesktopPage /> : <RecordsMobilePage />);

export default DesignRecordsPage;
