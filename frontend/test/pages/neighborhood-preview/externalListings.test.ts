import { expect, it } from 'vitest';

import { dabangListingUrl } from '@/pages/neighborhood-preview/model/externalListings';

it('동네 중심 좌표를 다방 원·투룸 지도 주소로 만든다', () => {
  expect(dabangListingUrl({ latitude: 37.5006, longitude: 127.0364 })).toBe(
    'https://www.dabangapp.com/map/onetwo?m_lat=37.5006&m_lng=127.0364&m_zoom=15',
  );
});

it('좌표가 올바르지 않으면 다방 지도 기본 화면으로 연다', () => {
  expect(dabangListingUrl({ latitude: Number.NaN, longitude: 127.0364 })).toBe('https://www.dabangapp.com/map/onetwo');
});

it('모바일 폭에서는 다방 모바일 지도 주소로 바로 연다', () => {
  expect(dabangListingUrl({ latitude: 37.5006, longitude: 127.0364 }, 'mobile')).toBe(
    'https://www.dabangapp.com/mobile/map/onetwo?m_lat=37.5006&m_lng=127.0364&m_zoom=15',
  );
  expect(dabangListingUrl({ latitude: Number.NaN, longitude: 127 }, 'mobile')).toBe(
    'https://www.dabangapp.com/mobile/map/onetwo',
  );
});
