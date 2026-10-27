import { Button } from '@/shared/ui/button/Button';
import ProgressCircle from '@/shared/ui/progress-circle/ProgressCircle';

import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';

import shared from '../../NeighborhoodPreviewPage.module.css';

type AnalysisOverlayProps = {
  preview: Pick<
    NeighborhoodPreviewContext,
    'isAnalyzing' | 'error' | 'destination' | 'maxMinutes' | 'isMockData' | 'reset' | 'retry'
  >;
};

/** 분석 중·실패 안내. 지도를 지우지 않고 반투명하게 덮어 고른 위치가 뒤에 비쳐 보이게 한다. */
const AnalysisOverlay = ({ preview }: AnalysisOverlayProps) => {
  if (preview.isAnalyzing)
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
  if (preview.error)
    return (
      <section className={`${shared.analysis} ${shared.mapOverlay}`}>
        <h1>동네를 불러오지 못했어요</h1>
        <p role="alert">{preview.error}</p>
        <Button variant="secondary" onClick={preview.retry}>
          다시 시도
        </Button>
        <Button variant="text" onClick={preview.reset}>
          목적지 다시 입력
        </Button>
      </section>
    );
  return null;
};

export default AnalysisOverlay;
