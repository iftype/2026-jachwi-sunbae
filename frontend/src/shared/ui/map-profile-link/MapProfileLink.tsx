import { css } from '@emotion/css';
import { Link } from 'react-router-dom';

import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import { isRunningInNativeApp } from '@/shared/lib/native-app/nativeApp';
import { MY_PATH } from '@/shared/lib/navigation/appPaths';
import IdentityPlaceholder from '@/shared/ui/identity-placeholder/IdentityPlaceholder';

type Props = { className?: string };

/** 지도 머리 오른쪽 위 마이 진입. 앱은 하단 탭에 마이가 있어 휴대폰 화면에서는 두지 않는다. */
const MapProfileLink = ({ className }: Props) => {
  const isDesktop = useIsDesktop();
  if (isRunningInNativeApp() && !isDesktop) return null;
  return (
    <Link to={MY_PATH} aria-label="마이페이지" className={`${styles.profile} ${className ?? ''}`.trim()}>
      <IdentityPlaceholder size={36} />
    </Link>
  );
};

const styles = {
  profile: css`
    label: MapProfileLink-profile;
    display: grid;
    place-items: center;
    flex: none;
    width: 2.25rem;
    height: 2.25rem;
    border: 0;
    border-radius: 50%;
    background: var(--color-surface);
    box-shadow: var(--shadow-floating);
    overflow: hidden;
    & img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 3px;
    }
  `,
};
export default MapProfileLink;
