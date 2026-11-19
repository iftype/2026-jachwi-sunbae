import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NearbyAgency } from '../../model/Map';
import type { MapCanvasProps } from '../../model/MapCanvas';
import MapCoordinateMenu from '../map-coordinate-menu/MapCoordinateMenu';
import InfrastructureMap from './InfrastructureMap';

const focus = vi.hoisted(() => ({ category: 'AGENCY' as string | null }));
const places = vi.hoisted(() => ({ agencies: [] as unknown[], busStops: [] as unknown[] }));

vi.mock('../../hooks/useFacilityFocus', () => ({ default: () => [focus.category, vi.fn()] }));
vi.mock('../../api/useViewportPlaces', () => ({
  useViewportPlaces: () => ({
    agencies: places.agencies,
    busStops: places.busStops,
    agenciesFailed: false,
    busStopsFailed: false,
  }),
}));
vi.mock('../../hooks/useViewportFacilityLayer', () => ({
  default: () => ({ places: [], isError: false }),
}));
vi.mock('@/shared/lib/hooks/useIsDesktop', () => ({ default: () => true }));
vi.mock('../map-category-rail/MapCategoryRail', () => ({ default: () => null }));
vi.mock('../map-canvas/MapCanvasSurface', () => ({
  default: (props: MapCanvasProps) => (
    <div>
      {props.markers?.map((marker) => (
        <button key={marker.id} type="button" onClick={() => props.onSelectMarker?.(marker)}>
          {`마커 ${marker.label}`}
        </button>
      ))}
      <button type="button" onClick={() => props.onSelectLocation?.(37.5, 127)}>
        지도 빈 곳
      </button>
      {props.coordinateMenu && <MapCoordinateMenu menu={props.coordinateMenu} />}
    </div>
  ),
}));

const agency = (id: string, name: string, phone: string | null): NearbyAgency => ({
  providerPlaceId: id,
  name,
  address: `${name} 주소`,
  latitude: 37.5,
  longitude: 127,
  distanceMeters: 100,
  phone,
  placeUrl: null,
});

const mapProps: MapCanvasProps = {
  center: { latitude: 37.5, longitude: 127 },
  level: 4,
  selectedMarkerId: 'property-1',
  markers: [{ id: 'property-1', label: '매물', latitude: 37.5, longitude: 127, tone: 'property' }],
};

const renderMap = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <InfrastructureMap mapProps={mapProps} open onClose={vi.fn()} />
    </QueryClientProvider>,
  );

describe('InfrastructureMap 시설 마커 말풍선', () => {
  beforeEach(() => {
    focus.category = 'AGENCY';
    places.agencies = [agency('a', '강남공인', '02-123-4567'), agency('b', '역삼공인', null)];
    places.busStops = [];
  });

  it('시설 마커를 눌러도 정보 카드는 뜨지 않고 이름만 말풍선으로 보인다', async () => {
    renderMap();
    fireEvent.click(await screen.findByRole('button', { name: '마커 역삼공인' }));
    expect(screen.queryByLabelText('시설 정보 카드')).toBeNull();
    expect(screen.getByRole('menu', { name: '역삼공인' })).toHaveTextContent('역삼공인');
    expect(screen.queryByText('역삼공인 주소')).toBeNull();
  });

  it('중개업소는 전화번호가 있을 때만 전화 링크를 보인다', async () => {
    renderMap();
    fireEvent.click(await screen.findByRole('button', { name: '마커 강남공인' }));
    expect(screen.getByRole('menuitem', { name: '강남공인 전화걸기' })).toHaveAttribute('href', 'tel:02-123-4567');
    fireEvent.click(screen.getByRole('button', { name: '마커 역삼공인' }));
    expect(screen.queryByRole('menuitem', { name: /전화걸기/ })).toBeNull();
  });

  it('중개업소가 아닌 시설은 전화 링크 없이 이름만 보인다', async () => {
    focus.category = 'TRANSPORT';
    places.agencies = [];
    places.busStops = [{ nodeId: 'n', name: '강남역', latitude: 37.5, longitude: 127, phone: '02-000-0000' }];
    renderMap();
    fireEvent.click(await screen.findByRole('button', { name: '마커 강남역' }));
    expect(screen.getByRole('menu', { name: '강남역' })).toHaveTextContent('강남역');
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('다른 마커를 누르면 말풍선이 교체되고 같은 마커를 다시 누르면 닫힌다', async () => {
    renderMap();
    fireEvent.click(await screen.findByRole('button', { name: '마커 강남공인' }));
    fireEvent.click(screen.getByRole('button', { name: '마커 역삼공인' }));
    expect(screen.queryByRole('menu', { name: '강남공인' })).toBeNull();
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '마커 역삼공인' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('지도 빈 곳을 누르면 말풍선이 닫힌다', async () => {
    renderMap();
    fireEvent.click(await screen.findByRole('button', { name: '마커 강남공인' }));
    fireEvent.click(screen.getByRole('button', { name: '지도 빈 곳' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
