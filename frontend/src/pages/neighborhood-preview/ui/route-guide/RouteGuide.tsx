import { css, cx, keyframes } from '@emotion/css';

import type { CommuteRoute } from '@/features/map/api/commuteRouteApi';
import busIcon from '@/shared/assets/map-icons/route/route-bus.svg';
import subwayIcon from '@/shared/assets/map-icons/route/route-subway.svg';
import walkIcon from '@/shared/assets/map-icons/route/route-walk.svg';
import useDelayedLoading from '@/shared/lib/hooks/useDelayedLoading';
import { Button } from '@/shared/ui/button/Button';

type RouteGuideProps = {
  route: CommuteRoute | undefined;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
};

const modeName = (type: CommuteRoute['legs'][number]['type']) =>
  type === 'WALK' ? '도보' : type === 'BUS' ? '버스' : '지하철';

const modeIcon = (type: CommuteRoute['legs'][number]['type']) =>
  type === 'WALK' ? walkIcon : type === 'BUS' ? busIcon : subwayIcon;

/**
 * 출발 정류장에서 목적지까지의 대중교통 경로. 동네 상세와 지도에서 고른 정류장 정보가 함께 쓴다.
 * 불러오는 동안은 같은 모양의 스켈레톤을, 실패하면 다시 불러오기를 보여준다.
 */
const RouteGuide = ({ route, isLoading, error, onRetry }: RouteGuideProps) => {
  // 빠른 응답에는 스켈레톤 없이 바로 경로를 보여 주고, 오래 걸릴 때만 스켈레톤을 보여 준다.
  // 한 번 보인 스켈레톤은 잠깐 남기고, 그동안은 경로를 함께 그리지 않는다.
  const isSkeletonVisible = useDelayedLoading(isLoading);
  return (
    <>
      {/* 경로는 모양(요약 막대·구간)이 정해져 있어, 글자 대신 같은 모양의 스켈레톤으로 기다리게 한다. */}
      {isSkeletonVisible && (
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
      {route && !isLoading && !isSkeletonVisible && (
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
                <img className={styles.legIcon} src={modeIcon(leg.type)} alt="" draggable={false} decoding="async" />
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
};

const routeSkeletonShimmerKeyframes = keyframes`
  to {
    background-position: -200% 0;
  }
`;

const styles = {
  routeGuide: css`
    label: RouteGuide-routeGuide;
    padding-top: 0.35rem;

    & h2 {
      font-size: 1.1rem;
    }

    /* 이동 수단 색. 요약 막대와 구간 선이 같은 색을 쓴다. 버스는 옅은 파랑(진한 글씨), 지하철은 진한 파랑(흰 글씨)으로 구분한다. */
    & {
      --leg-bus: #9db9ec;
      --leg-subway: var(--color-brand-blue-ink, #3f6fc4);
      --leg-walk: #c3c8cf;
    }
  `,

  legs: css`
    label: RouteGuide-legs;
    list-style: none;
    margin: 1.25rem 0 0.5rem;
    padding: 0;

    & > li {
      --leg-color: var(--leg-walk);
      position: relative;
      display: grid;
      gap: 0.3rem;
      padding: 0 0 1.4rem 2.2rem;
    }

    & > li[data-type='BUS'] {
      --leg-color: var(--leg-bus);
    }

    & > li[data-type='SUBWAY'] {
      --leg-color: var(--leg-subway);
    }

    /* 구간 선. 걷기는 점선으로 그린다. */
    & > li::before {
      position: absolute;
      top: 1.6rem;
      bottom: 0;
      left: calc(0.75rem - 1.5px);
      width: 3px;
      border-radius: 999px;
      background: var(--leg-color);
      content: '';
    }

    & > li[data-type='WALK']::before {
      background: repeating-linear-gradient(to bottom, var(--leg-color) 0 4px, transparent 4px 8px);
    }

    & > li:last-child::before {
      bottom: 0.6rem;
    }

    & small {
      color: var(--color-muted);
      font-size: 0.75rem;
    }

    & strong {
      font-size: 0.95rem;
    }

    & span {
      color: var(--color-ink-soft);
      font-size: 0.85rem;
    }
  `,

  /* 구간 시작점에 이동 수단 그림을 둔다. 가운데가 아래 구간 선과 맞는다. */
  legIcon: css`
    label: RouteGuide-legIcon;
    position: absolute;
    top: -0.1rem;
    left: 0;
    width: 1.5rem;
    height: 1.5rem;
    pointer-events: none;
  `,

  routeSegments: css`
    label: RouteGuide-routeSegments;
    display: flex;
    gap: 2px;
    overflow: hidden;
    border-radius: 999px;
    margin: 1rem 0 1.5rem;

    & span {
      padding: 0.45rem 0.6rem;
      font-size: 0.7rem;
      text-align: center;
      background: var(--color-surface-muted);
      white-space: nowrap;
    }

    & span[data-type='BUS'] {
      background: var(--leg-bus);
      color: var(--color-ink);
    }

    & span[data-type='SUBWAY'] {
      background: var(--leg-subway);
      color: white;
    }
  `,

  stops: css`
    label: RouteGuide-stops;

    & summary {
      width: fit-content;
      color: var(--color-ink-soft);
      font-size: 0.75rem;
      cursor: pointer;
    }

    & ul {
      margin: 0.4rem 0 0;
      padding-left: 1rem;
      color: var(--color-ink-soft);
    }

    & li {
      padding: 0.2rem 0;
      font-size: 0.75rem;
    }
  `,

  /* 경로를 불러오는 동안의 스켈레톤. 기록 리스트 스켈레톤과 같은 색과 움직임을 쓴다. */
  routeSkeleton: css`
    label: RouteGuide-routeSkeleton;
    display: grid;
    gap: 1rem;
    padding-top: 0.35rem;
  `,

  // 다른 요소의 선택자에서 `.RouteGuide-skeleton`로 가리킨다.
  skeleton: cx(
    css`
      label: RouteGuide-skeleton;
      display: block;
      height: 0.8rem;
      border-radius: 0.4rem;
      background: linear-gradient(90deg, #eff1f5 25%, #e3e6eb 50%, #eff1f5 75%);
      background-size: 200% 100%;
      animation: ${routeSkeletonShimmerKeyframes} 1.2s ease-in-out infinite;

      @media (prefers-reduced-motion: reduce) {
        animation: none;
      }
    `,
    'RouteGuide-skeleton',
  ),

  skeletonTitle: css`
    label: RouteGuide-skeletonTitle;
    width: 45%;
    height: 1.2rem;
  `,

  skeletonBar: css`
    label: RouteGuide-skeletonBar;
    height: 1.9rem;
    border-radius: 999px;
  `,

  skeletonLegs: css`
    label: RouteGuide-skeletonLegs;
    display: grid;
    gap: 1.4rem;
    margin: 0.5rem 0 0;
    padding: 0 0 0 1.6rem;
    list-style: none;

    & li {
      display: grid;
      gap: 0.45rem;
    }

    & li .RouteGuide-skeleton:nth-child(1) {
      width: 35%;
      height: 0.7rem;
    }

    & li .RouteGuide-skeleton:nth-child(2) {
      width: 55%;
      height: 0.95rem;
    }

    & li .RouteGuide-skeleton:nth-child(3) {
      width: 75%;
    }
  `,
};

export default RouteGuide;
