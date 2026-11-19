import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';

import type { CommuteRoute } from '@/features/map/api/commuteRouteApi';

import type { NeighborhoodPreviewContext } from '../hooks/useNeighborhoodPreview';
import NeighborhoodRouteMobilePage from './NeighborhoodRouteMobilePage';

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
  canPickDestination: false,
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
  center: area.center,
  reset: noop,
  regions: [],
  matchedAreaCount: 1,
  selected: area,
  selectRegion: noop,
  zoomResultBy: noop,
  zoomToFacilities: noop,
  selectStation: noop,
  openAreaDetails: noop,
  closeAreaDetails: fn(),
  openListing: () => true,
  toggleMapCategory: () => true,
  focusPoint: noop,
  moveMapTo: noop,
  fitPoints: noop,
  rememberMapBounds: noop,
  rememberSelectionCenter: noop,
  rememberSelectionLevel: noop,
  zoomSelectionBy: noop,
  setMapViewportReader: () => undefined,
};

/** 휴대폰 대중교통 상세. 앱에서는 동네 찾기 화면이 만든 상태(`preview`)와 고른 동네(`area`)를 받아 지도 위를 덮는다. */
const meta = {
  title: '페이지/동네 찾기/휴대폰/NeighborhoodRouteMobilePage',
  component: NeighborhoodRouteMobilePage,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    route: '/neighborhoods/areas/1144069000/details',
  },
  decorators: [
    // 휴대폰에서는 지도 위를 화면 전체로 덮는다.
    (Story) => (
      <div style={{ position: 'relative', height: '100vh' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    preview,
    area,
  },
  argTypes: {
    preview: { control: 'object', description: '동네 찾기 화면이 만든 검색·경로 상태' },
    area: { control: 'object', description: '고른 동네(이름·정류장·시세)' },
  },
} satisfies Meta<typeof NeighborhoodRouteMobilePage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 고른 정류장에서 목적지까지 가는 경로가 보인다. */
export const Default: Story = {};

/** 경로를 불러오는 중이다. */
export const RouteLoading: Story = {
  args: {
    preview: { ...preview, route: undefined, isRouteLoading: true },
  },
};

/** 경로를 못 불러왔고, 동네 시세도 없다. */
export const RouteError: Story = {
  args: {
    preview: {
      ...preview,
      rentPeriod: null,
      routeError: '경로를 불러오지 못했어요. 다른 정류장을 선택해 보세요.',
      route: undefined,
    },
    area: { ...area, rent: null },
  },
};
