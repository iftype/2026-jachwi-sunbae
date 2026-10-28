import { useRef, useState } from 'react';

import { createAccountDeletionMailto } from '@/shared/config/accountDeletion';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import Icon from '@/shared/ui/icon/Icon';

import styles from '../my-row-card/MyRowCard.module.css';

type AccountDeletionCardProps = { memberId: number };

/** 계정 삭제 요청. 확인 한 번이면 회원 번호가 채워진 메일을 열어, 보내기만 하면 요청이 끝난다. */
const AccountDeletionCard = ({ memberId }: AccountDeletionCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const requestByEmail = () => {
    setIsOpen(false);
    window.location.href = createAccountDeletionMailto(memberId);
  };

  return (
    <>
      <button ref={triggerRef} className={styles.notice} type="button" onClick={() => setIsOpen(true)}>
        <span className={styles.noticeIcon}>
          <Icon name="trash" size={16} />
        </span>
        <span>
          <strong>계정 및 데이터 삭제 요청</strong>
          <small>자취선배 계정과 연결된 기록의 삭제를 요청해요.</small>
        </span>
        <Icon name="arrow-right" size={15} />
      </button>
      <ConfirmDialog
        isOpen={isOpen}
        title="계정 삭제를 요청할까요?"
        confirmLabel="메일로 요청하기"
        isConfirming={false}
        returnFocusRef={triggerRef}
        onCancel={() => setIsOpen(false)}
        onConfirm={requestByEmail}
        description={
          <p>
            회원 번호 {memberId}와 연결된 매물·체크리스트·사진·메모·위치 정보를 모두 삭제해요. 회원 번호가 적힌 메일이
            열리면 그대로 보내 주세요.
          </p>
        }
      />
    </>
  );
};

export default AccountDeletionCard;
