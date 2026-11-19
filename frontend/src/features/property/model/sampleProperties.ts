import { fitCoordinates } from '@/features/map/lib/mapCamera';
import { DEFAULT_MAP_CENTER } from '@/features/map/lib/mapLocation';
import samplePhoto from '@/shared/assets/sample-property-coex.webp';

import { parsePositiveId } from '../lib/propertyFormat';
import type { PropertySummary } from './Property';
import sampleProperties from './sampleProperties.json';

/** JSON의 `photo` 파일 이름을 번들된 이미지 주소로 바꾼다. */
const PHOTO_ASSETS: Record<string, string> = { 'sample-property-coex.webp': samplePhoto };

/** 미리보기 매물의 사진 id. 매물마다 사진이 하나라 1로 둔다. */
export const PREVIEW_PHOTO_ID = 1;

/** 첫 방을 기록하기 전에 보여 주는 미리보기 매물. 방을 하나라도 등록하면 사라진다. id가 음수라 실제 매물과 겹치지 않는다. */
export const SAMPLE_PROPERTIES: PropertySummary[] = sampleProperties.properties.map((property) => {
  const contentUrl = PHOTO_ASSETS[property.photo];
  return {
    ...(property as unknown as PropertySummary),
    representativePhoto:
      contentUrl === undefined
        ? null
        : { photoId: PREVIEW_PHOTO_ID, contentUrl, thumbnailUrl: contentUrl, contentType: 'image/webp' },
  };
});

/** 기록 지도를 처음 열 때의 확대 단계. 매물 하나와 그 주변 동네가 함께 보이는 정도다. */
export const FIRST_MAP_LEVEL = 8;

/**
 * 첫 화면 지도 시점. 기록이 없으면 보이는 미리보기 매물이 모두 들어오게 가운데와 확대 단계를 정한다.
 * 좌표는 미리보기 매물 데이터에서 읽으므로 매물을 바꾸면 시점도 따라간다.
 */
export const SAMPLE_PROPERTIES_VIEW = fitCoordinates(
  SAMPLE_PROPERTIES.flatMap(({ location: { latitude, longitude } }) =>
    latitude === null || longitude === null ? [] : [{ latitude, longitude }],
  ),
  FIRST_MAP_LEVEL,
  DEFAULT_MAP_CENTER,
);

/**
 * 처음 앱을 열었을 때 지도(내 기록, 동네 찾기)의 확대 단계. 예시 매물이 모두 들어오는 단계보다 3단계 가까이 다가가
 * 골목 단위로 보이게 하고, 첫 안내 말풍선이 마커와 겹치지 않을 자리를 낸다.
 */
export const INTRO_MAP_LEVEL = Math.max(3, SAMPLE_PROPERTIES_VIEW.level - 3);

/** 미리보기 매물인지. 서버에 없는 매물이라 상세 데이터는 JSON에서 만들고, 삭제할 때는 기기에서 숨긴다. */
export const isPreviewProperty = (propertyId: number | string): boolean => Number(propertyId) < 0;

/**
 * 목록을 다 받았는데 등록한 매물이 하나도 없으면 미리보기 매물을 대신 돌려준다.
 * 화면은 이 결과를 실제 매물과 똑같이 그리고, 누를 때만 `isPreviewProperty`로 가른다.
 */
export const withPreviewProperties = (
  properties: PropertySummary[],
  isLoaded: boolean,
): { properties: PropertySummary[]; isPreview: boolean } =>
  isLoaded && properties.length === 0
    ? { properties: SAMPLE_PROPERTIES, isPreview: true }
    : { properties, isPreview: false };

/**
 * 매물 주소(`/properties/:propertyId`)의 번호를 읽는다. 실제 매물은 양수만 받고,
 * 미리보기 매물(음수 id)도 같은 화면으로 열 수 있게 받아 준다.
 */
export const parsePropertyRouteId = (raw: string | undefined): number | null => {
  const id = parsePositiveId(raw);
  if (id !== null) return id;
  return raw !== undefined && SAMPLE_PROPERTIES.some((property) => String(property.propertyId) === raw)
    ? Number(raw)
    : null;
};
