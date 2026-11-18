// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  photoFixture,
  propertyDetailResponseFixture,
  propertyPageFixture,
  propertyPhotoResponseFixture,
  propertySummaryFixture,
} from '@/app/mocks/fixtures/propertyFixtures';
import {
  parsePropertyDetail,
  parsePropertyPage,
  parsePropertyPhotoList,
} from '@/features/property/api/propertyParsers';

describe('사진 썸네일 응답 호환성', () => {
  it('사진 목록에서 썸네일을 읽고 누락되면 원본으로 대체한다', () => {
    const photo = propertyPhotoResponseFixture();
    expect(parsePropertyPhotoList({ photos: [photo], totalCount: 1 }).photos[0].thumbnailUrl).toBe(
      photoFixture.thumbnailUrl,
    );
    const { thumbnailUrl, ...legacy } = photo;
    expect(thumbnailUrl).toBeDefined();
    expect(parsePropertyPhotoList({ photos: [legacy], totalCount: 1 }).photos[0].thumbnailUrl).toBe(
      photoFixture.contentUrl,
    );
  });
  it('상세와 목록에서도 누락된 썸네일은 원본 주소를 사용한다', () => {
    const detail = propertyDetailResponseFixture();
    const legacyPhotos = detail.photos.map(({ thumbnailUrl, ...photo }) => {
      expect(thumbnailUrl).toBeDefined();
      return photo;
    });
    const parsed = parsePropertyDetail({ ...detail, photos: legacyPhotos });
    expect(parsed.photoPreview.photos[0].thumbnailUrl).toBe(parsed.photoPreview.photos[0].contentUrl);
    const page = propertyPageFixture([propertySummaryFixture]);
    const representative = page.items[0].representativePhoto;
    if (representative === null) throw new Error('대표 사진 fixture가 필요합니다');
    const { thumbnailUrl, ...legacy } = representative;
    expect(thumbnailUrl).toBeDefined();
    const summary = parsePropertyPage({ ...page, items: [{ ...page.items[0], representativePhoto: legacy }] })
      .content[0];
    expect(summary.representativePhoto?.thumbnailUrl).toBe(legacy.url);
  });
});
