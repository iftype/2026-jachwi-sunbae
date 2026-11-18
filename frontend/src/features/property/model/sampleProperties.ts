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
