import { Link } from 'react-router-dom';

import Icon from '@/shared/ui/icon/Icon';

import styles from '../my-row-card/MyRowCard.module.css';

/** 개인정보 처리방침으로 가는 카드. 계정 삭제 요청 카드와 같은 모양을 쓴다. */
const PrivacyLinkCard = () => (
  <Link className={styles.notice} to="/privacy">
    <span className={styles.noticeIcon}>
      <Icon name="info" size={16} />
    </span>
    <span>
      <strong>개인정보 처리방침</strong>
      <small>수집하는 정보와 이용 목적을 확인해요.</small>
    </span>
    <Icon name="arrow-right" size={15} />
  </Link>
);

export default PrivacyLinkCard;
