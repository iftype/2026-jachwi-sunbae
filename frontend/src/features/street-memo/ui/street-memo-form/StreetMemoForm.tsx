import { useState } from 'react';

import { Button } from '@/shared/ui/button/Button';
import TextAreaField from '@/shared/ui/text-field/TextAreaField';

import { PREFERENCE_LABELS, type StreetMemoPreference } from '../../model/StreetMemo';

import styles from './StreetMemoForm.module.css';

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
      <fieldset className={styles.preferences}>
        <legend>이 장소, 어땠어요?</legend>
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
        <Button type="button" variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isSubmitting ? '남기는 중…' : '메모 남기기'}
        </Button>
      </div>
    </form>
  );
};

export default StreetMemoForm;
