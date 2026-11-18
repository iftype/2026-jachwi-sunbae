import { css } from '@emotion/css';

import Icon from '@/shared/ui/icon/Icon';

type Props = {
  /** 섹션 이름. `기본 정보`처럼 쓰고, 버튼 이름은 `기본 정보 수정`, `기본 정보 수정 끝내기`가 된다. */
  section: string;
  isEditing: boolean;
  onToggle: () => void;
};

/** 섹션 헤더의 연필 버튼. 누르면 그 섹션의 줄을 상세 화면 안에서 고칠 수 있고, 다시 누르면 수정을 끝낸다. */
const PropertyEditToggle = ({ section, isEditing, onToggle }: Props) => (
  <button
    className={styles.button}
    type="button"
    aria-pressed={isEditing}
    aria-label={isEditing ? `${section} 수정 끝내기` : `${section} 수정`}
    onClick={onToggle}
  >
    <Icon name={isEditing ? 'close' : 'edit'} size={18} />
  </button>
);

const styles = {
  button: css`
    label: PropertyEditToggle-button;
    display: grid;
    width: 2.25rem;
    height: 2.25rem;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;

    &[aria-pressed='true'] {
      color: var(--color-brand-blue-ink);
      background: var(--color-card-surface);
    }
  `,
};

export default PropertyEditToggle;
