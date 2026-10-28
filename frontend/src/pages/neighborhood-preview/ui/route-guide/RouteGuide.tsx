import type { CommuteRoute } from '@/features/map/api/commuteRouteApi';
import { Button } from '@/shared/ui/button/Button';

import styles from './RouteGuide.module.css';

type RouteGuideProps = {
  route: CommuteRoute | undefined;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
};

const modeName = (type: CommuteRoute['legs'][number]['type']) =>
  type === 'WALK' ? '도보' : type === 'BUS' ? '버스' : '지하철';

/**
 * 출발 정류장에서 목적지까지의 대중교통 경로. 동네 상세와 지도에서 고른 정류장 정보가 함께 쓴다.
 * 불러오는 동안은 같은 모양의 스켈레톤을, 실패하면 다시 불러오기를 보여준다.
 */
const RouteGuide = ({ route, isLoading, error, onRetry }: RouteGuideProps) => (
  <>
    {/* 경로는 모양(요약 막대·구간)이 정해져 있어, 글자 대신 같은 모양의 스켈레톤으로 기다리게 한다. */}
    {isLoading && (
      <div className={styles.routeSkeleton} role="status">
        <span className="sr-only">대중교통 경로를 불러오는 중이에요.</span>
        <span className={`${styles.skeleton} ${styles.skeletonTitle}`} aria-hidden="true" />
        <span className={`${styles.skeleton} ${styles.skeletonBar}`} aria-hidden="true" />
        <ul className={styles.skeletonLegs} aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <li key={index}>
              <span className={styles.skeleton} />
              <span className={styles.skeleton} />
              <span className={styles.skeleton} />
            </li>
          ))}
        </ul>
      </div>
    )}
    {error && (
      <div>
        <p role="alert">{error}</p>
        <Button variant="secondary" onClick={onRetry}>
          경로 다시 불러오기
        </Button>
      </div>
    )}
    {route && (
      <section className={styles.routeGuide} aria-label="대중교통 경로">
        <h2>
          예상 {route.totalMinutes}분 · 환승 {route.transferCount}회
        </h2>
        <div className={styles.routeSegments} aria-label="이동 구간 요약">
          {route.legs.map((leg, index) => (
            <span key={index} data-type={leg.type} style={{ flexGrow: Math.max(leg.minutes, 1) }}>
              {modeName(leg.type)} {leg.minutes}분
            </span>
          ))}
        </div>
        {/* 구간마다 수단 색의 선과 점으로 잇는다. 요약 막대와 같은 색을 써서 어느 구간인지 바로 맞춰 볼 수 있게 한다. */}
        <ol className={styles.legs}>
          {route.legs.map((leg, index) => (
            <li key={`${leg.type}-${index}`} data-type={leg.type}>
              <small>
                {leg.type === 'WALK' ? '걷기' : `${leg.points[0].name} 승차`} · {leg.minutes}분
                {leg.waitMinutes > 0 ? ` · 대기 ${leg.waitMinutes}분` : ''}
              </small>
              <strong>{leg.type === 'WALK' ? '도보' : `${modeName(leg.type)} ${leg.routeName ?? ''}`}</strong>
              <span>
                {leg.points[0].name} → {leg.points[leg.points.length - 1].name}
              </span>
              {leg.type !== 'WALK' && (
                <details className={styles.stops}>
                  <summary>경유 정류장 {leg.points.length}곳</summary>
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
  </>
);

export default RouteGuide;
