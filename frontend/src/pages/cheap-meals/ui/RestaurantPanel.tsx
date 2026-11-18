import { css, cx } from '@emotion/css';
import { type ReactNode, useEffect } from 'react';

import { formatStoreDistance } from '@/features/good-price/model/GoodPriceStore';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import MapCurrentLocationButton from '@/features/map/ui/map-current-location-button/MapCurrentLocationButton';
import MapZoomControl from '@/features/map/ui/map-zoom-control/MapZoomControl';
import useDelayedLoading from '@/shared/lib/hooks/useDelayedLoading';
import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';
import { Button } from '@/shared/ui/button/Button';
import ContentState from '@/shared/ui/content-state/ContentState';
import Icon from '@/shared/ui/icon/Icon';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';
import ListDetailLayout from '@/shared/ui/list-detail-layout/ListDetailLayout';
import ProgressCircle from '@/shared/ui/progress-circle/ProgressCircle';
import Toast from '@/shared/ui/toast/Toast';

import type { MealLayout } from '../hooks/useMealTabs';
import useRestaurantMap from '../hooks/useRestaurantMap';
import BusinessTypeChips from './business-type-chips/BusinessTypeChips';
import MealEmptyState from './MealEmptyState';
import StoreCard from './store-card/StoreCard';
import StoreDetail from './store-detail/StoreDetail';

/** 가게 마커(핀)의 높이(px). 좌표가 핀 아래 끝이라 카드는 이만큼 위에 뜬다. */
const STORE_PIN_HEIGHT = 36;

type RestaurantPanelProps = {
  isActive: boolean;
  layout: MealLayout;
  /** 데스크탑 리스트 칸 맨 위에 둘 머리(제목과 탭). 내 기록, 동네 찾기처럼 지도 왼쪽 칸 안에 들어간다. */
  listHeader?: ReactNode;
  /** 데스크탑에서 식당 탭이 아닐 때 목록 칸 머리 아래에 대신 보여 줄 내용. 지도와 선택한 기준 위치는 유지한다. */
  listOverride?: ReactNode;
};

const RestaurantPanel = ({ isActive, layout, listHeader, listOverride }: RestaurantPanelProps) => {
  const isMapActive = isActive || layout === 'desktop';
  const map = useRestaurantMap(isMapActive);
  // 식당 탭을 처음 열어 보여 줄 목록이 없을 때는 찾는 중 문구를 바로 보여 준다.
  // 지도를 옮겨 다시 찾을 때는 이전 목록을 둔 채 기다리고, 응답이 늦을 때만 찾는 중 문구로 바꾼다.
  const isDelayedLoadingVisible = useDelayedLoading(map.query.isPlaceholderData);
  const isLoadingVisible = map.query.isPending || isDelayedLoadingVisible;
  const data = map.query.isError ? undefined : map.query.data;
  const locate = () => void map.locate();
  // 기준 위치는 마커로 보이므로 누르는 칩 없이 어느 기준인지만 한 줄로 알린다.
  const baseCaption = (
    <p className={styles.baseCaption}>
      <Icon name="locate" size={16} />
      <span>
        {map.area.label} 기준, 반경 {map.radius / 1000}km
      </span>
    </p>
  );
  const chips = (
    <BusinessTypeChips
      floating={layout === 'mobile'}
      types={map.businessTypes}
      selected={map.businessType}
      total={data?.count ?? 0}
      onSelect={map.selectBusinessType}
    />
  );
  // 다른 지도 화면처럼 현재 위치는 지도 위 동그란 공용 버튼으로 두고, 확인 중이거나 실패하면 그 옆에 짧게 알린다.
  const locationControl = (
    <div className={cx(styles.location, layout === 'desktop' && styles.locationDesktop)}>
      {(map.isLocating || map.locationError) && (
        <p className={styles.locationStatus} role={map.locationError ? 'alert' : 'status'}>
          {map.isLocating ? '현재 위치를 확인하는 중이에요.' : map.locationError}
        </p>
      )}
      <MapCurrentLocationButton isLocating={map.isLocating} onClick={locate} />
    </div>
  );
  // 데스크탑: 고른 가게는 큰 옆 칸 대신 지도 위 마커 옆 작은 정보 카드로 보인다. 휴대폰은 하단 시트를 그대로 쓴다.
  const store = map.selectedStore;
  const storeCard =
    layout === 'desktop' && store
      ? {
          latitude: store.latitude,
          longitude: store.longitude,
          placement: 'above' as const,
          label: store.name,
          onClick: () => undefined,
          card: {
            title: store.name,
            subtitle: `${store.businessType}, 직선 ${formatStoreDistance(store.distanceMeters)}`,
            lines: [store.address],
            rows: store.menus.slice(0, 3).map((menu) => ({
              label: menu.name,
              value: menu.price ?? '가격 정보 없음',
              isEmpty: menu.price === null,
            })),
            note: `방문 전에 확인해 주세요. 행정안전부 착한가격업소 현황${data?.dataAsOf ? `, ${data.dataAsOf} 기준` : ''}`,
            link: {
              label: '길찾기',
              href: `https://map.kakao.com/link/to/${encodeURIComponent(store.name)},${store.latitude},${store.longitude}`,
            },
            // 가게 핀은 좌표에서 위로 36px 솟아 있다(꼬리 끝이 핀 위쪽 가장자리에 닿게).
            markerAbove: STORE_PIN_HEIGHT,
            markerBelow: 0,
          },
        }
      : undefined;
  // 지도에서 가게를 누르면 목록이 그 카드 자리로 스크롤한다.
  useEffect(() => {
    if (layout !== 'desktop' || !store) return;
    document.getElementById(`store-card-${store.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [layout, store]);
  const mapView = (
    <>
      {isMapActive && (
        <MapCanvas
          shared
          onRetry={() => window.location.reload()}
          center={map.viewport}
          markers={map.markers}
          circles={[{ radiusMeters: map.radius, label: `${map.radius}m` }]}
          radiusCenter={map.area}
          level={map.level}
          interactive
          selectedMarkerId={map.selectedStore ? String(map.selectedStore.id) : null}
          onSelectMarker={(marker) => map.selectMarker(marker.id)}
          onSelectLocation={map.selectedStore ? map.closeOverlay : undefined}
          coordinateAction={storeCard}
          onCenterChange={map.moveMap}
          onLevelChange={map.changeLevel}
        />
      )}
    </>
  );
  const storeList = isLoadingVisible ? (
    <ProgressCircle size={24} label="주변 가게를 찾고 있어요." />
  ) : map.query.isError ? (
    <ContentState
      page={false}
      tone="error"
      title="가게 정보를 불러오지 못했어요"
      description="연결 상태를 확인하고 다시 시도해 주세요."
      onRetry={() => void map.query.refetch()}
    />
  ) : data?.count === 0 ? (
    <MealEmptyState
      title="이 반경 안에 등록된 가게가 없어요"
      description="지도의 다른 매물 마커를 눌러 기준을 바꾸거나, 내 위치 버튼으로 현재 위치를 기준으로 해 보세요."
    />
  ) : map.stores.length === 0 ? (
    <MealEmptyState
      title={`이 반경 안에 ${map.businessType ?? ''} 가게가 없어요`}
      description="다른 업종을 고르거나 전체 업종으로 다시 살펴보세요."
      action={
        <Button variant="secondary" onClick={() => map.selectBusinessType(null)}>
          전체 업종 보기
        </Button>
      }
    />
  ) : (
    <>
      <ul className={styles.list} aria-label="가게 목록">
        {map.stores.map((store) => (
          <li key={store.id}>
            <StoreCard store={store} onSelect={map.openStore} isSelected={map.selectedStore?.id === store.id} />
          </li>
        ))}
      </ul>
      <InlineNotice>
        행정안전부 착한가격업소 현황 · {data?.dataAsOf ?? '기준일 정보 없음'}
        <br />
        음식점 외 업종도 있어요. 방문 전 업종과 가격, 영업 여부를 확인해 주세요.
      </InlineNotice>
    </>
  );
  const noticeToast = (
    <Toast isOpen={map.notice !== null} title={map.notice ?? ''} duration={0} onClose={map.closeNotice} />
  );

  // 데스크탑은 목록을 지도 왼쪽에 늘 펼쳐 두고, 고른 가게의 상세를 목록 옆 칸에 붙인다.
  if (layout === 'desktop') {
    return (
      <section className={styles.panel} aria-label="주변 착한가격업소">
        <ListDetailLayout
          className={styles.desktopLayout}
          list={
            <div className={styles.desktopList}>
              {listHeader}
              {listOverride !== undefined && !isActive ? (
                <div className={styles.desktopStores}>{listOverride}</div>
              ) : (
                <>
                  <div className={styles.desktopControls}>
                    {baseCaption}
                    {chips}
                  </div>
                  <div className={styles.desktopStores}>
                    <h2 className={styles.desktopTitle}>착한가격 가게 {map.stores.length}곳</h2>
                    {storeList}
                  </div>
                </>
              )}
            </div>
          }
        >
          <div className={cx(styles.map, styles.desktopMap)}>
            {mapView}
            {/* 내 기록, 동네 찾기와 같은 자리: 오른쪽 위에 줌, 그 아래에 내 위치 버튼. */}
            <MapZoomControl className={styles.zoomDesktop} level={map.level} onChange={map.changeLevel} />
            {locationControl}
            {noticeToast}
          </div>
        </ListDetailLayout>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-label="주변 착한가격업소">
      <div className={styles.map}>
        {mapView}
        {/* 검색창과 업종 칩은 흰 띠 없이 지도 위에 띄운다. */}
        <div className={styles.overlay}>
          {chips}
          {locationControl}
        </div>
        {!map.isListOpen ? (
          <Button className={styles.showList} onClick={map.openList}>
            가게 목록 보기 {data ? `${map.stores.length}곳` : ''}
          </Button>
        ) : (
          <BottomSheet
            title={map.selectedStore?.name ?? `착한가격 가게 ${map.stores.length}곳`}
            initialHeightPercent={40}
            onClose={() => {
              if (map.selectedStore) map.closeOverlay();
              else map.closeList();
            }}
            closeLabel={map.selectedStore ? '가게 상세 닫기' : '가게 목록 닫기'}
            onBack={map.selectedStore ? map.closeOverlay : undefined}
          >
            <div className={styles.sheetContent}>
              {map.selectedStore && !map.query.isPending && !map.query.isError ? (
                <StoreDetail store={map.selectedStore} dataAsOf={data?.dataAsOf ?? null} />
              ) : (
                storeList
              )}
            </div>
          </BottomSheet>
        )}
        {noticeToast}
      </div>
    </section>
  );
};
const styles = {
  baseCaption: css`
    label: RestaurantPanel-baseCaption;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    color: var(--color-ink-soft);
    font-size: 0.8125rem;
  `,
  panel: css`
    label: RestaurantPanel-panel;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  `,
  /* 휴대폰은 검색창, 업종 칩, 현재 위치를 지도 위에 띄운다. 빈 곳은 지도를 그대로 만질 수 있게 둔다. */
  overlay: css`
    label: RestaurantPanel-overlay;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem 0.85rem 0;
    pointer-events: none;
    & > * {
      pointer-events: auto;
    }
  `,
  location: css`
    label: RestaurantPanel-location;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    justify-self: end;
  `,
  /* 데스크탑은 지도 칸 오른쪽 아래에 둔다. */
  locationDesktop: css`
    label: RestaurantPanel-locationDesktop;
    position: absolute;
    /* 줌 버튼 바로 아래(내 기록 지도와 같은 자리). */
    top: 10.55rem;
    right: 1.15rem;
    z-index: 20;
  `,
  zoomDesktop: css`
    label: RestaurantPanel-zoomDesktop;
    top: 4.75rem;
    right: 1.15rem;
  `,
  locationStatus: css`
    label: RestaurantPanel-locationStatus;
    max-width: 16rem;
    margin: 0;
    padding: 0.45rem 0.7rem;
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    box-shadow: var(--shadow-floating);
    color: var(--color-ink);
    font-size: 0.72rem;
    line-height: 1.45;
    word-break: keep-all;
  `,
  desktopControls: css`
    label: RestaurantPanel-desktopControls;
    display: grid;
    gap: 0.6rem;
    padding: 1rem 1rem 0.75rem;
    border-bottom: 1px solid var(--color-border);
  `,
  /* 데스크탑 목록 칸에서는 띄우지 않고 다른 검색창처럼 회색 바탕에 둔다. */
  map: css`
    label: RestaurantPanel-map;
    flex: 1;
    min-height: 0;
    position: relative;
    overflow: hidden;
    & .BottomSheet-sheet header h2 {
      white-space: normal;
      overflow-wrap: anywhere;
    }
  `,
  showList: css`
    label: RestaurantPanel-showList;
    position: absolute;
    bottom: max(1rem, env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%);
    z-index: 25;
    border-radius: 99px;
    box-shadow: var(--shadow-floating);
    white-space: nowrap;
  `,
  list: css`
    label: RestaurantPanel-list;
    list-style: none;
    padding: 0;
    margin: 0;
  `,
  desktopLayout: css`
    label: RestaurantPanel-desktopLayout;
    flex: 1;
    min-height: 0;
  `,
  desktopList: css`
    label: RestaurantPanel-desktopList;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    border-right: 1px solid var(--color-border);
  `,
  desktopStores: css`
    label: RestaurantPanel-desktopStores;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem;
  `,
  // 목록 옆 본문 칸은 세로 배치가 아니라서 높이를 직접 채운다.
  desktopMap: css`
    label: RestaurantPanel-desktopMap;
    height: 100%;
  `,
  desktopTitle: css`
    label: RestaurantPanel-desktopTitle;
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
    letter-spacing: -0.035em;
    overflow-wrap: anywhere;
  `,
  sheetContent: css`
    label: RestaurantPanel-sheetContent;
    padding-bottom: env(safe-area-inset-bottom);
  `,
};
export default RestaurantPanel;
