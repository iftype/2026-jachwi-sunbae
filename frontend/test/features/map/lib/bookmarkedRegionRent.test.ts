import { describe, expect, it } from 'vitest';

import {
  bookmarkRentCardRows,
  bookmarkRentNote,
  NO_RENT_MESSAGE,
  rentCaptionOf,
  withRentCaptions,
} from '@/features/map/lib/bookmarkedRegionRent';
import type { MapRegion } from '@/features/map/model/MapCanvas';

const rent = { monthlyRentKrw: 700_000, depositKrw: 10_000_000, transactionCount: 572 };
const rents = { '11230640': rent, '11140550': null };

describe('찜한 동네 이름표의 월세 글자', () => {
  it('시세가 있으면 만원 단위 월세, 거래가 적으면 시세 없음, 모르는 동은 붙이지 않는다', () => {
    expect(rentCaptionOf(rents, '11230640')).toBe('월세 70만');
    expect(rentCaptionOf(rents, '11140550')).toBe('시세 없음');
    expect(rentCaptionOf(rents, '41135550')).toBeUndefined();
  });

  it('모르는 동의 영역은 그대로 둬 다시 그리지 않는다', () => {
    const regions: MapRegion[] = [
      { id: '11230640', name: '역삼1동', paths: [], showsName: true },
      { id: '41135550', name: '정자동', paths: [], showsName: true },
    ];
    const next = withRentCaptions(regions, rents);
    expect(next[0].nameCaption).toBe('월세 70만');
    expect(next[1]).toBe(regions[1]);
  });
});

describe('찜 해제 카드의 시세 줄', () => {
  it('월세와 보증금, 거래 건수를 적는다', () => {
    expect(bookmarkRentCardRows(rent)).toEqual({
      rows: [
        { label: '월세 / 보증금', value: '70 / 1,000', tone: 'primary' },
        { label: '거래', value: '572건' },
      ],
      note: '최근 6개월 실거래 중앙값(만원)',
    });
  });

  it('거래가 적은 동은 동네 찾기와 같은 문구를 적는다', () => {
    expect(bookmarkRentCardRows(null)).toEqual({ rows: [], note: NO_RENT_MESSAGE });
    expect(NO_RENT_MESSAGE).toBe('거래가 적어 시세를 내지 않았어요');
  });

  it('받는 중이거나 실패하면 줄 없이 찜 해제 버튼만 남긴다', () => {
    expect(bookmarkRentCardRows(undefined)).toEqual({ rows: [] });
  });
});

describe('휴대폰 동작 말풍선의 시세 한 줄', () => {
  it('동 이름과 월세, 보증금을 한 줄로 적는다', () => {
    expect(bookmarkRentNote('역삼1동', rent)).toBe('역삼1동 월세 70 / 1,000');
    expect(bookmarkRentNote('역삼1동', null)).toBe('역삼1동 월세 시세 없음');
    expect(bookmarkRentNote('역삼1동', undefined)).toBeUndefined();
  });
});
