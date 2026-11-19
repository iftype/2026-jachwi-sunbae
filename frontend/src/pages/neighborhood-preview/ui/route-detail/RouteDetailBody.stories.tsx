import type { Meta, StoryObj } from '@storybook/react-webpack5';
import type { ComponentType } from 'react';
import { fn } from 'storybook/test';

import type { CommuteRoute } from '@/features/map/api/commuteRouteApi';

import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import RouteDetailBody from './RouteDetailBody';

const destination = {
  name: '서울특별시청',
  address: '서울특별시 중구 세종대로 110',
  latitude: 37.5663,
  longitude: 126.9779,
};

type Area = NonNullable<NeighborhoodPreviewContext['selected']>;

const area: Area = {
  adminDongCode: '1144069000',
  name: '망원1동',
  fullName: '서울특별시 마포구 망원1동',
  commuteMinutes: 34,
  center: { latitude: 37.5559, longitude: 126.9019 },
  polygons: [],
  simplifiedPolygons: undefined,
  stations: [
    {
      stopId: 'BS_TAGO_11440001',
      stopName: '망원역',
      travelMinutes: 34,
      direction: '합정역 방면',
      latitude: 37.5561,
      longitude: 126.9101,
    },
  ],
  rent: { monthlyRentKrw: 620000, depositKrw: 10000000, transactionCount: 27, legalDongNames: ['망원동', '합정동'] },
};

const route: CommuteRoute = {
  totalMinutes: 34,
  transferCount: 1,
  legs: [
    {
      type: 'BUS',
      routeName: '7016',
      minutes: 12,
      waitMinutes: 4,
      points: [
        { stopId: 'BS_TAGO_11440001', name: '망원역', latitude: 37.5561, longitude: 126.9101 },
        { stopId: 'BS_TAGO_11440020', name: '홍대입구역', latitude: 37.5572, longitude: 126.9245 },
      ],
    },
    {
      type: 'SUBWAY',
      routeName: '2호선',
      minutes: 16,
      waitMinutes: 3,
      points: [
        { stopId: 'SW_239', name: '홍대입구역', latitude: 37.5572, longitude: 126.9245 },
        { stopId: 'SW_201', name: '시청역', latitude: 37.5657, longitude: 126.9769 },
      ],
    },
    {
      type: 'WALK',
      routeName: null,
      minutes: 6,
      waitMinutes: 0,
      points: [
        { stopId: null, name: '시청역', latitude: 37.5657, longitude: 126.9769 },
        { stopId: null, name: '서울특별시청', latitude: 37.5663, longitude: 126.9779 },
      ],
    },
  ],
};

const noop = () => undefined;
const noopAsync = () => Promise.resolve();
const noopRefetch = () => Promise.resolve({} as never);

/** 동네 상세 화면이 상위에서 받는 상태. 이 본문이 읽는 값만 의미 있게 채우고 나머지는 기본값이다. */
const preview: NeighborhoodPreviewContext = {
  isMapSelectionEnabled: false,
  cancelMapSelection: () => undefined,
  hasSubmittedSearch: true,
  hasSearchChanges: false,
  searchPin: null,
  searchTo: noop,
  clearSearchPin: noop,
  setCommuteFromSearchPin: noop,
  cancelEditing: () => undefined,
  editSearch: () => undefined,
  isPublicExplore: false,
  mapPath: '/neighborhoods',
  prefetchBoundaries: noop,
  maxRent: 0,
  changeMaxRent: noop,
  rentPeriod: { startDate: '2026-04-01', endDate: '2026-09-30' },
  isLocating: false,
  locationError: null,
  moveToCurrentLocation: noopAsync,
  missingBoundaryCount: 0,
  topAreas: [area],
  resultAreas: [area],
  selectedStation: area.stations[0],
  route,
  isRouteLoading: false,
  routeError: null,
  retryRoute: noopRefetch,
  isMockData: false,
  leave: noop,
  isChoosingConditions: false,
  editLocation: noop,
  startAnalysis: noop,
  selectionCenter: destination,
  selectionLevel: 6,
  rememberResultCenter: noop,
  rememberResultLevel: noop,
  query: '',
  addressResults: [],
  isSearching: false,
  searchError: null,
  selectAddress: noop,
  changeQuery: noop,
  searchDestination: noopAsync,
  shouldFocusMapSearch: false,
  openMapSearch: noop,
  destination,
  mapCandidate: destination,
  hasChosenMapPoint: true,
  isSelectingOnMap: false,
  openMapSelection: noop,
  chooseMapPoint: noop,
  confirmMapPoint: noop,
  hasPickedDestination: true,
  isAnalyzing: false,
  error: null,
  retry: noopRefetch,
  maxMinutes: 40,
  isValidCommuteTime: true,
  changeMaxMinutes: noop,
  maxTransfers: 1,
  changeMaxTransfers: noop,
  resultLevel: 7,
  center: { ...area.center, level: 7 },
  reset: noop,
  regions: [],
  matchedAreaCount: 1,
  selected: area,
  selectRegion: noop,
  focusRoute: noop,
  zoomResultBy: noop,
  zoomToFacilities: noop,
  selectStation: noop,
  openAreaDetails: noop,
  closeAreaDetails: noop,
  openListing: () => true,
  toggleMapCategory: () => true,
  focusPoint: noop,
  moveMapTo: noop,
  fitPoints: noop,
  rememberSelectionCenter: noop,
  rememberSelectionLevel: noop,
  zoomSelectionBy: noop,
  setMapViewportReader: () => undefined,
};

/** 이 본문이 `preview`에서 읽는 값만 컨트롤로 펼친다. 나머지는 위 기본값을 그대로 쓴다. */
type StoryArgs = Pick<
  NeighborhoodPreviewContext,
  'rentPeriod' | 'route' | 'isRouteLoading' | 'routeError' | 'retryRoute' | 'isPublicExplore' | 'openListing'
> & { area: Area };

const meta = {
  title: '페이지/동네 찾기/공통/RouteDetailBody',
  // 컨트롤은 preview를 펼친 값으로 받아 render에서 다시 묶는다. props 모양이 달라 타입만 맞춰 주고, 문서는 실제 컴포넌트에서 읽는다.
  component: RouteDetailBody as unknown as ComponentType<StoryArgs>,
  parameters: {
    controls: { exclude: ['preview', 'className', 'ref'] },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '24rem' }}>
        <Story />
      </div>
    ),
  ],
  render: ({ area: storyArea, ...overrides }) => (
    <RouteDetailBody area={storyArea} preview={{ ...preview, ...overrides }} />
  ),
  argTypes: {
    area: { control: 'object', description: '선택한 동네. rent가 null이면 시세 대신 거래가 적다는 안내를 보여준다.' },
    rentPeriod: { control: 'object', description: '시세를 낸 계약 기간. null이면 기간 줄을 숨긴다.' },
    route: { control: 'object', description: '출발 정류장에서 목적지까지 대중교통 경로' },
    isRouteLoading: { description: '경로를 불러오는 중인지' },
    routeError: { control: 'text', description: '경로를 불러오지 못했을 때 문구' },
    isPublicExplore: { description: '로그인 없이 둘러보는 중인지. `이 동네에서 본 방 기록하기` 버튼이 함께 나온다.' },
    retryRoute: { description: '경로 다시 불러오기' },
    openListing: { description: '매물 보기 열기' },
  },
  args: {
    area,
    rentPeriod: preview.rentPeriod,
    route,
    isRouteLoading: false,
    routeError: null,
    isPublicExplore: false,
    retryRoute: fn(noopRefetch),
    openListing: fn(() => true),
  },
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RouteLoading: Story = {
  args: {
    route: undefined,
    isRouteLoading: true,
  },
};

export const WithoutRent: Story = {
  args: {
    rentPeriod: null,
    routeError: '경로를 불러오지 못했어요. 다른 정류장을 선택해 보세요.',
    route: undefined,
    area: { ...area, rent: null },
  },
};

export const PublicExplore: Story = {
  args: {
    isPublicExplore: true,
  },
};
