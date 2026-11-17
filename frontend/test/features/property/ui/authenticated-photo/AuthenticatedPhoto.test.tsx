import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { setAuthentication } from '@/features/auth/model/authStore';
import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import { server } from '../../../../server';

const config: PublicConfig = {
  apiBaseUrl: 'http://localhost:8080',
};

describe('인증 사진 표시', () => {
  it('Bearer로 Blob을 읽어 Object URL로 표시하고 unmount에서 해제한다', async () => {
    setAuthentication({ accessToken: 'photo-token', tokenType: 'Bearer', expiresIn: 60 });
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10/photos/81`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer photo-token');
        return new HttpResponse(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } });
      }),
    );

    const rendered = render(
      <PublicConfigProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <AuthenticatedPhoto
            propertyId={10}
            photoId={81}
            contentUrl="/api/properties/10/photos/81"
            alt="업로드 순 1번째 사진"
          />
        </QueryClientProvider>
      </PublicConfigProvider>,
    );

    const image = await screen.findByRole('img', { name: '업로드 순 1번째 사진' });
    expect(image).toHaveAttribute('src', expect.stringMatching(/^blob:test-photo-/));
    expect(document.body.innerHTML).not.toContain('photo-token');
    expect(document.body.innerHTML).not.toContain('/api/properties/10/photos/81');

    rendered.unmount();
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalled());
    expect(vi.mocked(URL.createObjectURL)).toHaveBeenCalledOnce();
  });

  it('같은 사진의 원본과 썸네일을 동시에 인증 요청하고 별도로 캐시한다', async () => {
    setAuthentication({ accessToken: 'photo-token', tokenType: 'Bearer', expiresIn: 60 });
    const original = vi.fn();
    const thumbnail = vi.fn();
    server.use(
      ...[
        { suffix: '', spy: original, bytes: [1, 2, 3] },
        { suffix: '/thumbnail', spy: thumbnail, bytes: [4, 5] },
      ].map(({ suffix, spy, bytes }) =>
        http.get(`${config.apiBaseUrl}/api/properties/10/photos/81${suffix}`, ({ request }) => {
          expect(request.headers.get('Authorization')).toBe('Bearer photo-token');
          spy();
          return new HttpResponse(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/jpeg' } });
        }),
      ),
    );
    render(
      <PublicConfigProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <AuthenticatedPhoto propertyId={10} photoId={81} contentUrl="/api/properties/10/photos/81" alt="원본" />
          <AuthenticatedPhoto
            propertyId={10}
            photoId={81}
            kind="thumbnail"
            contentUrl="/api/properties/10/photos/81/thumbnail"
            alt="썸네일"
          />
        </QueryClientProvider>
      </PublicConfigProvider>,
    );
    await screen.findByRole('img', { name: '원본' });
    await screen.findByRole('img', { name: '썸네일' });
    expect(original).toHaveBeenCalledOnce();
    expect(thumbnail).toHaveBeenCalledOnce();
    expect(screen.getByAltText('원본').getAttribute('src')).not.toBe(screen.getByAltText('썸네일').getAttribute('src'));
  });

  it('사진 읽기 실패를 접근 가능한 대체 상태와 재시도로 표시한다', async () => {
    setAuthentication({ accessToken: 'photo-token', tokenType: 'Bearer', expiresIn: 60 });
    let attempts = 0;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10/photos/81`, () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ code: 'PHOTO_READ_FAILED', message: 'internal', errors: [] }, { status: 500 })
          : new HttpResponse(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } });
      }),
    );

    render(
      <PublicConfigProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <AuthenticatedPhoto
            propertyId={10}
            photoId={81}
            contentUrl="/api/properties/10/photos/81"
            alt="업로드 순 1번째 사진"
          />
        </QueryClientProvider>
      </PublicConfigProvider>,
    );

    expect(await screen.findByRole('group', { name: '업로드 순 1번째 사진 불러오기 실패' })).toBeInTheDocument();
    screen.getByRole('button', { name: '다시 시도' }).click();
    expect(await screen.findByRole('img', { name: '업로드 순 1번째 사진' })).toBeInTheDocument();
  });
});
