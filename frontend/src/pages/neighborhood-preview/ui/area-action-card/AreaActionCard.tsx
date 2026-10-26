import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import Icon from '@/shared/ui/icon/Icon';

import styles from './AreaActionCard.module.css';

type AreaActionCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  /** 외부 주소는 새 탭으로, 서비스 안 경로는 라우터로 연다. */
  link: { href: string } | { to: string };
  className?: string;
  onOpen?: () => void;
};

/** 동네 하나에 대한 다음 행동을 아이콘·제목·설명 카드로 보여준다. */
const AreaActionCard = ({ icon, title, description, link, className, onOpen }: AreaActionCardProps) => {
  const cardClassName = [styles.card, className].filter(Boolean).join(' ');
  const content = (
    <>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.text}>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className={styles.trailing} aria-hidden="true">
        <Icon name={'href' in link ? 'external-link' : 'chevron-right'} size={20} />
      </span>
    </>
  );
  return 'href' in link ? (
    <a className={cardClassName} href={link.href} target="_blank" rel="noopener noreferrer" onClick={onOpen}>
      {content}
    </a>
  ) : (
    <Link className={cardClassName} to={link.to} onClick={onOpen}>
      {content}
    </Link>
  );
};

export default AreaActionCard;
