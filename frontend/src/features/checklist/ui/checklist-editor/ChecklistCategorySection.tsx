import { css } from '@emotion/css';
import { type ReactNode, useId } from 'react';

import Icon from '@/shared/ui/icon/Icon';

import type { checklistCategories } from '../../lib/checklistCategories';

type Props = {
  category: (typeof checklistCategories)[number];
  children: ReactNode;
};

const ChecklistCategorySection = ({ category, children }: Props) => {
  const id = useId();
  return (
    <section className={styles.group} aria-labelledby={id}>
      <h3 id={id}>
        <Icon name={category.icon} size={18} />
        {category.name}
      </h3>
      {children}
    </section>
  );
};

const styles = {
  group: css`
    label: ChecklistCategorySection-group;
    padding: var(--space-lg) 0;
    & + & {
      border-top: 1px solid var(--color-border);
    }
    & h3 {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      margin: 0 0 var(--space-md);
      color: var(--color-ink);
      font-size: 0.9375rem;
      font-weight: 700;
    }
  `,
};

export default ChecklistCategorySection;
