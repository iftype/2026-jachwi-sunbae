import { css } from '@emotion/css';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { resetAuthentication } from '@/features/auth/api/apiClient';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import Icon from '@/shared/ui/icon/Icon';

import * as styles from '../my-row-card/MyRowCard.styles';

type WithdrawStatus = 'idle' | 'withdrawing' | 'failed';

/**
 * 회원 탈퇴. 확인하면 서버가 회원과 기록을 삭제 처리하고 연결한 카카오, Apple 계정을 해제한다(`DELETE /api/members/me`).
 * 삭제 처리한 기록은 볼 수 없게 되고 90일 보관 뒤 파기한다. 탈퇴한 뒤에는 새 익명 아이디를 받고 홈으로 간다.
 * 기록을 바로 지우는 메일 요청은 개인정보 처리방침의 삭제 요청 안내에서 받는다.
 */
const AccountWithdrawCard = () => {
  const config = usePublicConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<WithdrawStatus>('idle');
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setIsOpen(false);
    setStatus('idle');
  };

  const confirmWithdraw = async () => {
    setStatus('withdrawing');
    try {
      await resetAuthentication(config);
    } catch {
      setStatus('failed');
      return;
    }
    // 새 회원으로 바뀌면 회원 캐시는 인증 저장소가 지운다. 회원과 무관해 보이는 캐시까지 남기지 않는다.
    queryClient.clear();
    void navigate('/', { replace: true });
  };

  return (
    <>
      <button ref={triggerRef} className={styles.notice} type="button" onClick={() => setIsOpen(true)}>
        <span>
          <strong>회원 탈퇴</strong>
        </span>
        <Icon name="chevron-right" size={16} />
      </button>
      <ConfirmDialog
        isOpen={isOpen}
        title="탈퇴할까요?"
        confirmLabel="탈퇴"
        isConfirming={status === 'withdrawing'}
        returnFocusRef={triggerRef}
        onCancel={close}
        onConfirm={() => void confirmWithdraw()}
        description={
          <>
            <p>
              계정과 지금까지 남긴 매물, 체크리스트, 사진, 거리 메모를 삭제해요. 삭제한 기록은 다시 볼 수 없고, 90일 뒤
              완전히 파기돼요.
            </p>
            <p>연결한 카카오나 Apple 계정이 있으면 연결도 끊어요. 탈퇴한 뒤에는 새 아이디로 다시 시작해요.</p>
          </>
        }
      >
        {status === 'failed' && (
          <p role="alert" className={localStyles.error}>
            탈퇴하지 못했어요. 지금 계정과 기록은 그대로예요. 잠시 후 다시 시도해 주세요.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
};

const localStyles = {
  error: css`
    label: AccountWithdrawCard-error;
    margin: 0.75rem 0 0;
    color: var(--color-error);
    font-size: 0.78rem;
    line-height: 1.5;
  `,
};

export default AccountWithdrawCard;
