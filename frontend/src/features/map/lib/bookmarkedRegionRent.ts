import type { RegionRent, RegionRentTable } from '../api/useBookmarkedRegionRents';
import type { MapRegion, MapRegionCard } from '../model/MapCanvas';

/** 동네 찾기 시트와 같은 문구를 쓴다. */
export const NO_RENT_MESSAGE = '거래가 적어 시세를 내지 않았어요';

const manwon = new Intl.NumberFormat('ko-KR');
const toManwon = (krw: number) => manwon.format(Math.round(krw / 10000));

/** 표에서 동 하나의 시세를 꺼낸다. 아직 모르는 동은 undefined, 거래가 적어 시세가 없는 동은 null이다. */
export const rentOf = (rents: RegionRentTable, code: string): RegionRent | null | undefined =>
  code in rents ? rents[code] : undefined;

/** 이름표에서 동 이름 옆에 붙일 월세 글자. 아직 모르는 동(받는 중, 실패, 응답 밖)은 붙이지 않는다. */
export const rentCaptionOf = (rents: RegionRentTable, code: string): string | undefined => {
  const rent = rentOf(rents, code);
  if (rent === undefined) return undefined;
  return rent ? `월세 ${toManwon(rent.monthlyRentKrw)}만` : '시세 없음';
};

/** 찜한 동네 영역에 월세 글자를 붙인다. 시세가 없으면 원래 영역을 그대로 둬 다시 그리지 않게 한다. */
export const withRentCaptions = (regions: MapRegion[], rents: RegionRentTable): MapRegion[] =>
  regions.map((region) => {
    const caption = rentCaptionOf(rents, region.id);
    return caption === undefined ? region : { ...region, nameCaption: caption };
  });

/** 찜 해제 카드에 붙일 시세 줄. 아직 모르는 동은 줄 없이 `찜 해제하기` 버튼만 둔다. */
export const bookmarkRentCardRows = (rent: RegionRent | null | undefined): Pick<MapRegionCard, 'rows' | 'note'> => {
  if (rent === undefined) return { rows: [] };
  if (rent === null) return { rows: [], note: NO_RENT_MESSAGE };
  return {
    rows: [
      {
        label: '월세 / 보증금',
        value: `${toManwon(rent.monthlyRentKrw)} / ${toManwon(rent.depositKrw)}`,
        tone: 'primary',
      },
      { label: '거래', value: `${manwon.format(rent.transactionCount)}건` },
    ],
    note: '최근 6개월 실거래 중앙값(만원)',
  };
};

/** 휴대폰에서 찜한 동네 안을 눌렀을 때 동작 말풍선 위에 둘 한 줄. 휴대폰은 지도에 이름표가 없어 여기서 알린다. */
export const bookmarkRentNote = (name: string, rent: RegionRent | null | undefined): string | undefined => {
  if (rent === undefined) return undefined;
  if (rent === null) return `${name} 월세 시세 없음`;
  return `${name} 월세 ${toManwon(rent.monthlyRentKrw)} / ${toManwon(rent.depositKrw)}`;
};
