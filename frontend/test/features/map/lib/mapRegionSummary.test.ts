import { fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { createRegionSummaryElement, regionLabelPosition } from '@/features/map/lib/mapRegionSummary';
import type { MapRegion } from '@/features/map/model/MapCanvas';

const region: MapRegion = {
  id: 'sample',
  name: '샘플동',
  summary: { travel: '18분 · 0회', price: '75만원' },
  paths: [
    [
      { latitude: 37, longitude: 127 },
      { latitude: 37, longitude: 129 },
      { latitude: 39, longitude: 129 },
      { latitude: 39, longitude: 127 },
      { latitude: 37, longitude: 127 },
    ],
  ],
};

it('닫힌 경계의 중복 끝점을 제외해 라벨 기준 좌표를 만든다', () => {
  expect(regionLabelPosition(region)).toEqual({ latitude: 38, longitude: 128 });
});

it('이동 시간과 월세 시세를 두 칸으로 표시하고 클릭 시 동네를 선택한다', () => {
  const onSelect = vi.fn();
  const button = createRegionSummaryElement(region, true, onSelect);
  expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(button.querySelectorAll('b')).toHaveLength(2);
  expect(button).toHaveTextContent('18분 · 0회');
  expect(button).toHaveTextContent('75만원');
  fireEvent.click(button);
  expect(onSelect).toHaveBeenCalledOnce();
});

it('요약 데이터가 없으면 임의의 가격 줄을 표시하지 않는다', () => {
  const button = createRegionSummaryElement({ ...region, summary: undefined }, false, vi.fn());
  expect([...button.querySelectorAll('b')].map((cell) => cell.textContent)).toEqual([]);
});
it('거리 요약만 있으면 평균가 줄을 표시하지 않는다', () => {
  const button = createRegionSummaryElement({ ...region, summary: { travel: '25분' } }, false, () => {});
  expect(button.textContent).toContain('25분');
  expect(button.textContent).not.toContain('월세 시세');
});
