import { css } from '@emotion/css';
import { Link } from 'react-router-dom';

import { CHEAP_MEALS_PATH, CHECKLISTS_PATH, GUIDE_PATH } from '@/shared/lib/navigation/appPaths';
import Icon from '@/shared/ui/icon/Icon';

const links = [
  { to: CHECKLISTS_PATH, title: '내 체크리스트 관리', description: '방을 볼 때 쓸 항목을 만들고 수정해요.' },
  { to: CHEAP_MEALS_PATH, title: '저렴한 한 끼', description: '주변 식당·편의점·배달 할인 보기' },
  { to: GUIDE_PATH, title: '사용방법 알아보기', description: '자취선배의 방 기록 방법을 확인해요.' },
] as const;

const MyQuickLinks = () => (
  <nav className={styles.links} aria-label="내 도구">
    {links.map(({ to, title, description }) => (
      <Link key={to} to={to}>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <Icon name="chevron-right" size={16} />
      </Link>
    ))}
  </nav>
);

const styles = {
  links: css`
    overflow: hidden;
    padding-inline: var(--my-card-padding);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);

    & a {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      min-height: 2.75rem;
      padding-block: 0.35rem;
      color: var(--color-ink);
      text-decoration: none;
    }

    & a + a {
      border-top: 1px solid var(--color-border);
    }
    & a:hover strong {
      text-decoration: underline;
    }

    & a:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: -2px;
    }

    & strong,
    & small {
      display: block;
    }
    & strong {
      font-size: var(--my-text-size);
    }

    & small {
      color: var(--color-ink-soft);
      font-size: var(--my-subtext-size);
    }
  `,
};

export default MyQuickLinks;
