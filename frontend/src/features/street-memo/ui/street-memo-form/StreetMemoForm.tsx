import { css } from '@emotion/css';
import { useState } from 'react';

import { Button } from '@/shared/ui/button/Button';
import TextAreaField from '@/shared/ui/text-field/TextAreaField';

import { PREFERENCE_LABELS, type StreetMemoPreference } from '../../model/StreetMemo';

type Props = {
  isSubmitting: boolean;
  submitFailed: boolean;
  onSubmit: (memo: string, preference: StreetMemoPreference) => void;
  onCancel: () => void;
};

const PREFERENCES: StreetMemoPreference[] = ['LIKE', 'DISLIKE'];

/** 찍은 위치에 남길 메모. 좋아요·싫어요는 기본값 없이 꼭 고르게 하고, 내용은 입력한 줄바꿈을 그대로 보낸다. */
const StreetMemoForm = ({ isSubmitting, submitFailed, onSubmit, onCancel }: Props) => {
  const [preference, setPreference] = useState<StreetMemoPreference | null>(null);
  const [memo, setMemo] = useState('');
  const canSubmit = preference !== null && memo.trim().length > 0 && !isSubmitting;
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit(memo, preference);
      }}
    >
      {/* 쓴 메모가 누구에게 보이는지 미리 알린다. */}
      <p className={styles.visibility}>여러분이 남긴 평가는 자취선배를 쓰는 모두에게 보여요.</p>
      <fieldset className={styles.preferences}>
        <legend className="sr-only">이 장소를 평가해 주세요</legend>
        {PREFERENCES.map((value) => (
          <button
            key={value}
            type="button"
            className={styles.preference}
            data-preference={value}
            aria-pressed={preference === value}
            onClick={() => setPreference(value)}
          >
            {value === 'LIKE' ? '👍 ' : '👎 '}
            {PREFERENCE_LABELS[value]}
          </button>
        ))}
      </fieldset>
      <TextAreaField
        label="메모"
        variant="box"
        className={styles.memo}
        placeholder="예: 늦게까지 여는 세탁소가 있어요"
        value={memo}
        onChange={(event) => setMemo(event.target.value)}
      />
      {submitFailed && (
        <p className={styles.error} role="alert">
          메모를 남기지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
      <div className={styles.actions}>
        <Button type="button" variant="text" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={!canSubmit} className={styles.submit}>
          {isSubmitting ? '남기는 중…' : '평가 남기기'}
        </Button>
      </div>
    </form>
  );
};

const styles = {
  form: css`
    label: StreetMemoForm-form;
    display: grid;
    gap: 0.9rem;
  `,

  visibility: css`
    label: StreetMemoForm-visibility;
    margin: 0;
    color: var(--color-muted);
    font-size: 0.8125rem;
    line-height: 1.5;
  `,

  preferences: css`
    label: StreetMemoForm-preferences;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    border: 0;

    & legend {
      margin-bottom: 0.5rem;
      color: var(--color-ink-soft);
      font-size: 0.8125rem;
      font-weight: 600;
    }
  `,

  /* 큰 테두리 상자 대신 옅은 알약. 고르면 지도 말풍선과 같은 옅은 파랑, 옅은 빨강 바탕에 진한 글자로 바뀐다. */
  preference: css`
    label: StreetMemoForm-preference;
    min-height: 2.5rem;
    border: 0;
    border-radius: 999px;
    background: #f1f2f4;
    color: var(--color-ink-soft);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;

    &[aria-pressed='true'][data-preference='LIKE'] {
      background: var(--color-memo-like);
      color: var(--color-memo-like-ink);
      font-weight: 700;
    }

    &[aria-pressed='true'][data-preference='DISLIKE'] {
      background: var(--color-memo-dislike);
      color: var(--color-memo-dislike-ink);
      font-weight: 700;
    }
  `,

  /* 테두리 없이 옅은 회색 바탕의 둥근 입력. 안쪽 여백을 넉넉히 둔다. */
  memo: css`
    label: StreetMemoForm-memo;

    &&& {
      min-height: 5.5rem;
      padding: 0.8rem 0.9rem;
      border: 0;
      border-radius: 0.8rem;
      background: #f6f7f8;
      font-size: 0.9375rem;
      line-height: 1.55;
      resize: none;
    }

    &&&:focus-visible {
      outline: 0;
      background: #f1f2f4;
      box-shadow: none;
    }
  `,

  error: css`
    label: StreetMemoForm-error;
    margin: 0;
    color: var(--color-danger);
    font-size: 0.875rem;
  `,

  actions: css`
    label: StreetMemoForm-actions;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  `,

  /* 남기기 버튼이 남는 폭을 쓰고, 취소는 작은 글자 버튼으로 둔다. */
  submit: css`
    label: StreetMemoForm-submit;
    flex: 1;
  `,
};

export default StreetMemoForm;
