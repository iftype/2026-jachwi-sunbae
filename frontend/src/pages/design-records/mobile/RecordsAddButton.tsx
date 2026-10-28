import { useState } from 'react';

import Icon from '@/shared/ui/icon/Icon';

import type { RecordsAddKind } from '../hooks/useRecordsAddMode';

import styles from './RecordsAddButton.module.css';

type Props = {
  /** 펼치지 않았을 때 버튼 위에 띄우는 지도 안내. */
  hint: string;
  onChoose: (kind: RecordsAddKind) => void;
};

/**
 * 휴대폰 기록 지도 가운데 아래의 추가 버튼. 누르면 `+`가 `X`로 바뀌고, 위로 왼쪽 메모·오른쪽 매물 버튼을 띄운다.
 * `X`를 누르면 고르지 않고 닫는다. `+` 아이콘은 나중에 이미지로 바꾼다.
 */
const RecordsAddButton = ({ hint, onChoose }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const choose = (kind: RecordsAddKind) => {
    setIsOpen(false);
    onChoose(kind);
  };
  return (
    <div className={styles.root}>
      {isOpen ? (
        <div className={styles.choices} role="group" aria-label="무엇을 추가할까요">
          <button type="button" className={`${styles.choice} ${styles.left}`} onClick={() => choose('memo')}>
            📝 메모
          </button>
          <button type="button" className={`${styles.choice} ${styles.right}`} onClick={() => choose('property')}>
            🏠 매물
          </button>
        </div>
      ) : (
        <span className={styles.hint}>{hint}</span>
      )}
      <button
        type="button"
        className={`${styles.fab} ${isOpen ? styles.close : ''}`.trim()}
        aria-label={isOpen ? '추가 닫기' : '추가하기'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {/* TODO: 추가 버튼 이미지로 바꾼다. */}
        <Icon name={isOpen ? 'close' : 'plus'} size={26} />
      </button>
    </div>
  );
};

export default RecordsAddButton;
