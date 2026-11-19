import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { success } from '@/app/mocks/mockStore';
import PropertyNearbyPreview from '@/pages/property-detail/ui/property-nearby-preview/PropertyNearbyPreview';
import { FacilityFocusProvider } from '@/features/map/hooks/useFacilityFocus';
import useInfrastructureLayer from '@/features/map/hooks/useInfrastructureLayer';
import MapCategoryRail from '@/features/map/ui/map-category-rail/MapCategoryRail';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../server';

const CENTER = { latitude: 37.4841, longitude: 126.9291 };

const place = (providerPlaceId: string, category: string, distanceMeters: number) => ({
  providerPlaceId,
  name: providerPlaceId,
  category,
  address: '서울 관악구',
  ...CENTER,
  distanceMeters,
});

beforeEach(() => {
  server.use(
    http.get('*/api/maps/nearby', () =>
      success({
        center: CENTER,
        radius: 500,
        counts: { HOSPITAL: 1, SCHOOL: 0, CONVENIENCE: 1, AGENCY: 1 },
        places: [place('c1', 'CONVENIENCE', 120), place('h1', 'HOSPITAL', 250), place('a1', 'AGENCY', 80)],
      }),
    ),
    http.get('*/api/maps/bus-stops', () =>
      success({
        center: CENTER,
        radius: 500,
        count: 1,
        busStops: [{ nodeId: 's1', name: '정류장', ...CENTER, distanceMeters: 90 }],
      }),
    ),
  );
});
afterEach(() => queryClient.clear());

/** 지도 화면의 분류 막대. 실제 막대(InfrastructureMap)와 같은 훅과 같은 막대 컴포넌트를 쓴다. */
const Rail = () => {
  const layer = useInfrastructureLayer(true, null, 0, 0);
  return (
    <MapCategoryRail
      showIcons={false}
      hiddenCategories={['SCHOOL']}
      selectedCategories={layer.category ? [layer.category] : []}
      onToggle={(category) => {
        if (category !== 'MEMO' && category !== 'SCHOOL') layer.selectCategory(category);
      }}
    />
  );
};

const renderScreen = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
        <FacilityFocusProvider>
          <Rail />
          <PropertyNearbyPreview propertyId={10} {...CENTER} showMap={false} />
        </FacilityFocusProvider>
      </PublicConfigProvider>
    </QueryClientProvider>,
  );

const railButton = (name: RegExp) =>
  within(screen.getByRole('complementary', { name: '지도 시설 카테고리' })).getByRole('button', { name });

it('요약 카드와 지도 막대가 같은 이름과 순서로 분류를 보인다', async () => {
  renderScreen();
  const legend = within(await screen.findByRole('list', { name: '500m 안 시설 수' }));
  const rail = within(screen.getByRole('complementary', { name: '지도 시설 카테고리' }));

  expect(legend.getAllByRole('button').map((button) => button.querySelector('span:nth-child(2)')?.textContent)).toEqual(
    ['교통', '편의점', '병원', '중개업소'],
  );
  expect(rail.getAllByRole('button').map((button) => button.textContent)).toEqual(['교통', '편의점', '병원', '중개사']);
});

it('요약 카드의 행을 누르면 지도 막대의 같은 분류가 켜지고, 다시 누르면 꺼진다', async () => {
  const user = userEvent.setup();
  renderScreen();
  const legend = within(await screen.findByRole('list', { name: '500m 안 시설 수' }));

  await user.click(legend.getByRole('button', { name: /병원/ }));
  expect(railButton(/^병원/)).toHaveAttribute('aria-pressed', 'true');
  expect(railButton(/^교통/)).toHaveAttribute('aria-pressed', 'false');

  await user.click(legend.getByRole('button', { name: /병원/ }));
  expect(railButton(/^병원/)).toHaveAttribute('aria-pressed', 'false');
});

it('지도 막대에서 분류를 고르면 요약 카드는 그 행만 강조하고 나머지는 흐리게 한다', async () => {
  const user = userEvent.setup();
  renderScreen();
  const legend = within(await screen.findByRole('list', { name: '500m 안 시설 수' }));

  await user.click(railButton(/^편의점/));
  expect(legend.getByRole('button', { name: /편의점/ })).toHaveAttribute('aria-pressed', 'true');
  expect(legend.getByRole('button', { name: /병원/ }).closest('li')).toHaveAttribute('data-dimmed', 'true');
  expect(legend.getByRole('button', { name: /편의점/ }).closest('li')).not.toHaveAttribute('data-dimmed');

  await user.click(railButton(/^편의점/));
  expect(legend.getByRole('button', { name: /편의점/ })).toHaveAttribute('aria-pressed', 'false');
  expect(legend.getByRole('button', { name: /병원/ }).closest('li')).not.toHaveAttribute('data-dimmed');
});
