import { useState } from 'react';

import { Button } from '@/shared/ui/button/Button';

import { PREFERENCE_LABELS, type StreetMemo } from '../../model/StreetMemo';

import styles from './StreetMemoDetails.module.css';

type Props = {
  memo: StreetMemo;
  isRemoving: boolean;
  removeFailed: boolean;
  onRemove: () => void;
};

/** 지도에서 고른 메모. 작성자는 드러내지 않고, 본인 메모일 때만 한 번 더 물어본 뒤 지운다. */
const StreetMemoDetails = ({ memo, isRemoving, removeFailed, onRemove }: Props) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className={styles.details}>
      <p className={styles.meta}>
        <span className={styles.preference} data-preference={memo.preference}>
          {memo.preference === 'LIKE' ? '👍 ' : '👎 '}
          {PREFERENCE_LABELS[memo.preference]}
        </span>
        {memo.isMine && <span className={styles.mine}>내가 남긴 메모</span>}
      </p>
      <p className={styles.memo}>{memo.memo}</p>
      {removeFailed && (
        <p className={styles.error} role="alert">
          메모를 지우지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
      {memo.isMine &&
        (confirming ? (
          <div className={styles.confirm}>
            <p>이 메모를 지울까요?</p>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={isRemoving}>
              취소
            </Button>
            <Button variant="danger" onClick={onRemove} disabled={isRemoving}>
              {isRemoving ? '지우는 중…' : '지우기'}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            메모 지우기
          </Button>
        ))}
    </div>
  );
};

export default StreetMemoDetails;
