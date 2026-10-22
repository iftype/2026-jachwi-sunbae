import { Outlet, useNavigate } from 'react-router-dom';

import { authenticate, getSafeApiErrorMessage } from '@/features/auth/api/apiClient';
import { useCurrentMember } from '@/features/auth/api/useCurrentMember';
import { useAuthentication } from '@/features/auth/model/useAuthentication';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import useDelayedLoading from '@/shared/lib/hooks/useDelayedLoading';
import { Button } from '@/shared/ui/button/Button';
import ContentState from '@/shared/ui/content-state/ContentState';
import StatusPanel from '@/shared/ui/status-panel/StatusPanel';

/**
 * 회원 화면 입구. 회원 정보를 부르면 API 클라이언트가 먼저 자동 로그인(복원 또는 익명 회원 생성)을 마친다.
 * 서버가 복원을 거절해도 새 회원으로 조용히 바꾸지 않는다. 새 기록으로 시작할지는 사용자가 고른다.
 */
const ProtectedRoute = () => {
  const config = usePublicConfig();
  const navigate = useNavigate();
  const { terminationReason } = useAuthentication();
  const currentMember = useCurrentMember();
  const isLoadingVisible = useDelayedLoading(currentMember.isPending);

  if (terminationReason === 'unauthorized') {
    return (
      <StatusPanel
        title="이전 기록을 이어서 불러오지 못했어요"
        description="이 브라우저에 남은 기록 정보가 만료됐거나 지워졌어요. 새로 시작하면 빈 기록으로 시작해요."
        tone="error"
        action={
          <>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              뒤로 가기
            </Button>
            <Button
              onClick={() =>
                void authenticate(config)
                  .then(() => currentMember.refetch())
                  .catch(() => undefined)
              }
            >
              새 기록으로 시작하기
            </Button>
          </>
        }
      />
    );
  }

  if (currentMember.isPending) {
    return isLoadingVisible ? <ContentState loading title="기록을 불러올 준비를 하고 있어요." /> : null;
  }

  if (currentMember.isError) {
    return (
      <StatusPanel
        title="회원 정보를 불러오지 못했어요"
        description={getSafeApiErrorMessage(currentMember.error)}
        tone="error"
        action={<Button onClick={() => void currentMember.refetch()}>다시 시도하기</Button>}
      />
    );
  }

  return <Outlet context={currentMember.data} />;
};

export default ProtectedRoute;
