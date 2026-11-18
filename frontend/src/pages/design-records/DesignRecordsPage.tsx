import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

import RecordsDesktopPage from './desktop/RecordsDesktopPage';
import RecordsMobilePage from './mobile/RecordsMobilePage';
import { RecordsMapProvider, useRecordsMapController } from './RecordsMapProvider';

const Content = () => {
  const controller = useRecordsMapController();
  const isDesktop = useIsDesktop();
  if (!controller) return null;
  return isDesktop ? <RecordsDesktopPage {...controller} /> : <RecordsMobilePage {...controller} />;
};
const DesignRecordsPage = () =>
  useRecordsMapController() ? (
    <Content />
  ) : (
    <RecordsMapProvider>
      <Content />
    </RecordsMapProvider>
  );
export default DesignRecordsPage;
