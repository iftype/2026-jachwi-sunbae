import Icon from '@/shared/ui/icon/Icon';

import styles from './RecordNotice.module.css';

type RecordNoticeProps = {
  message: string;
  onClose: () => void;
  className?: string;
};

/** 기록 삭제·등록 뒤 화면 아래에 잠깐 띄우는 안내. */
const RecordNotice = ({ message, onClose, className }: RecordNoticeProps) =>
  message ? (
    <div className={`${styles.notice} ${className ?? ''}`.trim()} role="status">
      {message}
      <button type="button" aria-label="안내 닫기" onClick={onClose}>
        <Icon name="close" size={16} />
      </button>
    </div>
  ) : null;

export default RecordNotice;
