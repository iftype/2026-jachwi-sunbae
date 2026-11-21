import { css } from '@emotion/css';
import { type KeyboardEvent, useRef, useState } from 'react';

import { useUpdateProperty } from '@/features/property/api/usePropertyMutations';
import { DEFAULT_PROPERTY_NAME } from '@/features/property/lib/propertyForm';
import type { PropertyDetail } from '@/features/property/model/Property';

const MAX_NAME_LENGTH = 30;

type Props = {
  property: PropertyDetail;
  /** 저장했거나 취소해 입력을 닫을 때 부른다. */
  onDone: () => void;
};

/**
 * 상세 기본 정보의 매물 이름을 그 줄 안에서 바로 고친다.
 * 엔터나 다른 곳을 누르면 저장하고, Esc는 고치지 않고 닫는다. 비우면 원래 이름으로 되돌린다.
 */
const PropertyNameInput = ({ property, onDone }: Props) => {
  const updateProperty = useUpdateProperty(property.propertyId);
  const [name, setName] = useState(property.name === DEFAULT_PROPERTY_NAME ? '' : property.name);
  // 엔터로 저장한 뒤 따라오는 blur, Esc로 닫을 때의 blur에서 다시 저장하지 않는다.
  const settledRef = useRef(false);

  const save = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    const next = name.trim();
    if (next === '' || next === property.name) {
      onDone();
      return;
    }
    updateProperty
      .mutateAsync({ current: property, changes: { name: next } })
      .then(onDone)
      .catch(() => {
        // 실패하면 입력을 열어 둔 채 다시 저장할 수 있게 한다.
        settledRef.current = false;
      });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합을 끝내는 엔터는 저장으로 보지 않는다.
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      save();
    } else if (event.key === 'Escape') {
      settledRef.current = true;
      onDone();
    }
  };

  return (
    <span className={styles.wrap}>
      <input
        className={styles.input}
        aria-label="매물 이름"
        placeholder="매물 이름"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        autoFocus
        readOnly={updateProperty.isPending}
        enterKeyHint="done"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={save}
      />
      {updateProperty.isError && (
        <span className={styles.error} role="alert">
          이름을 저장하지 못했어요. 다시 시도해 주세요.
        </span>
      )}
    </span>
  );
};

const styles = {
  wrap: css`
    label: PropertyNameInput-wrap;
    display: grid;
    gap: 0.3rem;
  `,

  /* 수정 중인 칸임이 보이도록 흰 바탕에 옅은 테두리를 두고, 포커스하면 테두리를 파랑으로 바꾼다. 섹션 바탕(회색)과 구분된다. */
  input: css`
    label: PropertyNameInput-input;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    /* 안쪽 여백만큼 바깥을 당겨, 칸이 열려도 줄 높이는 글자 한 줄 그대로다. */
    margin-block: calc(-0.3rem - 1px);
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--color-border, #e3e5e9);
    border-radius: 0.6rem;
    background: #fff;
    color: var(--color-ink, #212124);
    font: inherit;
    text-align: right;
    outline: none;
    &::placeholder {
      color: #8b909a;
    }
    /* 전역 포커스 링(검은 테두리)보다 우선해서 파란 테두리만 둔다. */
    &:focus,
    &:focus-visible {
      outline: 0;
      border-color: var(--color-brand-blue-ink, #3f6fc4);
    }
  `,

  error: css`
    label: PropertyNameInput-error;
    color: var(--color-error, #e53e3e);
    font-size: 0.75rem;
  `,
};

export default PropertyNameInput;
