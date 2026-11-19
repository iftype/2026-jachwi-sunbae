import { css } from '@emotion/css';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type AreaActionCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  /** 외부 주소는 새 탭으로, 서비스 안 경로는 라우터로 연다. */
  link: { href: string } | { to: string };
  className?: string;
  onOpen?: () => void;
};

/** 동네 하나에 대한 다음 행동을 글(제목과 설명)을 왼쪽에, 작은 아이콘을 오른쪽에 둔 한 줄 카드로 보여준다. */
const AreaActionCard = ({ icon, title, description, link, className, onOpen }: AreaActionCardProps) => {
  const cardClassName = [styles.card, className].filter(Boolean).join(' ');
  const content = (
    <>
      <span className={styles.text}>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className={styles.icon}>{icon}</span>
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

const styles = {
  card: css`
    label: AreaActionCard-card;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.5rem 0.4rem 0.8rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 0.85rem;
    background: var(--color-surface);
    color: var(--color-ink);
    text-decoration: none;

    &:hover {
      background: var(--color-surface-muted);
    }
  `,

  icon: css`
    label: AreaActionCard-icon;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    overflow: hidden;
    border-radius: 0.6rem;
    background: var(--color-surface-muted);
    color: var(--color-primary);

    & img {
      width: 100%;
      height: 100%;
    }
  `,

  text: css`
    label: AreaActionCard-text;
    display: grid;
    flex: 1;
    min-width: 0;
    gap: 0.15rem;
    text-align: left;

    & strong {
      font-size: 0.9rem;
      font-weight: 700;
      line-height: 1.3;
    }

    & small {
      font-size: 0.72rem;
      line-height: 1.3;
      color: var(--color-ink-soft);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
};

export default AreaActionCard;
