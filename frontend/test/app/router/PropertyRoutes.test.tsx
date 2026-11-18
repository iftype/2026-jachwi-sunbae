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
  // 인프라 지도는 기록 화면으로 합쳐서 예전 상태로 열린 상세는 기록 화면으로 돌아간다.
  [{ returnTo: '/map' }, '기록 화면으로 돌아가기', '/properties'],
  [{ returnTo: '/' }, '홈으로 돌아가기', '/'],
  [undefined, '기록 화면으로 돌아가기', '/properties'],
  [{ returnTo: 'https://other.example' }, '기록 화면으로 돌아가기', '/properties'],
])('상세의 돌아가기 목적지는 진입 화면을 따르고 외부 주소는 허용하지 않는다 (%j)', async (state, label, href) => {
  server.use(
    http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
  );
  renderAuthenticated('/properties/10', state);
  expect(await screen.findByRole('link', { name: label as string })).toHaveAttribute('href', href);
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

    expect(await screen.findByText('0개 선택')).toBeInTheDocument();
    await waitFor(() => expect(comparisonViewCalls).toBe(1));
  });

  it('1~5개 매물을 선택한 뒤 저장 기록 PDF를 요청한다', async () => {
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

    expect(await screen.findByText('0개 선택')).toBeInTheDocument();
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
    expect(section.queryByRole('button', { name: '부가 정보 편집' })).not.toBeInTheDocument();
    expect(section.getByRole('button', { name: /^방 옵션 .+, 수정$/ })).toBeInTheDocument();
  });

  it('상세에서 보증금 / 월세 줄을 누르면 모달 없이 그 줄에서 고치고, 칸을 떠나면 저장해 저장했다고 알린다', async () => {
    let requestBody: unknown;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
      http.get(`${config.apiBaseUrl}/api/properties/10/memo`, () =>
        HttpResponse.json(successEnvelope({ propertyId: 10, freeMemo: '' })),
      ),
      http.put(`${config.apiBaseUrl}/api/properties/10`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(successEnvelope({ id: 10, ...(requestBody as object) }));
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10');

    await user.click(await screen.findByRole('button', { name: /^보증금 \/ 월세 .+, 수정$/ }));
    // 시트나 모달을 띄우지 않고 그 줄 안에 금액 두 칸을 펼친다.
    expect(screen.queryByRole('region', { name: /^보증금 \/ 월세 .+, 수정$/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('보증금 (만원)')).toHaveValue('1,000');
    expect(screen.getByLabelText('월세 (만원)')).toHaveValue('55');
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
    // 보증금에서 월세로 옮길 때는 저장하지 않는다.
    await user.click(screen.getByLabelText('보증금 (만원)'));
    const rent = screen.getByLabelText('월세 (만원)');
    await user.clear(rent);
    await user.type(rent, '60');
    expect(requestBody).toBeUndefined();
    // 금액 칸 밖을 누르면 저장한다.
    await user.click(screen.getByRole('heading', { name: '신림역 원룸', level: 1 }));

    await waitFor(() => expect(screen.queryByLabelText('월세 (만원)')).not.toBeInTheDocument());
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('✓ 저장했어요');
    expect(requestBody).toMatchObject({
      name: propertyDetailFixture.name,
      depositAmount: propertyDetailFixture.depositAmount,
      monthlyRentAmount: 600_000,
      address: propertyDetailFixture.location.address,
      latitude: propertyDetailFixture.location.latitude,
      longitude: propertyDetailFixture.location.longitude,
    });
  });

  it('미입력 금액은 0으로 열고 바꾸지 않은 채 바깥을 누르면 요청 없이 닫힌다', async () => {
    let updates = 0;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(successEnvelope({ ...detailWithoutPhotos, depositAmount: 0, monthlyRentAmount: 0 })),
      ),
      http.put(`${config.apiBaseUrl}/api/properties/10`, () => {
        updates += 1;
        return HttpResponse.json(successEnvelope(detailWithoutPhotos));
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10');
    await user.click(await screen.findByRole('button', { name: /^보증금 \/ 월세 .+, 수정$/ }));
    expect(screen.getByLabelText('보증금 (만원)')).toHaveValue('0');
    expect(screen.getByLabelText('월세 (만원)')).toHaveValue('0');
    await user.click(screen.getByRole('heading', { name: '신림역 원룸', level: 1 }));
    expect(screen.queryByLabelText('월세 (만원)')).not.toBeInTheDocument();
    expect(updates).toBe(0);
    await user.click(screen.getByRole('button', { name: /^보증금 \/ 월세 .+, 수정$/ }));
    await user.clear(screen.getByLabelText('보증금 (만원)'));
    await user.clear(screen.getByLabelText('월세 (만원)'));
    await user.click(screen.getByRole('heading', { name: '신림역 원룸', level: 1 }));
    expect(screen.queryByLabelText('월세 (만원)')).not.toBeInTheDocument();
    expect(updates).toBe(0);
  });

  it('관리비 시트 안의 공과금 라벨을 눌러도 닫히지 않고 저장을 누를 때 한 번 저장한다', async () => {
    let body: unknown;
    let updates = 0;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
      http.put(`${config.apiBaseUrl}/api/properties/10`, async ({ request }) => {
        updates += 1;
        body = await request.json();
        return HttpResponse.json(successEnvelope({ id: 10, ...(body as object) }));
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10');
    await user.click(await screen.findByRole('button', { name: /^관리비 포함 공과금 .+, 수정$/ }));
    await user.click(screen.getByLabelText('총 관리비'));
    await user.click(screen.getByText('수도세', { selector: 'span' }));
    const sheet = within(screen.getByRole('region', { name: '관리비와 공과금' }));
    expect(screen.getByRole('checkbox', { name: '수도세' })).not.toBeChecked();
    await user.click(screen.getByText('가스비', { selector: 'span' }));
    expect(screen.getByRole('checkbox', { name: '가스비' })).toBeChecked();
    expect(updates).toBe(0);
    await user.click(sheet.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: '관리비와 공과금' })).not.toBeInTheDocument());
    expect(updates).toBe(1);
    expect(body).toMatchObject({ utilityOptions: ['INTERNET', 'GAS'] });
  });

  it('매물 이름은 상세 줄에서 바로 고치고, 금액이 비어 있어도 저장된다', async () => {
    let requestBody: unknown;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(successEnvelope({ ...detailWithoutPhotos, depositAmount: 0, monthlyRentAmount: 0 })),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10/memo`, () =>
        HttpResponse.json(successEnvelope({ propertyId: 10, freeMemo: '' })),
      ),
      http.put(`${config.apiBaseUrl}/api/properties/10`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(successEnvelope({ id: 10, ...(requestBody as object) }));
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10');

    const section = within(await screen.findByRole('region', { name: '매물 기본 정보' }));
    expect(section.getByText('보증금과 월세를 입력해 주세요')).toBeInTheDocument();
    // 이름은 시트 없이 그 줄에서 바로 고친다. Esc는 저장하지 않고 닫는다.
    await user.click(section.getByRole('button', { name: /^매물 이름 .+, 수정$/ }));
    expect(screen.queryByRole('region', { name: '매물 이름 수정' })).not.toBeInTheDocument();
    await user.type(section.getByLabelText('매물 이름'), ' 바뀜');
    await user.keyboard('{Escape}');
    expect(section.queryByLabelText('매물 이름')).not.toBeInTheDocument();
    expect(requestBody).toBeUndefined();

    await user.click(section.getByRole('button', { name: /^매물 이름 .+, 수정$/ }));
    const name = section.getByLabelText('매물 이름');
    await user.clear(name);
    await user.type(name, '햇살 원룸{Enter}');

    await waitFor(() => expect(section.queryByLabelText('매물 이름')).not.toBeInTheDocument());
    expect(requestBody).toMatchObject({ name: '햇살 원룸', depositAmount: 0, monthlyRentAmount: 0 });
  });

  it('상세의 방 옵션 줄을 누르면 시트에서 고치고, 닫으면 저장하지 않고 저장을 눌러야 저장한다', async () => {
    let updateCalls = 0;
    let requestBody: unknown;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () => HttpResponse.json(successEnvelope(detailWithoutPhotos))),
      http.get(`${config.apiBaseUrl}/api/properties/10/memo`, () =>
        HttpResponse.json(successEnvelope({ propertyId: 10, freeMemo: '' })),
      ),
      http.put(`${config.apiBaseUrl}/api/properties/10`, async ({ request }) => {
        updateCalls += 1;
        requestBody = await request.json();
        return HttpResponse.json(successEnvelope({ id: 10, ...(requestBody as object) }));
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10');

    const section = within(await screen.findByRole('region', { name: '매물 부가 정보' }));
    await user.click(section.getByRole('button', { name: /^방 옵션 .+, 수정$/ }));
    await user.click(within(screen.getByRole('region', { name: '방 옵션' })).getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('region', { name: '방 옵션' })).not.toBeInTheDocument();
    expect(updateCalls).toBe(0);

    await user.click(section.getByRole('button', { name: /^방 옵션 .+, 수정$/ }));
    const editor = within(screen.getByRole('region', { name: '방 옵션' }));
    expect(editor.queryByLabelText('입주 가능일')).not.toBeInTheDocument();
    await user.click(editor.getByRole('checkbox', { name: '책상' }));
    await user.click(editor.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(screen.queryByRole('region', { name: '방 옵션' })).not.toBeInTheDocument());
    expect(updateCalls).toBe(1);
    expect(requestBody).toMatchObject({ roomOptions: ['AIR_CONDITIONER', 'REFRIGERATOR', 'DESK'] });
    expect(screen.getByText('에어컨, 냉장고, 책상')).toBeInTheDocument();
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
    // 창 없이 메모 칸 안에서 바로 고친다.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const memoInput = screen.getByRole('textbox', { name: '메모 내용' });
    expect(memoInput).toHaveValue('기존 메모');

    await user.clear(memoInput);
    await user.type(memoInput, '수정한 메모');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => expect(requestBody).toEqual({ freeMemo: '수정한 메모' }));
    expect(await screen.findByRole('button', { name: '수정한 메모' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '메모 내용' })).not.toBeInTheDocument();
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
                thumbnailUrl: '/api/properties/10/photos/82/thumbnail',
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

  it('빈 사진 목록과 잘못된 형식·10MiB 초과를 업로드 전에 안내한다', async () => {
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
    expect(screen.getByText('사진 한 장은 10MB 이하만 올릴 수 있어요.')).toBeInTheDocument();
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
    expect(screen.getByText('사진을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
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
    expect(await screen.findByRole('img', { name: '업로드 순 1번째 사진' })).toBeInTheDocument();

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
        thumbnailUrl: '/api/properties/10/photos/82/thumbnail',
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
    expect(await screen.findByRole('img', { name: '업로드 순 1번째 사진' })).toBeInTheDocument();
  });

  it('매물 삭제는 확인 없이 바로 처리하고 기록 화면으로 이동한다', async () => {
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

    // 삭제는 ⋮ 메뉴 안에 있어 확인 창 없이 바로 지운다.
    await user.click(await screen.findByRole('button', { name: '삭제' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '본 방 기록' })).toHaveFocus();
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
    await waitFor(() => expect(screen.getByRole('button', { name: '삭제' })).toBeEnabled());
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
    expect(screen.getByRole('link', { name: '기록 화면으로 돌아가기' })).toHaveAttribute('href', '/properties');
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });
});
