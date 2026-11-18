import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';

import { setAuthentication } from '@/features/auth/model/authStore';
import { propertyQueryKeys } from '@/features/property/api/propertyQueryKeys';
import { useAuthenticatedPhoto } from '@/features/property/api/useAuthenticatedPhoto';
import usePropertyMarkerPhotos from '@/features/property/hooks/usePropertyMarkerPhotos';
import { SAMPLE_PROPERTIES } from '@/features/property/model/sampleProperties';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../../server';

const wrapper = ({ children }: { children: ReactNode }) => (
  <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </PublicConfigProvider>
);

it('실제 매물 마커는 인증된 썸네일을 받고 원본 캐시와 구분한다', async () => {
  setAuthentication({ accessToken: 'marker-token', tokenType: 'Bearer', expiresIn: 60 });
  const thumbnail = vi.fn();
  server.use(
    http.get('http://localhost:8080/api/properties/10/photos/81/thumbnail', ({ request }) => {
      expect(request.headers.get('Authorization')).toBe('Bearer marker-token');
      thumbnail();
      return new HttpResponse(new Uint8Array([4, 5]), { headers: { 'Content-Type': 'image/jpeg' } });
    }),
  );
  const original = new Blob(['original']);
  queryClient.setQueryData(propertyQueryKeys.photoContent(10, 81), original);
  const records = [
    {
      id: 10,
      latitude: 37.5,
      longitude: 127,
      representativePhoto: {
        photoId: 81,
        contentUrl: '/api/properties/10/photos/81',
        thumbnailUrl: '/api/properties/10/photos/81/thumbnail',
      },
    },
  ];
  const { result, unmount } = renderHook(() => usePropertyMarkerPhotos(records), { wrapper });
  await waitFor(() => expect(result.current.get('10')).toMatch(/^blob:test-photo-/));
  expect(thumbnail).toHaveBeenCalledOnce();
  expect(queryClient.getQueryData(propertyQueryKeys.photoContent(10, 81))).toBe(original);
  expect(queryClient.getQueryData(propertyQueryKeys.photoContent(10, 81, 'thumbnail'))).toEqual(
    expect.objectContaining({ size: 2, type: 'image/jpeg' }),
  );
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});

it('미리보기 사진은 인증 없이 로컬 이미지를 받아 카드와 지도에서 함께 표시한다', async () => {
  const property = SAMPLE_PROPERTIES[0];
  const photo = property.representativePhoto;
  if (photo === null) throw new Error('미리보기 대표 사진이 필요합니다.');
  expect(photo.thumbnailUrl).toBe(photo.contentUrl);
  const preview = vi.fn();
  server.use(
    http.get(new URL(photo.thumbnailUrl, window.location.href).href, ({ request }) => {
      expect(request.headers.get('Authorization')).toBeNull();
      preview();
      return new HttpResponse(new Uint8Array([4, 5]), { headers: { 'Content-Type': 'image/webp' } });
    }),
  );
  const records = [{ id: property.propertyId, ...property.location, representativePhoto: photo }];
  const { result } = renderHook(
    () => ({
      markers: usePropertyMarkerPhotos(records),
      card: useAuthenticatedPhoto(property.propertyId, photo.photoId, photo.thumbnailUrl, 'thumbnail'),
    }),
    { wrapper },
  );
  await waitFor(() => {
    expect(result.current.markers.get(String(property.propertyId))).toMatch(/^blob:test-photo-/);
    expect(result.current.card.objectUrl).toMatch(/^blob:test-photo-/);
  });
  expect(preview).toHaveBeenCalledOnce();
});
