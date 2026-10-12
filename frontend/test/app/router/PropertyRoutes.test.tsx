import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import {
  errorEnvelope,
  memberFixture,
  photoFixture,
  propertyDetailFixture,
  propertyDetailResponseFixture,
  propertyPageFixture,
  propertyPhotoResponseFixture,
  propertySummaryFixture,
  secondPropertySummaryFixture,
  successEnvelope,
} from '@/app/mocks/fixtures/propertyFixtures';
import AppRoutes from '@/app/router/AppRoutes';
import { setAuthentication } from '@/features/auth/model/authStore';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import { server } from '../../server';

const config: PublicConfig = {
  apiBaseUrl: 'http://localhost:8080',
};

const detailWithoutPhotosFixture = {
  ...propertyDetailFixture,
  photoCount: 0,
  photoPreview: { totalCount: 0, photos: [] },
};
const detailWithoutPhotos = propertyDetailResponseFixture(detailWithoutPhotosFixture);

const renderAuthenticated = (path: string, state?: unknown) => {
  setAuthentication({ accessToken: 'memory-token', tokenType: 'Bearer', expiresIn: 60 });
  server.use(http.get(`${config.apiBaseUrl}/api/members/me`, () => HttpResponse.json(successEnvelope(memberFixture))));

  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{ pathname: path, state }]}>
          <PublicConfigProvider config={config}>
            <AppRoutes />
          </PublicConfigProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
};

it.each([
  [{ returnTo: '/map' }, '매물 지도로 돌아가기', '/map'],
  [undefined, '매물 목록으로 돌아가기', '/properties'],
  [{ returnTo: 'https://other.example' }, '매물 목록으로 돌아가기', '/properties'],
])('상세의 돌아가기 목적지는 진입 화면을 따르고 외부 주소는 허용하지 않는다 (%j)', async (state, label, href) => {
  server.use(
    http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
  );
  renderAuthenticated('/properties/10', state);
  expect(await screen.findByRole('link', { name: label as string })).toHaveAttribute('href', href);
});

describe('FE-2 매물 목록', () => {
  it('매물 0개와 검색 결과 없음을 구분한다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, () =>
        HttpResponse.json(successEnvelope(propertyPageFixture([]))),
      ),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties');

    expect(await screen.findByText('아직 등록한 매물이 없어요.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: '매물 이름 검색' }), '없는 매물{Enter}');
    expect(await screen.findByText('검색 결과가 없어요.')).toBeInTheDocument();
  });

  it('매물 진행 현황을 표시하고 상태별로 필터링한다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, () =>
        HttpResponse.json(successEnvelope(propertyPageFixture([propertySummaryFixture, secondPropertySummaryFixture]))),
      ),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties');

    expect(await screen.findByRole('link', { name: '신림역 원룸' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '망원동 투룸' })).toBeInTheDocument();
    const firstProperty = within(screen.getByRole('link', { name: '신림역 원룸' }));
    expect(firstProperty.queryByText('미완료')).not.toBeInTheDocument();
    expect(firstProperty.queryByText('체크리스트')).not.toBeInTheDocument();
    expect(firstProperty.getByText('8/12')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '완료' }));
    expect(screen.queryByRole('link', { name: '신림역 원룸' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '망원동 투룸' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '미완료' }));
    expect(screen.getByRole('link', { name: '신림역 원룸' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '망원동 투룸' })).not.toBeInTheDocument();
  });

  it('전체 개수와 서버가 반환한 순서를 목록에 반영한다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, () =>
        HttpResponse.json(successEnvelope(propertyPageFixture([propertySummaryFixture, secondPropertySummaryFixture]))),
      ),
    );
    renderAuthenticated('/properties');

    expect(
      await screen.findByText((_, element) => element?.tagName === 'SPAN' && element.textContent === '전체 2'),
    ).toBeInTheDocument();
    const list = screen.getByRole('region', { name: '매물 목록' });
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label')),
    ).toEqual(['신림역 원룸', '망원동 투룸']);
  });

  it('검색은 목록을 다시 요청하지 않고 받아온 매물 이름을 기준으로 적용한다', async () => {
    let listCalls = 0;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, () => {
        listCalls += 1;
        return HttpResponse.json(
          successEnvelope(propertyPageFixture([propertySummaryFixture, secondPropertySummaryFixture])),
        );
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties');
    await screen.findByRole('link', { name: '신림역 원룸' });
    const callsAfterInitialLoad = listCalls;
    const searchbox = await screen.findByRole('textbox', { name: '매물 이름 검색' });

    await user.type(searchbox, '  망원  ');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('link', { name: '망원동 투룸' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '신림역 원룸' })).not.toBeInTheDocument();
    expect(listCalls).toBe(callsAfterInitialLoad);
  });

  it('최초 목록 실패 후 재시도할 수 있다', async () => {
    let shouldFail = true;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, () => {
        return shouldFail
          ? HttpResponse.error()
          : HttpResponse.json(successEnvelope(propertyPageFixture([propertySummaryFixture])));
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties');

    expect(await screen.findByText('매물 목록을 불러오지 못했어요.')).toBeInTheDocument();
    shouldFail = false;
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('link', { name: '신림역 원룸' })).toBeInTheDocument();
  });
});

describe('FE-2 매물 비교 PDF', () => {
  it('비교 화면 진입을 한 번 기록한다', async () => {
    let comparisonViewCalls = 0;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, () =>
        HttpResponse.json(successEnvelope(propertyPageFixture([propertySummaryFixture, secondPropertySummaryFixture]))),
      ),
      http.post(`${config.apiBaseUrl}/api/properties/comparison-views`, () => {
        comparisonViewCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderAuthenticated('/compare');

    expect(await screen.findByRole('heading', { name: '함께 볼 매물을 골라 주세요.' })).toBeInTheDocument();
    await waitFor(() => expect(comparisonViewCalls).toBe(1));
  });

  it('2~5개 매물을 선택한 뒤 저장 기록 PDF를 요청한다', async () => {
    let requestedIds: unknown;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, () =>
        HttpResponse.json(successEnvelope(propertyPageFixture([propertySummaryFixture, secondPropertySummaryFixture]))),
      ),
      http.post(`${config.apiBaseUrl}/api/properties/export.pdf`, async ({ request }) => {
        requestedIds = await request.json();
        return new HttpResponse(new Uint8Array([37, 80, 68, 70]), {
          headers: { 'Content-Type': 'application/pdf' },
        });
      }),
    );
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:comparison');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderAuthenticated('/compare');

    expect(await screen.findByRole('heading', { name: '함께 볼 매물을 골라 주세요.' })).toBeInTheDocument();
    await user.click(await screen.findByRole('checkbox', { name: /신림역 원룸/ }));
    await user.click(screen.getByRole('checkbox', { name: /망원동 투룸/ }));
    await user.click(screen.getByRole('button', { name: '선택한 2개 PDF 받기' }));

    await waitFor(() => expect(requestedIds).toEqual({ propertyIds: [10, 11] }));
    expect(createObjectUrl).toHaveBeenCalledWith(expect.objectContaining({ type: 'application/pdf' }));
    expect(click).toHaveBeenCalledOnce();
    await waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledWith('blob:comparison'));
  });
});

describe('FE-2 등록·수정·메모', () => {
  it('등록 필수값을 검증하고 성공 후 생성된 상세로 이동한다', async () => {
    let requestBody: unknown;
    server.use(
      http.post(`${config.apiBaseUrl}/api/properties`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          successEnvelope({
            id: 10,
            name: '신림역 원룸',
            depositAmount: 0,
            monthlyRentAmount: 550_000,
            discoverySource: '중개사 추천',
            address: '서울 관악구 신림로 12길 3',
            latitude: 37.3948,
            longitude: 127.1119,
            availableMoveInDate: null,
            maintenanceFeeAmount: null,
            visitScheduledAt: null,
            roomOptions: [],
            utilityOptions: [],
            photos: [],
            overallProgress: {
              totalCount: 0,
              completedCount: 0,
              goodCount: 0,
              cautionCount: 0,
              unconfirmedCount: 0,
              progressRate: 0,
            },
          }),
          { status: 201 },
        );
      }),
      http.put(`${config.apiBaseUrl}/api/properties/10/checklists/ON_SITE`, () =>
        HttpResponse.json(
          successEnvelope({
            id: 51,
            propertyId: 10,
            sourceChecklistId: null,
            checklistName: '현장 확인 기본',
            stage: 'ON_SITE',
            items: [],
          }),
        ),
      ),
      http.get(`${config.apiBaseUrl}/api/maps/reverse-geocode`, () =>
        HttpResponse.json(
          successEnvelope({
            roadAddress: '서울 관악구 신림로 12길 3',
            jibunAddress: '서울 관악구 신림동 1433-12',
            latitude: 37.3948,
            longitude: 127.1119,
          }),
        ),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(
          successEnvelope({
            ...detailWithoutPhotos,
            depositAmount: 0,
            discoverySource: '중개사 추천',
          }),
        ),
      ),
    );

    const originalGeolocation = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) =>
          success({
            coords: {
              latitude: 37.3948,
              longitude: 127.1119,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          }),
        ),
      },
    });

    try {
      const user = userEvent.setup();
      renderAuthenticated('/properties/new');

      // 1. 보증금 → 월세 → 지도 → 매물 이름 순으로, 다음을 눌렀을 때만 한 단계씩 열린다.
      expect(await screen.findByRole('button', { name: '다음' })).toBeEnabled();
      expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
      await user.type(screen.getByLabelText('보증금 입력 (만원)'), '1000');
      expect(screen.queryByLabelText('월세 입력 (만원)')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '다음' }));
      expect(screen.getByLabelText('월세 입력 (만원)')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '다음' }));
      expect(screen.getByLabelText('월세 입력 (만원)')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('월세를 입력해 주세요.')).toBeInTheDocument();
      await user.type(screen.getByLabelText('월세 입력 (만원)'), '55');
      await user.click(screen.getByRole('button', { name: '다음' }));
      expect(await screen.findByRole('region', { name: '매물 위치 선택' })).toBeInTheDocument();
      expect(screen.queryByLabelText('매물 이름 입력')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '다음' }));
      expect(screen.getByLabelText('매물 이름 입력')).toBeInTheDocument();
      await user.type(screen.getByLabelText('매물 이름 입력'), '신림역 원룸');
      const createButton = await screen.findByRole('button', { name: '매물 등록' });
      await waitFor(() => expect(createButton).toBeEnabled());
      await user.click(createButton);

      expect(await screen.findAllByRole('heading', { name: '신림역 원룸', level: 1 })).toHaveLength(1);
      await waitFor(() => expect(requestBody).toBeDefined());
      expect(requestBody).toMatchObject({
        name: '신림역 원룸',
        depositAmount: 10_000_000,
        monthlyRentAmount: 550_000,
        address: '서울 관악구 신림로 12길 3',
      });
    } finally {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: originalGeolocation });
    }
  });

  it('주소를 확인하지 못하면 등록을 요청하지 않고 까닭을 안내한다', async () => {
    let createCalls = 0;
    server.use(
      http.get(`${config.apiBaseUrl}/api/maps/reverse-geocode`, () => HttpResponse.error()),
      http.post(`${config.apiBaseUrl}/api/properties`, () => {
        createCalls += 1;
        return HttpResponse.json(successEnvelope({ id: 11 }), { status: 201 });
      }),
    );

    const originalGeolocation = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((_success: PositionCallback, failure?: PositionErrorCallback) =>
          failure?.({ code: 1, message: '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
        ),
      },
    });

    try {
      const user = userEvent.setup();
      renderAuthenticated('/properties/new');

      await user.type(await screen.findByLabelText('보증금 입력 (만원)'), '1000');
      expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: '다음' }));
      await user.type(screen.getByLabelText('월세 입력 (만원)'), '55');
      await user.click(screen.getByRole('button', { name: '다음' }));
      expect(await screen.findByRole('region', { name: '매물 위치 선택' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '다음' }));
      await user.type(screen.getByLabelText('매물 이름 입력'), '신림역 원룸');

      await user.click(await screen.findByRole('button', { name: '매물 등록' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('주소를 확인하지 못했어요.');
      expect(createCalls).toBe(0);
    } finally {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: originalGeolocation });
    }
  });

  it('모바일에서는 첫 입력에 자동 포커스하지 않고 키패드 확인으로 다음 단계로 이동한다', async () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(max-width: 430px)',
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );

    try {
      const user = userEvent.setup();
      renderAuthenticated('/properties/new');

      const depositField = await screen.findByLabelText('보증금 입력 (만원)');
      expect(depositField).not.toHaveFocus();
      expect(screen.queryByRole('button', { name: '다음' })).not.toBeInTheDocument();

      await user.type(depositField, '1000');
      await user.keyboard('{Enter}');

      expect(await screen.findByLabelText('월세 입력 (만원)')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '다음' })).not.toBeInTheDocument();
    } finally {
      matchMedia.mockRestore();
    }
  });

  it('수정은 변경이 없어도 전체 필드를 보내고 상세 화면으로 돌아간다', async () => {
    let updateCalls = 0;
    let updateBody: unknown;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
      http.put(`${config.apiBaseUrl}/api/properties/10`, async ({ request }) => {
        updateCalls += 1;
        updateBody = await request.json();
        return HttpResponse.json(successEnvelope({ id: 10, ...(updateBody as object), monthlyRentAmount: 530_000 }));
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10/edit');

    await user.click(await screen.findByRole('button', { name: '변경사항 저장' }));
    expect(await screen.findAllByRole('heading', { name: '신림역 원룸', level: 1 })).toHaveLength(1);
    expect(updateCalls).toBe(1);
    expect(updateBody).toEqual({
      name: propertyDetailFixture.name,
      depositAmount: propertyDetailFixture.depositAmount,
      monthlyRentAmount: propertyDetailFixture.monthlyRentAmount,
      discoverySource: propertyDetailFixture.discoverySource.value,
      address: propertyDetailFixture.location.address,
      latitude: propertyDetailFixture.location.latitude,
      longitude: propertyDetailFixture.location.longitude,
      availableMoveInDate: propertyDetailFixture.availableMoveInDate,
      maintenanceFeeAmount: propertyDetailFixture.maintenanceFeeAmount,
      visitScheduledAt: propertyDetailFixture.visitScheduledAt,
      roomOptions: [...propertyDetailFixture.roomOptions],
      utilityOptions: [...propertyDetailFixture.utilityOptions],
    });
  });

  it('상세 부가 정보는 메모가 아니라 매물 상세 응답으로 채운다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
      http.get(`${config.apiBaseUrl}/api/properties/10/memo`, () =>
        HttpResponse.json(successEnvelope({ propertyId: 10, freeMemo: '' })),
      ),
    );
    renderAuthenticated('/properties/10');

    const section = within(await screen.findByRole('region', { name: '매물 부가 정보' }));
    expect(section.getByText('2026.09.01')).toBeInTheDocument();
    expect(section.getByText('7만원')).toBeInTheDocument();
    expect(section.getByText('수도세, 인터넷')).toBeInTheDocument();
    expect(section.getByText('에어컨, 냉장고')).toBeInTheDocument();
    expect(section.getByText('2026-08-20 14:00')).toBeInTheDocument();
    expect(section.getByRole('link', { name: '편집' })).toHaveAttribute('href', '/properties/10/memo');
  });

  it('부가 정보 화면은 상세 값을 채워 두고 바뀐 값만 전체 수정으로 보낸다', async () => {
    let requestBody: unknown;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
      http.put(`${config.apiBaseUrl}/api/properties/10`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(successEnvelope({ id: 10, ...(requestBody as object) }));
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10/memo');

    // 상세에서 받은 부가 정보가 그대로 채워져 있다.
    expect(await screen.findByLabelText('입주 가능일')).toHaveValue('2026-09-01');
    expect(screen.getByLabelText('방문 일정')).toHaveValue('2026-08-20T14:00');
    expect(screen.getByRole('checkbox', { name: '수도세' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '인터넷' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '에어컨' })).toBeChecked();
    const maintenanceTotal = screen.getByLabelText('총 관리비');
    expect(maintenanceTotal).toHaveValue('7');

    await user.clear(maintenanceTotal);
    await user.type(maintenanceTotal, '12');
    await user.click(screen.getByRole('checkbox', { name: '가스비' }));
    await user.click(screen.getByRole('checkbox', { name: '책상' }));
    const discoverySource = screen.getByLabelText('확인한 곳');
    await user.clear(discoverySource);
    await user.type(discoverySource, 'https://new.example.com/listing');
    await user.click(screen.getByRole('button', { name: '부가 정보 저장' }));

    expect(await screen.findAllByRole('heading', { name: '신림역 원룸', level: 1 })).toHaveLength(1);
    expect(requestBody).toEqual({
      name: propertyDetailFixture.name,
      depositAmount: propertyDetailFixture.depositAmount,
      monthlyRentAmount: propertyDetailFixture.monthlyRentAmount,
      address: propertyDetailFixture.location.address,
      latitude: propertyDetailFixture.location.latitude,
      longitude: propertyDetailFixture.location.longitude,
      availableMoveInDate: '2026-09-01',
      maintenanceFeeAmount: 120_000,
      visitScheduledAt: '2026-08-20T14:00',
      discoverySource: 'https://new.example.com/listing',
      roomOptions: ['AIR_CONDITIONER', 'REFRIGERATOR', 'DESK'],
      utilityOptions: ['WATER', 'INTERNET', 'GAS'],
    });
  });

  it('부가 정보는 메모 API 없이 조회하고 비운 값은 null과 빈 배열로 저장한다', async () => {
    let memoCalls = 0;
    let requestBody: unknown;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
      http.all(`${config.apiBaseUrl}/api/properties/10/memo`, () => {
        memoCalls += 1;
        return HttpResponse.json(errorEnvelope('INTERNAL_SERVER_ERROR'), { status: 500 });
      }),
      http.put(`${config.apiBaseUrl}/api/properties/10`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(errorEnvelope('INTERNAL_SERVER_ERROR'), { status: 500 });
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10/memo');

    await user.clear(await screen.findByLabelText('입주 가능일'));
    await user.clear(screen.getByLabelText('총 관리비'));
    await user.clear(screen.getByLabelText('방문 일정'));
    await user.clear(screen.getByLabelText('확인한 곳'));
    for (const option of screen.getAllByRole('checkbox', { checked: true })) {
      await user.click(option);
    }
    await user.click(screen.getByRole('button', { name: '부가 정보 저장' }));
    expect(await screen.findByText(/부가 정보를 저장하지 못했어요/)).toBeInTheDocument();
    expect(memoCalls).toBe(0);
    expect(requestBody).toMatchObject({
      name: propertyDetailFixture.name,
      depositAmount: propertyDetailFixture.depositAmount,
      monthlyRentAmount: propertyDetailFixture.monthlyRentAmount,
      address: propertyDetailFixture.location.address,
      availableMoveInDate: null,
      maintenanceFeeAmount: null,
      visitScheduledAt: null,
      discoverySource: null,
      roomOptions: [],
      utilityOptions: [],
    });
    expect(requestBody).not.toHaveProperty('items');
    expect(requestBody).not.toHaveProperty('freeMemo');
  });

  it('부가 정보 저장 실패 시 작성 내용을 유지해 다시 저장할 수 있다', async () => {
    let saveAttempts = 0;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
      http.put(`${config.apiBaseUrl}/api/properties/10`, async ({ request }) => {
        saveAttempts += 1;
        const body = (await request.json()) as object;
        if (saveAttempts === 1) return HttpResponse.json(errorEnvelope('INTERNAL_SERVER_ERROR'), { status: 500 });
        return HttpResponse.json(successEnvelope({ id: 10, ...body }));
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10/memo');
    const discoverySource = await screen.findByLabelText('확인한 곳');

    await user.clear(discoverySource);
    await user.type(discoverySource, '작성 중인 내용');
    await user.click(screen.getByRole('button', { name: '부가 정보 저장' }));
    expect(await screen.findByText(/부가 정보를 저장하지 못했어요/)).toBeInTheDocument();
    expect(discoverySource).toHaveValue('작성 중인 내용');
    await user.click(screen.getByRole('button', { name: '부가 정보 저장' }));
    expect(await screen.findAllByRole('heading', { name: '신림역 원룸', level: 1 })).toHaveLength(1);
    expect(saveAttempts).toBe(2);
  });

  it('상세의 빠른 메모를 열어 수정하고 저장된 내용을 바로 반영한다', async () => {
    let requestBody: unknown;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
      http.get(`${config.apiBaseUrl}/api/properties/10/memo`, () =>
        HttpResponse.json(successEnvelope({ propertyId: 10, freeMemo: '기존 메모' })),
      ),
      http.put(`${config.apiBaseUrl}/api/properties/10/memo`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(successEnvelope({ propertyId: 10, ...(requestBody as object) }));
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10');

    await user.click(await screen.findByRole('button', { name: '기존 메모' }));
    const dialog = screen.getByRole('dialog', { name: '메모' });
    const memoInput = within(dialog).getByRole('textbox', { name: '메모 내용' });
    expect(memoInput).toHaveValue('기존 메모');

    await user.clear(memoInput);
    await user.type(memoInput, '수정한 메모');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    await waitFor(() => expect(requestBody).toEqual({ freeMemo: '수정한 메모' }));
    expect(await screen.findByRole('button', { name: '수정한 메모' })).toHaveFocus();
    expect(screen.queryByRole('dialog', { name: '메모' })).not.toBeInTheDocument();
  });
});

describe('FE-2 사진과 삭제 확인', () => {
  it('상세 사진은 큰 화면에서 넘겨 보고 별도 사진 화면에서 관리한다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(successEnvelope(propertyDetailResponseFixture())),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10/photos`, () =>
        HttpResponse.json(
          successEnvelope({
            propertyId: 10,
            items: [
              propertyPhotoResponseFixture(),
              propertyPhotoResponseFixture({
                ...photoFixture,
                photoId: 82,
                contentUrl: '/api/properties/10/photos/82',
              }),
            ],
            totalCount: 2,
          }),
        ),
      ),
      http.get(
        `${config.apiBaseUrl}/api/properties/10/photos/81`,
        () => new HttpResponse(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } }),
      ),
      http.get(
        `${config.apiBaseUrl}/api/properties/10/photos/82`,
        () => new HttpResponse(new Uint8Array([255, 216, 254]), { headers: { 'Content-Type': 'image/jpeg' } }),
      ),
    );

    const user = userEvent.setup();
    const detailView = renderAuthenticated('/properties/10');
    const photoButton = await screen.findByRole('button', { name: '신림역 원룸 사진 1 크게 보기' });
    await user.click(photoButton);

    expect(await screen.findByRole('dialog', { name: '신림역 원룸 사진 크게 보기' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: '신림역 원룸 사진 1' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다음 사진' }));
    expect(await screen.findByRole('img', { name: '신림역 원룸 사진 2' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '사진 크게 보기 닫기' }));
    expect(screen.getByRole('link', { name: /사진 관리/ })).toHaveAttribute('href', '/properties/10/photos');
    detailView.unmount();

    renderAuthenticated('/properties/10/photos');
    expect(await screen.findByRole('heading', { name: '사진 관리' })).toBeInTheDocument();
    expect(screen.getByLabelText('사진 파일 선택')).toBeEnabled();
    expect(await screen.findByRole('img', { name: '업로드 순 1번째 사진' })).toBeInTheDocument();
  });

  it('빈 사진 목록과 잘못된 형식·5MiB 초과를 업로드 전에 안내한다', async () => {
    let uploadCalls = 0;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
      http.get(`${config.apiBaseUrl}/api/properties/10/photos`, () =>
        HttpResponse.json(successEnvelope({ propertyId: 10, items: [], totalCount: 0 })),
      ),
      http.post(`${config.apiBaseUrl}/api/properties/10/photos`, () => {
        uploadCalls += 1;
        return HttpResponse.json(successEnvelope(photoFixture), { status: 201 });
      }),
    );
    const user = userEvent.setup({ applyAccept: false });
    renderAuthenticated('/properties/10/photos');

    expect(await screen.findByText('등록한 사진이 없어요.')).toBeInTheDocument();
    const input = screen.getByLabelText(/사진 추가|파일 선택/, { selector: 'input[type="file"]' });
    await user.upload(input, [
      new File(['text'], 'wrong.txt', { type: 'text/plain' }),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' }),
    ]);

    expect(await screen.findByText('JPEG, PNG 또는 WebP 사진을 선택해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('사진 한 장은 5MiB 이하만 등록할 수 있습니다.')).toBeInTheDocument();
    expect(uploadCalls).toBe(0);
  });

  it('사진 30장 제한에 도달하면 파일 선택을 비활성화한다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
      http.get(`${config.apiBaseUrl}/api/properties/10/photos`, () =>
        HttpResponse.json(successEnvelope({ propertyId: 10, items: [], totalCount: 30 })),
      ),
    );
    renderAuthenticated('/properties/10/photos');

    expect(await screen.findByText('사진 30장이 모두 등록되어 추가할 수 없어요.')).toBeInTheDocument();
    expect(screen.getByLabelText('사진 파일 선택')).toBeDisabled();
  });

  it('다중 파일을 순차 처리하고 일부 실패 후에도 나머지를 계속한다', async () => {
    let activeUploads = 0;
    let maxActiveUploads = 0;
    let uploadCalls = 0;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
      http.get(`${config.apiBaseUrl}/api/properties/10/photos`, () =>
        HttpResponse.json(successEnvelope({ propertyId: 10, items: [], totalCount: 0 })),
      ),
      http.post(`${config.apiBaseUrl}/api/properties/10/photos`, async () => {
        uploadCalls += 1;
        activeUploads += 1;
        maxActiveUploads = Math.max(maxActiveUploads, activeUploads);
        await delay(10);
        activeUploads -= 1;
        if (uploadCalls === 2) return HttpResponse.json(errorEnvelope('PHOTO_UPLOAD_FAILED'), { status: 500 });
        return HttpResponse.json(successEnvelope({ ...photoFixture, photoId: 80 + uploadCalls }), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10/photos');
    const input = await screen.findByLabelText(/사진 추가|파일 선택/, { selector: 'input[type="file"]' });

    await user.upload(
      input,
      [1, 2, 3].map((number) => new File([new Uint8Array([number])], `photo-${number}.jpg`, { type: 'image/jpeg' })),
    );
    await waitFor(() => expect(uploadCalls).toBe(3));
    expect(screen.queryByText('업로드 결과')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '결과 지우기' })).not.toBeInTheDocument();
    expect(screen.getByText('사진을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
    expect(uploadCalls).toBe(3);
    expect(maxActiveUploads).toBe(1);
  });

  it('사진 삭제는 취소·성공을 구분하고 성공 전에는 화면에서 제거하지 않는다', async () => {
    let deleted = false;
    let deleteCalls = 0;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(successEnvelope(propertyDetailResponseFixture())),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10/photos`, () =>
        HttpResponse.json(
          successEnvelope({
            propertyId: 10,
            items: deleted ? [] : [propertyPhotoResponseFixture()],
            totalCount: deleted ? 0 : 1,
          }),
        ),
      ),
      http.get(
        `${config.apiBaseUrl}/api/properties/10/photos/81`,
        () => new HttpResponse(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } }),
      ),
      http.delete(`${config.apiBaseUrl}/api/properties/10/photos/81`, () => {
        deleteCalls += 1;
        deleted = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10/photos');

    const deleteButton = await screen.findByRole('button', { name: '업로드 순 1번째 사진 삭제' });
    expect(screen.queryByRole('img', { name: '삭제할 업로드 순 1번째 사진' })).not.toBeInTheDocument();
    await user.click(deleteButton);
    const dialog = screen.getByRole('dialog', { name: '이 사진을 삭제할까요?' });
    expect(within(dialog).getByRole('img', { name: '삭제할 업로드 순 1번째 사진' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteButton).toHaveFocus();
    expect(screen.queryByRole('img', { name: '삭제할 업로드 순 1번째 사진' })).not.toBeInTheDocument();

    await user.click(deleteButton);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }));
    expect(deleteCalls).toBe(0);
    expect(screen.getByRole('img', { name: '업로드 순 1번째 사진' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '업로드 순 1번째 사진 삭제' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사진 삭제' }));
    expect(await screen.findByText('등록한 사진이 없어요.')).toBeInTheDocument();
    expect(deleteCalls).toBe(1);
  });

  it('사진 관리에서 대표 사진을 지정하고 갱신된 상태를 표시한다', async () => {
    let representativePhotoId = 81;
    let representativeCalls = 0;
    const photos = [
      { ...photoFixture, representative: true },
      {
        ...photoFixture,
        photoId: 82,
        contentUrl: '/api/properties/10/photos/82',
        representative: false,
      },
    ];
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(successEnvelope(propertyDetailResponseFixture())),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10/photos`, () =>
        HttpResponse.json(
          successEnvelope({
            propertyId: 10,
            items: photos.map((photo) =>
              propertyPhotoResponseFixture({ ...photo, representative: photo.photoId === representativePhotoId }),
            ),
            totalCount: photos.length,
          }),
        ),
      ),
      http.get(
        `${config.apiBaseUrl}/api/properties/10/photos/:photoId`,
        () => new HttpResponse(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } }),
      ),
      http.put(`${config.apiBaseUrl}/api/properties/10/photos/82/representative`, () => {
        representativeCalls += 1;
        representativePhotoId = 82;
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10/photos');

    expect(await screen.findByRole('button', { name: '업로드 순 1번째 사진 대표 사진' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '업로드 순 2번째 사진을 대표 사진으로 지정' }));

    expect(await screen.findByRole('button', { name: '업로드 순 2번째 사진 대표 사진' })).toBeDisabled();
    expect(representativeCalls).toBe(1);
  });

  it('사진 삭제 실패는 사진을 유지하고 안전한 재시도 오류를 표시한다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(successEnvelope(propertyDetailResponseFixture())),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10/photos`, () =>
        HttpResponse.json(successEnvelope({ propertyId: 10, items: [propertyPhotoResponseFixture()], totalCount: 1 })),
      ),
      http.get(
        `${config.apiBaseUrl}/api/properties/10/photos/81`,
        () => new HttpResponse(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } }),
      ),
      http.delete(`${config.apiBaseUrl}/api/properties/10/photos/81`, () =>
        HttpResponse.json(errorEnvelope('PHOTO_DELETE_FAILED'), { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10/photos');

    await user.click(await screen.findByRole('button', { name: '업로드 순 1번째 사진 삭제' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '사진 삭제' }));
    expect(await within(dialog).findByText(/사진은 화면에서 제거하지 않았어요/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '업로드 순 1번째 사진' })).toBeInTheDocument();
  });

  it('매물 삭제 영향·취소·성공을 처리하고 목록으로 이동한다', async () => {
    let deleteCalls = 0;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
      http.delete(`${config.apiBaseUrl}/api/properties/10`, () => {
        deleteCalls += 1;
        return new HttpResponse(null, { status: 200 });
      }),
      http.get(`${config.apiBaseUrl}/api/properties`, () =>
        HttpResponse.json(successEnvelope(propertyPageFixture([]))),
      ),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10');

    await user.click(await screen.findByRole('button', { name: '삭제' }));
    const dialog = screen.getByRole('dialog', { name: '신림역 원룸을 삭제할까요?' });
    expect(within(dialog).getByText(/삭제한 매물은 되돌릴 수 없습니다/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '취소' }));
    expect(deleteCalls).toBe(0);

    await user.click(screen.getByRole('button', { name: '삭제' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '매물 삭제' }));
    expect(await screen.findByRole('heading', { name: '내 매물' })).toHaveFocus();
    expect(deleteCalls).toBe(1);
  });

  it('PHOTO_DELETE_FAILED인 매물은 상세에 유지한다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
      http.delete(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(errorEnvelope('PHOTO_DELETE_FAILED'), { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10');

    await user.click(await screen.findByRole('button', { name: '삭제' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '매물 삭제' }));
    expect(await within(dialog).findByText(/매물은 그대로 유지/)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: '신림역 원룸', level: 1 })).toHaveLength(1);
  });

  it('PROPERTY_NOT_FOUND를 네트워크 오류와 구분해 목록 이동을 제공한다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/99`, () =>
        HttpResponse.json(errorEnvelope('PROPERTY_NOT_FOUND'), { status: 404 }),
      ),
    );
    renderAuthenticated('/properties/99');

    expect(await screen.findByText('매물을 찾을 수 없어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '매물 목록으로 돌아가기' })).toHaveAttribute('href', '/properties');
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });
});
