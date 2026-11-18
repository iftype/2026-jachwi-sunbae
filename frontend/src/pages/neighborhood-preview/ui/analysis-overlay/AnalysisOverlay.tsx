import useDelayedLoading from '@/shared/lib/hooks/useDelayedLoading';
import { Button } from '@/shared/ui/button/Button';
import ProgressCircle from '@/shared/ui/progress-circle/ProgressCircle';

import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';

import * as shared from '../../NeighborhoodPreviewPage.styles';

type AnalysisOverlayProps = {
  preview: Pick<
    NeighborhoodPreviewContext,
    'isAnalyzing' | 'error' | 'destination' | 'maxMinutes' | 'isMockData' | 'reset' | 'editSearch'
  > & { retry: () => unknown };
};

/** 분석 중·실패 안내. 지도를 지우지 않고 반투명하게 덮어 고른 위치가 뒤에 비쳐 보이게 한다. */
const AnalysisOverlay = ({ preview }: AnalysisOverlayProps) => {
  // 지도와 조건 패널이 그대로 남아 있으니, 빠른 응답에는 분석 안내를 띄우지 않고 바로 결과를 보여 준다.
  // 오래 걸릴 때만 안내를 덮고, 한 번 덮은 안내는 최소 노출 시간만큼 남겨 번쩍이지 않게 한다.
  const isAnalysisVisible = useDelayedLoading(preview.isAnalyzing);

  if (isAnalysisVisible)
    return (
      <section className={`${shared.analysis} ${shared.mapOverlay}`}>
        <ProgressCircle label="주변 동네를 분석하는 중이에요." />
        <h1>주변 동네를 분석하고 있어요</h1>
        <p>{preview.destination.name} 기준</p>
        <p role="status" aria-live="polite">
          최대 {preview.maxMinutes}분 안에 통근할 수 있는 동네와 월세 시세를 찾고 있어요.
        </p>
        <small>
          {preview.isMockData ? 'MSW 샘플 응답을 기다리고 있어요.' : '서버에서 통근 가능한 동네를 계산하고 있어요.'}
        </small>
        <Button variant="text" onClick={preview.reset}>
          취소
        </Button>
      </section>
    );
  if (preview.isAnalyzing) return null;
  if (preview.error)
    return (
      <section className={`${shared.analysis} ${shared.mapOverlay}`}>
        <h1 role="alert">동네를 불러오지 못했어요</h1>
        <p>{preview.error}</p>
        <Button variant="secondary" onClick={() => void preview.retry()}>
          다시 시도
        </Button>
        <Button variant="text" onClick={preview.editSearch}>
          검색 조건 바꾸기
        </Button>
      </section>
    );
  return null;
};

export default AnalysisOverlay;
