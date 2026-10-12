import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expect, it } from 'vitest';

import { propertySummaryFixture } from '@/app/mocks/fixtures/propertyFixtures';
import PropertyCard from '@/features/property/ui/property-card/PropertyCard';

const Destination = () => {
  const { state } = useLocation();
  return <output aria-label="복귀 화면">{JSON.stringify(state)}</output>;
};

it.each(['사진', '정보'])('지도 카드의 %s을 눌러도 상세에 지도 복귀 정보를 전달한다', async (target) => {
  const property = {
    ...propertySummaryFixture,
    discoverySource: { type: 'URL' as const, value: propertySummaryFixture.discoverySource.value },
    representativePhoto: null,
    photoUrls: [],
    photos: [],
  };
  render(
    <MemoryRouter initialEntries={['/map']}>
      <Routes>
        <Route path="/map" element={<PropertyCard property={property} returnTo="/map" />} />
        <Route path="/properties/:propertyId" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(
    target === '사진'
      ? screen.getByRole('img', { name: '등록된 사진 없음' })
      : screen.getByRole('link', { name: property.name }),
  );
  expect(screen.getByLabelText('복귀 화면')).toHaveTextContent('{"returnTo":"/map"}');
});
