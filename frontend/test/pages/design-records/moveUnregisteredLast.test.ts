import { describe, expect, it } from 'vitest';

import { moveUnregisteredLast } from '@/pages/design-records/model/recordPresentation';
import type { PropertySummary } from '@/features/property/model/Property';

const record = (
  id: string,
  address: string | null,
  latitude: number | null = 37.5,
  longitude: number | null = 127,
) => ({
  id,
  latitude,
  longitude,
  note: address ?? '주소 미등록',
  summary: { location: { address, latitude, longitude } } as unknown as PropertySummary,
});

describe('주소 미등록 기록을 맨 뒤로 보내는 정렬', () => {
  it('주소 있는 기록의 순서와 미등록 기록끼리의 순서를 그대로 두고 미등록을 뒤로 모은다', () => {
    const input = [
      record('a1', '서울 강남구'),
      record('u1', null, null, null),
      record('a2', '서울 서초구'),
      record('u2', null, null, null),
      record('a3', '서울 송파구'),
    ];
    expect(moveUnregisteredLast(input).map((item) => item.id)).toEqual(['a1', 'a2', 'a3', 'u1', 'u2']);
  });

  it('주소는 있어도 위치(좌표)가 없으면 미등록으로 본다', () => {
    const input = [record('noCoord', '서울 강남구', null, null), record('ok', '서울 서초구')];
    expect(moveUnregisteredLast(input).map((item) => item.id)).toEqual(['ok', 'noCoord']);
  });

  it('전부 주소가 있거나 전부 없으면 순서가 바뀌지 않는다', () => {
    const allAddressed = [record('x', '서울'), record('y', '부산')];
    expect(moveUnregisteredLast(allAddressed).map((item) => item.id)).toEqual(['x', 'y']);
    const allMissing = [record('p', null, null, null), record('q', '', null, null)];
    expect(moveUnregisteredLast(allMissing).map((item) => item.id)).toEqual(['p', 'q']);
  });
});
