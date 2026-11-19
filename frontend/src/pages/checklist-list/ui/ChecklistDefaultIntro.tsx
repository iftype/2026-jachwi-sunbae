import { css } from '@emotion/css';
import { useState } from 'react';

import { useChecklistPreset } from '@/features/checklist/api/useChecklists';
import { groupChecklistItems } from '@/features/checklist/lib/checklistCategories';
import { USER_CHECKLIST_STAGE } from '@/features/checklist/model/checklist';
import Icon from '@/shared/ui/icon/Icon';
import StateIllustration from '@/shared/ui/state-illustration/StateIllustration';

/**
 * 체크리스트 관리 데스크탑 화면에서 내 체크리스트 목록 아래에 두는 안내.
 * 고르지 않으면 서비스의 기본 체크리스트가 쓰인다는 그림과 문구, 카테고리(보안, 창문, 채광 등) 버튼을 세로로 둔다.
 * 버튼을 누르면 그 카테고리의 기본 항목이 버튼 아래에 펼쳐진다.
 */
const ChecklistDefaultIntro = () => {
  const preset = useChecklistPreset(USER_CHECKLIST_STAGE, 'ONE_ROOM', true);
  const groups = groupChecklistItems(preset.data?.items ?? []);
  // 펼친 카테고리. 하나를 누르면 그 항목이 열리고, 다시 누르면 닫힌다.
  const [openCode, setOpenCode] = useState<string | null>(null);

  return (
    <section className={styles.root} aria-label="기본 체크리스트 안내">
      <header className={styles.header}>
        <StateIllustration name="empty-properties" size={5} />
        <h2>기본 체크리스트</h2>
        <p>내 체크리스트를 고르기 전에는 아래 항목으로 방을 확인해요.</p>
      </header>
      {groups.length > 0 && (
        <ul className={styles.categories} aria-label="기본 체크리스트 항목">
          {groups.map((group) => {
            const isOpen = openCode === group.code;
            return (
              <li key={group.code} className={styles.category} data-open={isOpen || undefined}>
                <button type="button" aria-expanded={isOpen} onClick={() => setOpenCode(isOpen ? null : group.code)}>
                  <span className={styles.icon} aria-hidden="true">
                    <Icon name={group.icon} size={18} />
                  </span>
                  <span className={styles.name}>{group.name}</span>
                  <span className={styles.count}>{group.items.length}개</span>
                  <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} />
                </button>
                {isOpen && (
                  <ol>
                    {group.items.map((item) => (
                      <li key={item.checkItemId}>
                        <strong>{item.question}</strong>
                        {item.guide !== null && item.guide !== '' && <small>{item.guide}</small>}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const styles = {
  root: css`
    label: ChecklistDefaultIntro-root;
    display: grid;
    gap: 1rem;
    padding: 1.5rem 0.5rem 0;
  `,

  header: css`
    label: ChecklistDefaultIntro-header;
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    text-align: center;

    & h2 {
      margin: 0.3rem 0 0;
      font-size: 1.05rem;
    }

    & p {
      max-width: 26rem;
      margin: 0;
      color: var(--color-muted);
      font-size: 0.82rem;
      line-height: 1.6;
    }
  `,

  /* 카테고리 버튼을 세로로 쌓는다. 누르면 그 아래로 기본 항목이 펼쳐진다. */
  categories: css`
    label: ChecklistDefaultIntro-categories;
    display: grid;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  `,

  category: css`
    label: ChecklistDefaultIntro-category;
    border-bottom: 1px solid var(--color-border);

    & > button {
      display: flex;
      width: 100%;
      align-items: center;
      gap: 0.6rem;
      padding: 0.85rem 1rem;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--color-ink);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    & > button:hover {
      background: var(--color-card-surface);
    }

    & > button:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }

    & ol {
      display: grid;
      gap: 0.7rem;
      margin: 0;
      padding: 0 1rem 1rem;
      list-style: none;
    }

    & ol > li {
      display: grid;
      gap: 0.2rem;
    }

    & strong {
      font-size: 0.82rem;
      font-weight: 400;
      line-height: 1.5;
      word-break: keep-all;
    }

    & small {
      color: var(--color-muted);
      font-size: 0.72rem;
      line-height: 1.5;
    }
  `,

  name: css`
    label: ChecklistDefaultIntro-name;
    flex: 1;
    font-size: 0.9rem;
    font-weight: 700;
  `,

  count: css`
    label: ChecklistDefaultIntro-count;
    color: var(--color-muted);
    font-size: 0.75rem;
  `,

  /* 카테고리 이름 옆 아이콘은 우리 파랑으로 둔다. */
  icon: css`
    label: ChecklistDefaultIntro-icon;
    display: inline-flex;
    color: var(--color-brand-blue-ink);
  `,
};

export default ChecklistDefaultIntro;
