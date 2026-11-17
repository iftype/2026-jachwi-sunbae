import { css } from '@emotion/css';
import { useEffect, useId, useRef, useState } from 'react';

import useDelayedLoading from '@/shared/lib/hooks/useDelayedLoading';
import { Button } from '@/shared/ui/button/Button';
import TextAreaField from '@/shared/ui/text-field/TextAreaField';

import {
  usePropertyChecklistItemMemoMutation,
  usePropertyChecklistItemStatusMutation,
} from '../../api/usePropertyChecklistItemMutations';
import type { PropertyChecklistItem, PropertyChecklistItemStatus } from '../../model/Property';

const STATUS_OPTIONS = [
  { value: 'GOOD', label: '괜찮음' },
  { value: 'CAUTION', label: '주의' },
] as const;

type PropertyChecklistItemControlProps = {
  readonly propertyId: number;
  readonly propertyChecklistId: number;
  readonly item: PropertyChecklistItem;
};

const PropertyChecklistItemControl = ({ propertyId, propertyChecklistId, item }: PropertyChecklistItemControlProps) => {
  const id = useId();
  const [memo, setMemo] = useState(item.memo);
  const isFocused = useRef(false);
  const statusMutation = usePropertyChecklistItemStatusMutation(propertyId, propertyChecklistId);
  const memoMutation = usePropertyChecklistItemMemoMutation(propertyId, propertyChecklistId);
  const isMemoSavingVisible = useDelayedLoading(memoMutation.isPending);

  useEffect(() => {
    if (!isFocused.current && !memoMutation.isPending && !memoMutation.isError) setMemo(item.memo);
  }, [item.memo, memoMutation.isPending, memoMutation.isError]);

  const saveMemo = () => {
    if (memoMutation.isPending) return;
    const nextMemo = memo.trim();
    if (nextMemo === item.memo) {
      setMemo(item.memo);
      memoMutation.reset();
      return;
    }
    memoMutation.mutate({ itemId: item.itemId, memo: nextMemo });
  };

  const selectStatus = (status: PropertyChecklistItemStatus) => {
    if (statusMutation.isPending) return;
    statusMutation.mutate({ itemId: item.itemId, status: item.status === status ? 'UNCONFIRMED' : status });
  };

  return (
    <li className={styles.item}>
      <div className={styles.row}>
        <div className={styles.question}>
          <strong id={`${id}-question`}>{item.question}</strong>
          <TextAreaField
            label={`${item.question} 메모`}
            variant="inline"
            rows={1}
            maxLength={500}
            placeholder="메모 추가"
            value={memo}
            readOnly={memoMutation.isPending}
            aria-busy={memoMutation.isPending || undefined}
            error={memoMutation.isError ? '메모를 저장하지 못했어요. 다시 저장해 주세요.' : undefined}
            onFocus={() => {
              isFocused.current = true;
            }}
            onBlur={() => {
              isFocused.current = false;
              saveMemo();
            }}
            onChange={(event) => setMemo(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === 'Escape' && !memoMutation.isPending) {
                setMemo(item.memo);
                memoMutation.reset();
              }
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) event.currentTarget.blur();
            }}
          />
          {isMemoSavingVisible && (
            <span className={styles.feedback} role="status">
              메모 저장 중…
            </span>
          )}
          {memoMutation.isError && (
            <Button variant="text" onClick={saveMemo}>
              메모 다시 저장
            </Button>
          )}
        </div>
        <div className={styles.statuses} role="group" aria-labelledby={`${id}-question`}>
          {STATUS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant="neutral"
              className={styles.statusButton}
              data-status={option.value}
              aria-pressed={item.status === option.value}
              aria-disabled={statusMutation.isPending || undefined}
              onClick={() => selectStatus(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      {statusMutation.isError && (
        <p className={styles.error} role="alert">
          평가를 저장하지 못했어요. 다시 선택해 주세요.
        </p>
      )}
    </li>
  );
};

const styles = {
  item: css`
    label: PropertyChecklistItemControl-item;
    /* 항목 사이에는 줄을 긋지 않는다. 가로선은 카테고리 사이에만 있다. */
  `,
  /*
   * 첫 줄은 질문과 상태 버튼, 그 아래 메모와 안내는 버튼 밑까지 가로를 다 쓴다.
   * 질문 칸(question)은 display: contents로 풀어 그 안의 질문, 메모, 안내가 바로 이 격자에 놓이게 한다.
   */
  row: css`
    label: PropertyChecklistItemControl-row;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    column-gap: var(--space-sm);
    row-gap: 0.6rem;
    padding: 0.9rem 0;

    & > div:first-child {
      display: contents;
    }
    & > div:first-child > * {
      grid-column: 1 / -1;
    }
    & > div:first-child > strong {
      grid-row: 1;
      grid-column: 1;
    }
    & > div:last-child {
      grid-row: 1;
      grid-column: 2;
    }

    /* 메모를 쓰는 동안 회색 바탕 없이 검은 글자로 보인다. */
    && .TextField-field[data-variant='inline'] textarea:focus-visible {
      background: transparent;
      color: var(--color-ink);
    }
  `,
  question: css`
    label: PropertyChecklistItemControl-question;
    flex: 1 1 auto;
    min-width: 0;
    /* 질문과 메모 칸, 안내 문구 사이를 카드 사이처럼 띄운다. */
    display: grid;
    gap: 0.6rem;
    & > strong {
      display: block;
      font-size: 0.875rem;
      font-weight: 650;
      line-height: 1.55;
      word-break: keep-all;
      overflow-wrap: anywhere;
    }
    /* 메모는 질문보다 한 단계 작게 쓴다. */
    & textarea {
      font-size: 0.8rem;
    }
  `,
  statuses: css`
    label: PropertyChecklistItemControl-statuses;
    display: flex;
    flex: none;
    align-items: center;
    gap: 0.25rem;
    /* 질문 첫 줄(글자 높이 약 1.36rem)과 세로 가운데가 맞게 버튼 높이만큼 위로 올린다. */
    margin-top: calc((1.36rem - 1.9rem) / 2);

    @media (pointer: coarse) {
      margin-top: calc((1.36rem - 2.25rem) / 2);
    }
  `,
  statusButton: css`
    label: PropertyChecklistItemControl-statusButton;
    min-height: 1.9rem;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    color: var(--color-ink);
    font-size: 0.75rem;
    white-space: nowrap;
    & > span {
      justify-content: center;
      gap: 0.2rem;
    }
    &[data-status='GOOD'][aria-pressed='true'] {
      background: color-mix(in srgb, var(--color-check-good-ink) 14%, var(--color-surface));
      color: var(--color-check-good-ink);
    }
    &[data-status='CAUTION'][aria-pressed='true'] {
      background: color-mix(in srgb, var(--color-check-caution-ink) 14%, var(--color-surface));
      color: var(--color-check-caution-ink);
    }
    &[aria-disabled='true'] {
      cursor: wait;
    }
    @media (pointer: coarse) {
      min-height: 2.25rem;
    }
  `,
  feedback: css`
    label: PropertyChecklistItemControl-feedback;
    color: var(--color-muted);
    font-size: 0.75rem;
  `,
  error: css`
    label: PropertyChecklistItemControl-error;
    color: var(--color-danger);
    font-size: 0.75rem;
  `,
};

export default PropertyChecklistItemControl;
