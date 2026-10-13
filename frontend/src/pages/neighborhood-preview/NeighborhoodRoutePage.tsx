import { useNavigate, useOutletContext, useParams } from 'react-router-dom';

import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';
import { Button } from '@/shared/ui/button/Button';

import useHorizontalDrag from './hooks/useHorizontalDrag';
import type { NeighborhoodPreviewContext } from './hooks/useNeighborhoodPreview';

import styles from './NeighborhoodRoutePage.module.css';

const NeighborhoodRoutePage = () => {
  const preview = useOutletContext<NeighborhoodPreviewContext>();
  const stationDrag = useHorizontalDrag();
  const navigate = useNavigate();
  const { adminDongCode } = useParams();
  const area = preview.selected?.adminDongCode === adminDongCode ? preview.selected : undefined;

  if (!area)
    return (
      <main className={styles.page}>
        <h1>동네를 먼저 선택해주세요</h1>
        <Button onClick={() => navigate('/neighborhoods/map?mode=commute', { replace: true })}>지도로 돌아가기</Button>
      </main>
    );

  return (
    <BottomSheet
      title={area.name}
      showCloseButton={false}
      onClose={() => navigate(`/neighborhoods/map?mode=${preview.mode}`, { replace: true })}
    >
      {preview.isRouteLoading && <p role="status">대중교통 경로를 불러오고 있어요.</p>}
      {preview.routeError && (
        <div>
          <p role="alert">{preview.routeError}</p>
          <Button variant="secondary" onClick={preview.retryRoute}>
            경로 다시 불러오기
          </Button>
        </div>
      )}
      {preview.route && (
        <section className={styles.routeGuide} aria-label="대중교통 경로">
          <h2>
            예상 {preview.route.totalMinutes}분 · 환승 {preview.route.transferCount}회
          </h2>
          <div className={styles.routeSegments} aria-label="이동 구간 요약">
            {preview.route.legs.map((leg, index) => (
              <span key={index} data-type={leg.type} style={{ flexGrow: Math.max(leg.minutes, 1) }}>
                {leg.type === 'WALK' ? '도보' : leg.type === 'BUS' ? '버스' : '지하철'} {leg.minutes}분
              </span>
            ))}
          </div>
          {area.stations.length > 1 && (
            <div className={styles.stationChoices} aria-label="출발 정류장 선택" {...stationDrag}>
              {area.stations.map((station) => (
                <button
                  key={station.stopId}
                  aria-pressed={preview.selectedStation?.stopId === station.stopId}
                  onClick={() => preview.selectStation(station.stopId)}
                >
                  {station.stopName}
                  {station.direction ? ` (${station.direction})` : ''} · {station.travelMinutes}분
                </button>
              ))}
            </div>
          )}
          <ol>
            {preview.route.legs.map((leg, index) => (
              <li key={`${leg.type}-${index}`}>
                <small>{leg.type === 'WALK' ? '걷기' : `${leg.points[0].name} 승차`}</small>
                <strong>
                  {leg.type === 'WALK' ? '도보' : `${leg.type === 'BUS' ? '버스' : '지하철'} ${leg.routeName ?? ''}`}
                </strong>
                <span>
                  {leg.points[0].name} → {leg.points[leg.points.length - 1].name}
                </span>
                <small>
                  {leg.minutes}분{leg.waitMinutes > 0 ? ` · 대기 ${leg.waitMinutes}분` : ''}
                </small>
                {leg.type !== 'WALK' && (
                  <details className={styles.stops}>
                    <summary>경유 정류장 보기</summary>
                    <ul>
                      {leg.points.map((point, index) => (
                        <li key={`${point.stopId}-${index}`}>{point.name}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      <p className={styles.notice}>
        시간표 기반 예상 정보예요. 실시간 버스 도착 정보는 제공하지 않아요. 집에서 출발 정류장까지 도보는 별도입니다.
      </p>
    </BottomSheet>
  );
};

export default NeighborhoodRoutePage;
