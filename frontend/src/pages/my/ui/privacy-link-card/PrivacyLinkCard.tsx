import { Link } from 'react-router-dom';

import { PRIVACY_PATH } from '@/shared/lib/navigation/appPaths';
import Icon from '@/shared/ui/icon/Icon';

import * as styles from '../my-row-card/MyRowCard.styles';

/** 개인정보 처리방침으로 가는 카드. 회원 탈퇴 카드와 같은 모양을 쓴다. */
const PrivacyLinkCard = () => (
  <Link className={styles.notice} to={PRIVACY_PATH}>
    <span>
      <strong>개인정보 처리방침</strong>
    </span>
    <Icon name="chevron-right" size={16} />
  </Link>
);

export default PrivacyLinkCard;
