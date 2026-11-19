import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkItemPageFixture,
  checklistPageFixture,
  checklistSummaryFixture,
  onlineItemFixture,
  secondChecklistSummaryFixture,
  secondOnlineItemFixture,
} from '@/app/mocks/fixtures/checklistFixtures';
import { propertyDetailResponseFixture, successEnvelope } from '@/app/mocks/fixtures/propertyFixtures';
import { propertyChecklistHandlers } from '@/app/mocks/handlers/propertyChecklistHandlers';
import { propertyHandlers } from '@/app/mocks/handlers/propertyHandlers';
import { resetMockStore } from '@/app/mocks/mockStore';
import AppRoutes from '@/app/router/AppRoutes';
import { setAuthentication } from '@/features/auth/model/authStore';
import { readLastSelectedChecklist } from '@/features/checklist/model/lastChecklistStore';
import { queryClient } from '@/shared/api/queryClient';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import { server } from '../../server';

const config: PublicConfig = {
  apiBaseUrl: 'http://localhost:8080',
};

beforeEach(() => queryClient.clear());

type TestEntry = string | { pathname: string; state?: unknown };

const renderAuthenticated = (entry: TestEntry) => {
  setAuthentication({ accessToken: 'memory-token', tokenType: 'Bearer', expiresIn: 60 });
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[entry]}>
          <PublicConfigProvider config={config}>
            <AppRoutes />
          </PublicConfigProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
};

const onSiteChecklistSummary = { ...checklistSummaryFixture, stage: 'ON_SITE' };
const secondOnSiteChecklistSummary = { ...secondChecklistSummaryFixture, stage: 'ON_SITE' };
const onSiteItemFixture = { ...onlineItemFixture, stage: 'ON_SITE' };
const secondOnSiteItemFixture = { ...secondOnlineItemFixture, stage: 'ON_SITE' };

const finalChecklistDetail = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  name: '전화 문의 기본 목록',
  stage: 'ON_SITE',
  itemCount: 2,
  items: [
    {
      id: 701,
      systemCheckItemId: 101,
      itemType: 'CORE',
      question: onlineItemFixture.question,
      displayOrder: 1,
      active: true,
    },
    {
      id: 702,
      systemCheckItemId: 102,
      itemType: 'OPTIONAL',
      question: secondOnlineItemFixture.question,
      displayOrder: 2,
      active: true,
    },
  ],
  ...overrides,
});

const emptyStageProgress = (stage: 'ON_SITE' | 'PRE_CONTRACT') => ({
  stage,
  applied: false,
  propertyChecklistId: null,
  checklistName: null,
  sourceChecklistId: null,
  progress: {
    totalCount: 0,
    completedCount: 0,
    goodCount: 0,
    cautionCount: 0,
    unconfirmedCount: 0,
    progressRate: 0,
  },
});

describe('내 체크리스트 편집', () => {
  it('관리 목록을 먼저 보여주고 선택한 번들의 편집 화면을 연다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/checklists`, () =>
        HttpResponse.json(
          successEnvelope(checklistPageFixture([onSiteChecklistSummary, secondOnSiteChecklistSummary])),
        ),
      ),
      http.get(`${config.apiBaseUrl}/api/checklists/8`, () =>
        HttpResponse.json(
          successEnvelope(
            finalChecklistDetail({
              id: 8,
              name: '직방 매물 문의 목록',
              itemCount: 1,
              items: [
                {
                  id: 801,
                  systemCheckItemId: 102,
                  itemType: 'OPTIONAL',
                  question: '두 번째 번들 항목',
                  displayOrder: 1,
                },
              ],
            }),
          ),
        ),
      ),
    );
    renderAuthenticated('/checklists');

    expect(await screen.findByRole('heading', { name: '체크리스트 관리', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '변경 내용 저장' })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /직방 매물 문의 목록/ })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('link', { name: /직방 매물 문의 목록/ }));
    expect(await screen.findByRole('heading', { name: '체크리스트 편집', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('두 번째 번들 항목')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '체크리스트 이름' })).toHaveValue('직방 매물 문의 목록');
    expect(screen.getByRole('button', { name: '체크리스트 삭제' })).toBeInTheDocument();
  });

  it('빈 관리 화면에서 만들기를 눌러 편집하고 닫으면 관리로 돌아온다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/checklists`, () =>
        HttpResponse.json(successEnvelope(checklistPageFixture([]))),
      ),
      http.get(`${config.apiBaseUrl}/api/check-items`, () => HttpResponse.json(successEnvelope([onSiteItemFixture]))),
    );
    const user = userEvent.setup();
    renderAuthenticated('/checklists');
    expect(await screen.findByText(/저장된 체크리스트가 없어요/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '체크리스트 저장' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: '새 체크리스트' }));
    expect(await screen.findByRole('button', { name: '선택한 0개 항목 추가' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: '체크리스트 만들기', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '체크리스트 관리' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '체크리스트 관리로 돌아가기' }));
    expect(await screen.findByRole('heading', { name: '체크리스트 관리' })).toBeInTheDocument();
  });

  it('체크리스트 최초 요청 실패 후 다시 시도하면 관리 목록을 보여준다', async () => {
    let shouldFail = true;
    server.use(
      http.get(`${config.apiBaseUrl}/api/checklists`, () =>
        shouldFail
          ? HttpResponse.error()
          : HttpResponse.json(successEnvelope(checklistPageFixture([onSiteChecklistSummary]))),
      ),
      http.get(`${config.apiBaseUrl}/api/checklists/7`, () =>
        HttpResponse.json(successEnvelope(finalChecklistDetail())),
      ),
    );
    const user = userEvent.setup();
    renderAuthenticated('/checklists');

    expect(await screen.findByText('체크리스트를 불러오지 못했어요.')).toBeInTheDocument();
    shouldFail = false;
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByRole('link', { name: /전화 문의 기본 목록/ })).toBeInTheDocument();
  });

  it('관리 목록에 기존 번들이 있어도 새 만들기 주소는 생성 화면을 연다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/checklists`, () =>
        HttpResponse.json(successEnvelope(checklistPageFixture([onSiteChecklistSummary]))),
      ),
      http.get(`${config.apiBaseUrl}/api/checklists/7`, () =>
        HttpResponse.json(successEnvelope(finalChecklistDetail())),
      ),
    );
    server.use(
      http.get(`${config.apiBaseUrl}/api/check-items`, () => HttpResponse.json(successEnvelope([onSiteItemFixture]))),
    );
    renderAuthenticated('/checklists/new');

    expect(await screen.findByRole('button', { name: '선택한 0개 항목 추가' })).toBeDisabled();
  });

  it('새 체크리스트는 CORE와 OPTIONAL 모두 미선택으로 시작하고 선택한 항목만 저장한다', async () => {
    let requestBody: unknown;
    server.use(
      http.get(`${config.apiBaseUrl}/api/checklists`, () =>
        HttpResponse.json(successEnvelope(checklistPageFixture([]))),
      ),
      http.get(`${config.apiBaseUrl}/api/check-items`, () =>
        HttpResponse.json(successEnvelope(checkItemPageFixture([onSiteItemFixture, secondOnSiteItemFixture]))),
      ),
      http.post(`${config.apiBaseUrl}/api/checklists`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          successEnvelope(finalChecklistDetail({ id: 9, name: '내 체크리스트', stage: 'ON_SITE' })),
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/checklists/new');

    expect(await screen.findByRole('heading', { name: '체크리스트 만들기', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText(onlineItemFixture.question)).toBeInTheDocument();
    const core = screen.getByRole('checkbox', { name: onlineItemFixture.question });
    const optional = screen.getByRole('checkbox', { name: secondOnlineItemFixture.question });
    expect(core).not.toBeChecked();
    expect(optional).not.toBeChecked();
    expect(core).toBeEnabled();
    expect(screen.queryByText('이미 추가됨')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '체크리스트 저장' })).not.toBeInTheDocument();
    expect(screen.getByText('0개 선택')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '선택한 0개 항목 추가' })).toBeDisabled();
    await user.click(core);
    await user.click(optional);
    expect(screen.getByText('2개 선택')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '선택한 2개 항목 추가' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '선택한 2개 항목 추가' }));
    expect(screen.getByRole('heading', { name: '추가된 체크리스트' })).toBeInTheDocument();
    expect(screen.getByText(onlineItemFixture.question)).toBeInTheDocument();
    expect(screen.getByText(secondOnlineItemFixture.question)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '체크리스트 저장' }));
    await waitFor(() =>
      expect(requestBody).toEqual({
        name: '내 체크리스트',
        stage: 'ON_SITE',
        items: [{ systemCheckItemId: 101 }, { systemCheckItemId: 102 }],
      }),
    );
    await waitFor(() => expect(readLastSelectedChecklist()).toBe(9));
  });

  it('카테고리와 검색을 바꿔도 선택을 유지하고 해당 카테고리에 추가한다', async () => {
    const catalog = [
      { id: 201, stage: 'ON_SITE', itemType: 'CORE', category: 'SECURITY', question: '현관 잠금 확인' },
      { id: 202, stage: 'ON_SITE', itemType: 'OPTIONAL', category: 'SECURITY', question: 'CCTV 확인' },
      { id: 203, stage: 'ON_SITE', itemType: 'OPTIONAL', category: 'WATER_BATHROOM', question: '환풍기 확인' },
    ];
    let savedBody: unknown;
    let isSaved = false;
    const saved = {
      id: 9,
      name: '내 체크리스트',
      stage: 'ON_SITE',
      itemCount: 3,
      items: catalog.map((item, index) => ({
        ...item,
        id: index + 901,
        systemCheckItemId: item.id,
        displayOrder: index + 1,
      })),
    };
    server.use(
      http.get(`${config.apiBaseUrl}/api/checklists`, () =>
        HttpResponse.json(
          successEnvelope(
            checklistPageFixture(isSaved ? [{ id: 9, name: saved.name, stage: saved.stage, itemCount: 3 }] : []),
          ),
        ),
      ),
      http.get(`${config.apiBaseUrl}/api/check-items`, ({ request }) => {
        const query = new URL(request.url).searchParams.get('query') ?? '';
        return HttpResponse.json(successEnvelope(catalog.filter((item) => item.question.includes(query))));
      }),
      http.post(`${config.apiBaseUrl}/api/checklists`, async ({ request }) => {
        savedBody = await request.json();
        isSaved = true;
        return HttpResponse.json(successEnvelope(saved), { status: 201 });
      }),
      http.get(`${config.apiBaseUrl}/api/checklists/9`, () => HttpResponse.json(successEnvelope(saved))),
    );
    const user = userEvent.setup();
    renderAuthenticated('/checklists/new');
    await screen.findByText('현관 잠금 확인');
    await user.click(await screen.findByRole('radio', { name: '보안' }));
    expect(screen.getByRole('checkbox', { name: '현관 잠금 확인' })).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: '현관 잠금 확인' }));
    await user.click(screen.getByRole('checkbox', { name: 'CCTV 확인' }));
    await user.click(screen.getByRole('radio', { name: '수도·화장실' }));
    expect(screen.queryByRole('checkbox', { name: 'CCTV 확인' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: '환풍기 확인' }));
    await user.type(screen.getByRole('textbox', { name: '제공 항목 검색' }), '환풍기{Enter}');
    expect(await screen.findByRole('checkbox', { name: '환풍기 확인' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: '선택한 3개 항목 추가' }));
    const security = screen.getByRole('region', { name: '보안' });
    expect(within(security).getByText('CCTV 확인')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '수도·화장실' })).getByText('환풍기 확인')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '체크리스트 저장' }));
    await waitFor(() =>
      expect(savedBody).toMatchObject({
        items: [{ systemCheckItemId: 201 }, { systemCheckItemId: 202 }, { systemCheckItemId: 203 }],
      }),
    );
    await user.click(await screen.findByRole('link', { name: /내 체크리스트/ }));
    await waitFor(() =>
      expect(within(screen.getByRole('region', { name: '보안' })).getByText('CCTV 확인')).toBeInTheDocument(),
    );
  });

  it('전체 항목을 불러오지 못하면 선택 화면에서 재시도한다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/checklists`, () =>
        HttpResponse.json(successEnvelope(checklistPageFixture([]))),
      ),
      http.get(`${config.apiBaseUrl}/api/check-items`, () =>
        HttpResponse.json({ code: 'INTERNAL_SERVER_ERROR', message: '조회 실패', data: null }, { status: 503 }),
      ),
    );
    renderAuthenticated('/checklists/new');

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    expect(within(error).getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '빈 목록으로 시작' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '체크리스트 저장' })).not.toBeInTheDocument();
  });

  it('수정 요청에는 기존 이름과 현재 제공 항목의 전체 순서를 보낸다', async () => {
    let requestBody: unknown;
    server.use(
      http.get(`${config.apiBaseUrl}/api/checklists`, () =>
        HttpResponse.json(successEnvelope(checklistPageFixture([onSiteChecklistSummary]))),
      ),
      http.get(`${config.apiBaseUrl}/api/checklists/7`, () =>
        HttpResponse.json(successEnvelope(finalChecklistDetail())),
      ),
      http.get(`${config.apiBaseUrl}/api/check-items`, () =>
        HttpResponse.json(successEnvelope(checkItemPageFixture([onlineItemFixture, secondOnlineItemFixture]))),
      ),
      http.put(`${config.apiBaseUrl}/api/checklists/7`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(successEnvelope(finalChecklistDetail()));
      }),
      // 저장한 뒤 이 체크리스트를 쓰는 매물을 찾아 다시 적용한다. 여기서는 그런 매물이 없다.
      http.get(`${config.apiBaseUrl}/api/properties`, () =>
        HttpResponse.json(successEnvelope({ totalCount: 0, items: [] })),
      ),
    );
    const user = userEvent.setup();
    renderAuthenticated('/checklists/7');

    await user.click(await screen.findByRole('button', { name: '변경 내용 저장' }));

    await waitFor(() =>
      expect(requestBody).toEqual({
        name: '전화 문의 기본 목록',
        items: [{ systemCheckItemId: 101 }, { systemCheckItemId: 102 }],
      }),
    );
    await waitFor(() => expect(readLastSelectedChecklist()).toBe(7));
  });
});

describe('매물 체크리스트 연결과 자동 저장', () => {
  it('매물에 체크리스트가 없으면 선택 화면 없이 바로 기본 체크리스트 시작 버튼을 보여준다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(successEnvelope({ ...propertyDetailResponseFixture(), photos: [] })),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10/checklists`, () =>
        HttpResponse.json(
          successEnvelope({
            propertyId: 10,
            overallProgress: {
              totalCount: 0,
              completedCount: 0,
              goodCount: 0,
              cautionCount: 0,
              unconfirmedCount: 0,
              progressRate: 0,
            },
            stages: [emptyStageProgress('ON_SITE'), emptyStageProgress('PRE_CONTRACT')],
          }),
        ),
      ),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10');

    // 체크리스트는 매물 상세의 `체크리스트` 탭에서 보인다.
    await user.click(await screen.findByRole('tab', { name: '체크리스트' }));
    const sectionHeading = await screen.findByRole('heading', { name: '체크리스트' });
    const section = sectionHeading.closest('section');
    expect(section).not.toBeNull();
    // 기본 체크리스트를 자동으로 붙이는 동안에는 시작 버튼을 그리지 않는다. 자동으로 붙이지 못했을 때 시작 버튼이 나타난다.
    expect(await within(section as HTMLElement).findByRole('button', { name: /^체크리스트$/ })).toBeInTheDocument();
  });

  it('내 체크리스트가 없어도 시작 방식 선택 없이 새 체크리스트 만들기만 제공한다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(successEnvelope(propertyDetailResponseFixture())),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10/checklists`, () =>
        HttpResponse.json(
          successEnvelope({
            propertyId: 10,
            overallProgress: {
              totalCount: 0,
              completedCount: 0,
              goodCount: 0,
              cautionCount: 0,
              unconfirmedCount: 0,
              progressRate: 0,
            },
            stages: [
              {
                stage: 'ON_SITE',
                applied: false,
                propertyChecklistId: null,
                checklistName: null,
                sourceChecklistId: null,
                progress: {
                  totalCount: 0,
                  completedCount: 0,
                  goodCount: 0,
                  cautionCount: 0,
                  unconfirmedCount: 0,
                  progressRate: 0,
                },
              },
              emptyStageProgress('ON_SITE'),
              emptyStageProgress('PRE_CONTRACT'),
            ],
          }),
        ),
      ),
      http.get(`${config.apiBaseUrl}/api/checklists`, () =>
        HttpResponse.json(successEnvelope(checklistPageFixture([]))),
      ),
    );
    renderAuthenticated('/properties/10/active-checklists/ON_SITE?from=property-detail');

    expect(await screen.findByRole('checkbox', { name: /자취선배 기본 체크리스트/ })).toBeInTheDocument();
    expect(screen.queryByText('빈 목록')).not.toBeInTheDocument();
    expect(screen.queryByText('원룸 제공 항목')).not.toBeInTheDocument();
  });

  it('목록을 고른 뒤 확인할 때 최종 연결 API를 호출하고 적용 상세로 이동한다', async () => {
    let requestBody: unknown;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(successEnvelope(propertyDetailResponseFixture())),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10/checklists`, () =>
        HttpResponse.json(
          successEnvelope({
            propertyId: 10,
            overallProgress: {
              totalCount: 0,
              completedCount: 0,
              goodCount: 0,
              cautionCount: 0,
              unconfirmedCount: 0,
              progressRate: 0,
            },
            stages: [
              {
                stage: 'ON_SITE',
                applied: false,
                propertyChecklistId: null,
                checklistName: null,
                sourceChecklistId: null,
                progress: {
                  totalCount: 0,
                  completedCount: 0,
                  goodCount: 0,
                  cautionCount: 0,
                  unconfirmedCount: 0,
                  progressRate: 0,
                },
              },
              emptyStageProgress('ON_SITE'),
              emptyStageProgress('PRE_CONTRACT'),
            ],
          }),
        ),
      ),
      http.get(`${config.apiBaseUrl}/api/checklists`, () =>
        HttpResponse.json(successEnvelope(checklistPageFixture([checklistSummaryFixture]))),
      ),
      http.put(`${config.apiBaseUrl}/api/properties/10/checklists/ON_SITE`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          successEnvelope({
            id: 47,
            propertyId: 10,
            sourceChecklistId: 7,
            checklistName: '전화 문의 기본 목록',
            stage: 'ON_SITE',
            items: [],
          }),
        );
      }),
      http.get(`${config.apiBaseUrl}/api/properties/10/checklists/47`, () =>
        HttpResponse.json(
          successEnvelope({
            id: 47,
            propertyId: 10,
            sourceChecklistId: 7,
            checklistName: '전화 문의 기본 목록',
            stage: 'ON_SITE',
            items: [],
          }),
        ),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10/checklists`, () =>
        HttpResponse.json(
          successEnvelope({
            propertyId: 10,
            overallProgress: {
              totalCount: 2,
              completedCount: 1,
              goodCount: 1,
              cautionCount: 0,
              unconfirmedCount: 1,
              progressRate: 50,
            },
            stages: [
              {
                stage: 'ON_SITE',
                applied: true,
                propertyChecklistId: 47,
                checklistName: '전화 문의 기본 목록',
                sourceChecklistId: 7,
                progress: {
                  totalCount: 1,
                  completedCount: 0,
                  goodCount: 0,
                  cautionCount: 0,
                  unconfirmedCount: 1,
                  progressRate: 0,
                },
              },
              emptyStageProgress('ON_SITE'),
              emptyStageProgress('PRE_CONTRACT'),
            ],
          }),
        ),
      ),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10/active-checklists/ON_SITE?mode=replace');

    expect(await screen.findByRole('checkbox', { name: /전화 문의 기본 목록/ })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /전화 문의 기본 목록/ }));
    expect(requestBody).toBeUndefined();
    await user.click(screen.getByRole('button', { name: '체크리스트 적용' }));

    await waitFor(() => expect(requestBody).toEqual({ sourceType: 'USER', checklistId: 7 }));
    expect(await screen.findByRole('tab', { name: '체크리스트', selected: true })).toBeInTheDocument();
    // 다음 매물은 이번에 고른 목록으로 시작한다.
    expect(readLastSelectedChecklist()).toBe(7);
  });

  it('현재 목록을 다시 눌러도 이동하지 않고 확인 버튼은 바뀐 선택이 있을 때만 켜진다', async () => {
    let assignmentCount = 0;
    server.use(
      http.put(`${config.apiBaseUrl}/api/properties/10/checklists/ON_SITE`, () => {
        assignmentCount += 1;
        return HttpResponse.json(successEnvelope({}));
      }),
      http.get(`${config.apiBaseUrl}/api/properties/10/checklists/47`, () =>
        HttpResponse.json(
          successEnvelope({
            id: 47,
            propertyId: 10,
            stage: 'ON_SITE',
            sourceChecklistId: 7,
            checklistName: '전화 문의 기본 목록',
            items: [],
          }),
        ),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(successEnvelope(propertyDetailResponseFixture())),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10/checklists`, () =>
        HttpResponse.json(
          successEnvelope({
            propertyId: 10,
            overallProgress: {
              totalCount: 2,
              completedCount: 1,
              goodCount: 1,
              cautionCount: 0,
              unconfirmedCount: 1,
              progressRate: 50,
            },
            stages: [
              {
                stage: 'ON_SITE',
                applied: true,
                propertyChecklistId: 47,
                checklistName: '전화 문의 기본 목록',
                sourceChecklistId: 7,
                progress: {
                  totalCount: 2,
                  completedCount: 1,
                  goodCount: 1,
                  cautionCount: 0,
                  unconfirmedCount: 1,
                  progressRate: 50,
                },
              },
              emptyStageProgress('PRE_CONTRACT'),
            ],
          }),
        ),
      ),
      http.get(`${config.apiBaseUrl}/api/checklists`, () =>
        HttpResponse.json(
          successEnvelope(checklistPageFixture([checklistSummaryFixture, secondChecklistSummaryFixture])),
        ),
      ),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10/active-checklists/ON_SITE?from=property-detail&mode=replace');

    const current = await screen.findByRole('checkbox', { name: /전화 문의 기본 목록/ });
    expect(current).toBeChecked();
    expect(within(current.closest('label') as HTMLElement).getByText('현재')).toBeInTheDocument();
    expect(screen.queryByText('추천')).not.toBeInTheDocument();
    expect(screen.getAllByText('현재')).toHaveLength(1);
    // 선택이 현재와 같으면 바꿀 것이 없어 버튼이 비활성이다.
    expect(screen.getByRole('button', { name: '선택한 체크리스트로 교체' })).toBeDisabled();
    await user.click(current);
    expect(screen.getByRole('heading', { name: '체크리스트 교체', level: 1 })).toBeInTheDocument();
    expect(assignmentCount).toBe(0);
    expect(screen.getByRole('checkbox', { name: /직방 매물 문의 목록/ })).not.toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: /직방 매물 문의 목록/ }));
    expect(screen.getByRole('button', { name: '선택한 체크리스트로 교체' })).toBeEnabled();
    expect(within(current.closest('label') as HTMLElement).getByText('현재')).toBeInTheDocument();
    await user.click(current);
    expect(screen.getByRole('button', { name: '선택한 체크리스트로 교체' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: '체크리스트 교체', level: 1 })).toBeInTheDocument();
    expect(assignmentCount).toBe(0);
  });

  it('상태와 항목 메모를 각각 즉시 저장한다', async () => {
    let statusRequest: unknown;
    let memoRequest: unknown;
    let createdFromProperty = false;
    server.use(
      http.post(`${config.apiBaseUrl}/api/checklists`, async ({ request }) => {
        expect(await request.json()).toMatchObject({ items: [{ systemCheckItemId: 101 }] });
        createdFromProperty = true;
        return HttpResponse.json(
          successEnvelope(
            finalChecklistDetail({
              id: 9,
              name: '새 사용자 목록',
              itemCount: 1,
              items: [
                {
                  id: 901,
                  systemCheckItemId: 101,
                  itemType: 'CORE',
                  question: onSiteItemFixture.question,
                  displayOrder: 1,
                },
              ],
            }),
          ),
          { status: 201 },
        );
      }),
      http.get(`${config.apiBaseUrl}/api/checklists`, () =>
        HttpResponse.json(
          successEnvelope(
            checklistPageFixture(
              createdFromProperty
                ? [onSiteChecklistSummary, { ...onSiteChecklistSummary, id: 9, name: '새 사용자 목록', itemCount: 1 }]
                : [onSiteChecklistSummary],
            ),
          ),
        ),
      ),
      http.get(`${config.apiBaseUrl}/api/checklists/7`, () =>
        HttpResponse.json(successEnvelope(finalChecklistDetail())),
      ),
      http.get(`${config.apiBaseUrl}/api/check-items`, () =>
        HttpResponse.json(successEnvelope([onSiteItemFixture, secondOnSiteItemFixture])),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(successEnvelope({ ...propertyDetailResponseFixture(), photos: [] })),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10/checklists/47`, () =>
        HttpResponse.json(
          successEnvelope({
            id: 47,
            propertyId: 10,
            sourceChecklistId: 7,
            checklistName: '전화 문의 기본 목록',
            stage: 'ON_SITE',
            items: [
              {
                id: 701,
                systemCheckItemId: 101,
                question: '수압이 충분한가요?',
                displayOrder: 1,
                status: 'UNCONFIRMED',
                memo: '',
              },
              {
                id: 702,
                systemCheckItemId: 102,
                question: '채광이 충분한가요?',
                displayOrder: 2,
                status: 'UNCONFIRMED',
                memo: '',
              },
            ],
          }),
        ),
      ),
      http.get(`${config.apiBaseUrl}/api/properties/10/checklists`, () =>
        HttpResponse.json(
          successEnvelope({
            propertyId: 10,
            overallProgress: {
              totalCount: 1,
              completedCount: 0,
              goodCount: 0,
              cautionCount: 0,
              unconfirmedCount: 1,
              progressRate: 0,
            },
            stages: [
              {
                stage: 'ON_SITE',
                applied: true,
                propertyChecklistId: 47,
                checklistName: '전화 문의 기본 목록',
                sourceChecklistId: 7,
                progress: {
                  totalCount: 1,
                  completedCount: 0,
                  goodCount: 0,
                  cautionCount: 0,
                  unconfirmedCount: 1,
                  progressRate: 0,
                },
              },
              emptyStageProgress('ON_SITE'),
              emptyStageProgress('PRE_CONTRACT'),
            ],
          }),
        ),
      ),
      http.patch(`${config.apiBaseUrl}/api/properties/10/checklists/47/items/701/status`, async ({ request }) => {
        statusRequest = await request.json();
        return HttpResponse.json(successEnvelope({ item: { id: 701, status: 'CAUTION' } }));
      }),
      http.patch(`${config.apiBaseUrl}/api/properties/10/checklists/47/items/701/memo`, async ({ request }) => {
        memoRequest = await request.json();
        return HttpResponse.json(successEnvelope({ item: { id: 701, memo: '수압은 괜찮지만 온수 확인 필요' } }));
      }),
    );
    const user = userEvent.setup();
    renderAuthenticated('/properties/10/checklists/47');

    expect(await screen.findByRole('heading', { name: '전화 문의 기본 목록', level: 1 })).toBeInTheDocument();
    // 사용자 체크리스트 제목 옆에서 기존 교체 화면으로 이동한다.
    expect(screen.getByRole('link', { name: '사용자 체크리스트 교체' })).toHaveAttribute(
      'href',
      '/properties/10/active-checklists/ON_SITE?mode=replace',
    );

    await user.click(screen.getAllByRole('button', { name: '주의' })[0]);
    await waitFor(() => expect(statusRequest).toEqual({ status: 'CAUTION' }));
    const memo = screen.getByRole('textbox', { name: '수압이 충분한가요? 메모' });
    expect(memo).toHaveAttribute('placeholder', '메모 추가');
    expect(screen.getByRole('textbox', { name: '채광이 충분한가요? 메모' })).toBeEnabled();
    await user.type(memo, '수압은 괜찮지만 온수 확인 필요');
    await user.tab();
    await waitFor(() => expect(memoRequest).toEqual({ memo: '수압은 괜찮지만 온수 확인 필요' }));
    expect(memo).toHaveValue('수압은 괜찮지만 온수 확인 필요');
    expect(screen.getByRole('heading', { name: '사용자 체크리스트' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: '사용자 체크리스트 교체' }));
    expect(await screen.findByRole('heading', { name: '체크리스트 교체', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '내 체크리스트' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '홈으로 돌아가기' })).not.toBeInTheDocument();
    const manage = screen.getByRole('link', { name: '새 체크리스트' });
    expect(manage).toHaveAttribute('href', '/checklists/new?propertyId=10');
    await user.click(manage);
    await user.click(await screen.findByRole('checkbox', { name: onSiteItemFixture.question }));
    await user.click(screen.getByRole('button', { name: '선택한 1개 항목 추가' }));
    await user.click(screen.getByRole('button', { name: '체크리스트 저장' }));
    expect(await screen.findByRole('heading', { name: '체크리스트 교체', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: /새 사용자 목록/ })).toBeChecked();
    expect(screen.getByRole('button', { name: '선택한 체크리스트로 교체' })).toBeEnabled();
  });
});

it('데스크탑은 목록과 지도를 유지한 채 상세 패널 안에서 체크리스트를 교체한다', async () => {
  const originalMatchMedia = window.matchMedia;
  const viewport = vi
    .spyOn(window, 'matchMedia')
    .mockImplementation((query) => ({ ...originalMatchMedia(query), matches: query === '(min-width: 1024px)' }));
  resetMockStore();
  server.use(...propertyHandlers, ...propertyChecklistHandlers);
  try {
    const user = userEvent.setup();
    renderAuthenticated('/properties/10?tab=checklist');
    const replace = await screen.findByRole('link', { name: '사용자 체크리스트 교체' });
    const map = screen.getByLabelText('데모 지도');
    await user.click(replace);
    const heading = await screen.findByRole('heading', { name: '체크리스트 교체', level: 1 });
    expect(screen.getByLabelText('선택한 매물 상세')).toContainElement(heading);
    expect(screen.getByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
    expect(screen.getByLabelText('데모 지도')).toBe(map);
    expect(screen.getByRole('button', { name: '선택한 체크리스트로 교체' })).toBeDisabled();
    const other = screen.getAllByRole('checkbox').find((box) => !(box as HTMLInputElement).checked);
    if (other === undefined) throw new Error('고를 다른 체크리스트가 없어요.');
    await user.click(other);
    await user.click(screen.getByRole('button', { name: '선택한 체크리스트로 교체' }));
    expect(await screen.findByRole('tab', { name: '체크리스트', selected: true })).toBeInTheDocument();
    expect(screen.getByLabelText('데모 지도')).toBe(map);
  } finally {
    viewport.mockRestore();
  }
});

const withDesktopViewport = async (run: () => Promise<void>) => {
  const originalMatchMedia = window.matchMedia;
  const viewport = vi
    .spyOn(window, 'matchMedia')
    .mockImplementation((query) => ({ ...originalMatchMedia(query), matches: query === '(min-width: 1024px)' }));
  try {
    await run();
  } finally {
    viewport.mockRestore();
  }
};

describe('데스크탑 체크리스트 교체 패널의 만들기', () => {
  const openReplacePanel = async (user: ReturnType<typeof userEvent.setup>) => {
    renderAuthenticated('/properties/10?tab=checklist');
    await user.click(await screen.findByRole('link', { name: '사용자 체크리스트 교체' }, { timeout: 8000 }));
    await screen.findByRole('heading', { name: '체크리스트 교체', level: 1 }, { timeout: 8000 });
  };

  it('만들기를 누르면 주소 이동 없이 패널이 편집 화면으로 바뀌고 목록과 지도는 그대로다', async () =>
    withDesktopViewport(async () => {
      resetMockStore();
      server.use(...propertyHandlers, ...propertyChecklistHandlers);
      const user = userEvent.setup();
      await openReplacePanel(user);
      const map = screen.getByLabelText('데모 지도');
      await user.click(screen.getByRole('button', { name: '새 체크리스트' }));
      const heading = await screen.findByRole('heading', { name: '체크리스트 만들기', level: 1 });
      expect(screen.getByLabelText('선택한 매물 상세')).toContainElement(heading);
      expect(screen.queryByRole('heading', { name: '체크리스트 교체', level: 1 })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
      expect(screen.getByLabelText('데모 지도')).toBe(map);
    }));

  it('취소하면 변경 없이 교체 화면으로 돌아온다', async () =>
    withDesktopViewport(async () => {
      resetMockStore();
      server.use(...propertyHandlers, ...propertyChecklistHandlers);
      const user = userEvent.setup();
      await openReplacePanel(user);
      await user.click(screen.getByRole('button', { name: '새 체크리스트' }));
      await screen.findByRole('heading', { name: '체크리스트 만들기', level: 1 });
      await user.click(screen.getByRole('button', { name: '체크리스트 교체로 돌아가기' }));
      expect(await screen.findByRole('heading', { name: '체크리스트 교체', level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '선택한 체크리스트로 교체' })).toBeDisabled();
      expect(screen.getByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
    }));

  it('저장하면 교체 화면으로 돌아와 새 체크리스트가 선택된 상태로 보인다', async () =>
    withDesktopViewport(async () => {
      resetMockStore();
      let created = false;
      server.use(
        http.get(`${config.apiBaseUrl}/api/check-items`, () =>
          HttpResponse.json(successEnvelope(checkItemPageFixture([onSiteItemFixture]))),
        ),
        http.get(`${config.apiBaseUrl}/api/checklists`, () =>
          HttpResponse.json(
            successEnvelope(
              checklistPageFixture(created ? [{ ...onSiteChecklistSummary, id: 9, name: '새 사용자 목록' }] : []),
            ),
          ),
        ),
        http.post(`${config.apiBaseUrl}/api/checklists`, () => {
          created = true;
          return HttpResponse.json(successEnvelope(finalChecklistDetail({ id: 9, name: '새 사용자 목록' })), {
            status: 201,
          });
        }),
        ...propertyHandlers,
        ...propertyChecklistHandlers,
      );
      const user = userEvent.setup();
      await openReplacePanel(user);
      await user.click(screen.getByRole('button', { name: '새 체크리스트' }));
      await user.click(await screen.findByRole('checkbox', { name: onSiteItemFixture.question }));
      await user.click(screen.getByRole('button', { name: '선택한 1개 항목 추가' }));
      await user.click(screen.getByRole('button', { name: '체크리스트 저장' }));
      expect(await screen.findByRole('heading', { name: '체크리스트 교체', level: 1 })).toBeInTheDocument();
      expect(await screen.findByRole('checkbox', { name: /새 사용자 목록/ })).toBeChecked();
      expect(screen.getByRole('button', { name: '선택한 체크리스트로 교체' })).toBeEnabled();
      expect(screen.getByRole('heading', { name: '모든 기록' })).toBeInTheDocument();
    }));
});

describe('데스크탑 체크리스트 목록과 편집 칸', () => {
  const useListHandlers = () => {
    let created = false;
    server.use(
      ...propertyHandlers,
      http.get(`${config.apiBaseUrl}/api/checklists`, () =>
        HttpResponse.json(
          successEnvelope(
            checklistPageFixture(
              created
                ? [onSiteChecklistSummary, { ...secondOnSiteChecklistSummary, id: 9, name: '새 사용자 목록' }]
                : [onSiteChecklistSummary],
            ),
          ),
        ),
      ),
      http.get(`${config.apiBaseUrl}/api/checklists/7`, () =>
        HttpResponse.json(successEnvelope(finalChecklistDetail())),
      ),
      http.get(`${config.apiBaseUrl}/api/check-items`, () =>
        HttpResponse.json(successEnvelope(checkItemPageFixture([onSiteItemFixture]))),
      ),
      http.post(`${config.apiBaseUrl}/api/checklists`, () => {
        created = true;
        return HttpResponse.json(successEnvelope(finalChecklistDetail({ id: 9, name: '새 사용자 목록' })), {
          status: 201,
        });
      }),
    );
  };

  it('새 체크리스트를 누르면 목록은 왼쪽 칸에 두고 만들기는 옆 상세 칸에서 열린다', async () =>
    withDesktopViewport(async () => {
      resetMockStore();
      useListHandlers();
      const user = userEvent.setup();
      renderAuthenticated('/checklists');
      expect(await screen.findByRole('heading', { name: '체크리스트', level: 1 })).toBeInTheDocument();
      expect(screen.queryByLabelText('체크리스트 편집')).not.toBeInTheDocument();
      expect(screen.queryByText('기본 체크리스트')).not.toBeInTheDocument();
      const map = screen.getByLabelText('데모 지도');
      await user.click(await screen.findByRole('link', { name: /새 체크리스트/ }));
      const heading = await screen.findByRole('heading', { name: '체크리스트 만들기', level: 1 });
      expect(screen.getByLabelText('체크리스트 편집')).toContainElement(heading);
      expect(screen.getByRole('heading', { name: '체크리스트', level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /전화 문의 기본 목록/ })).toBeInTheDocument();
      expect(screen.getByLabelText('데모 지도')).toBe(map);
    }));

  it('항목 고르기 하단 바는 화면 고정이 아니라 편집 칸 안에 붙는다', async () =>
    withDesktopViewport(async () => {
      resetMockStore();
      useListHandlers();
      const user = userEvent.setup();
      renderAuthenticated('/checklists/new');
      const add = await screen.findByRole('button', { name: /항목 추가/ });
      const bar = add.parentElement;
      if (bar === null) throw new Error('하단 바가 없어요.');
      expect(screen.getByLabelText('체크리스트 편집')).toContainElement(bar);
      expect(getComputedStyle(bar).position).toBe('absolute');
      expect(getComputedStyle(bar).width).toBe('100%');
      await user.click(screen.getByRole('button', { name: '체크리스트 관리로 돌아가기' }));
    }));

  it('기존 체크리스트를 누르면 상세 칸에서 편집하고 저장하면 칸이 닫힌다', async () =>
    withDesktopViewport(async () => {
      resetMockStore();
      useListHandlers();
      const user = userEvent.setup();
      renderAuthenticated('/checklists');
      await user.click(await screen.findByRole('link', { name: /전화 문의 기본 목록/ }));
      expect(await screen.findByRole('heading', { name: '체크리스트 편집', level: 1 })).toBeInTheDocument();
      const name = await screen.findByRole('textbox', { name: '체크리스트 이름' });
      expect(screen.getByLabelText('체크리스트 편집')).toContainElement(name);
      await user.type(name, ' 수정');
      server.use(
        http.get('*/api/properties', () => HttpResponse.json(successEnvelope({ items: [], totalCount: 0 }))),
        http.put(`${config.apiBaseUrl}/api/checklists/7`, () =>
          HttpResponse.json(successEnvelope(finalChecklistDetail())),
        ),
      );
      await user.click(screen.getByRole('button', { name: '변경 내용 저장' }));
      await waitFor(() => expect(screen.queryByLabelText('체크리스트 편집')).not.toBeInTheDocument());
      expect(screen.getByRole('heading', { name: '체크리스트', level: 1 })).toBeInTheDocument();
    }));

  it('만들어 저장하면 상세 칸이 닫히고 새 체크리스트가 목록에 보인다', async () =>
    withDesktopViewport(async () => {
      resetMockStore();
      useListHandlers();
      const user = userEvent.setup();
      renderAuthenticated('/checklists');
      await user.click(await screen.findByRole('link', { name: /새 체크리스트/ }));
      await user.click(await screen.findByRole('checkbox', { name: onSiteItemFixture.question }));
      await user.click(screen.getByRole('button', { name: '선택한 1개 항목 추가' }));
      await user.click(screen.getByRole('button', { name: '체크리스트 저장' }));
      expect(await screen.findByRole('link', { name: /새 사용자 목록/ })).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByLabelText('체크리스트 편집')).not.toBeInTheDocument());
    }));

  it('취소와 뒤로가기는 상세 칸을 닫고 목록으로 돌아온다', async () =>
    withDesktopViewport(async () => {
      resetMockStore();
      useListHandlers();
      const user = userEvent.setup();
      renderAuthenticated('/checklists');
      await user.click(await screen.findByRole('link', { name: /새 체크리스트/ }));
      await screen.findByRole('heading', { name: '체크리스트 만들기', level: 1 });
      await user.click(screen.getByRole('button', { name: '취소' }));
      await waitFor(() => expect(screen.queryByLabelText('체크리스트 편집')).not.toBeInTheDocument());
      expect(screen.getByRole('link', { name: /전화 문의 기본 목록/ })).toBeInTheDocument();
    }));
});

it('체크리스트 이름을 수정한 뒤 저장 API로 전달한다', async () => {
  const saved = vi.fn();
  server.use(
    http.get('*/api/checklists/7', () => HttpResponse.json(successEnvelope(finalChecklistDetail()))),
    http.get('*/api/properties', () => HttpResponse.json(successEnvelope({ items: [], totalCount: 0 }))),
    http.put('*/api/checklists/7', async ({ request }) => {
      const body = await request.json();
      saved(body);
      return HttpResponse.json(successEnvelope(finalChecklistDetail({ name: '새 체크리스트 이름' })));
    }),
  );
  const user = userEvent.setup();
  renderAuthenticated('/checklists/7');
  const input = await screen.findByRole('textbox', { name: '체크리스트 이름' });
  await user.clear(input);
  await user.type(input, '새 체크리스트 이름');
  await user.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(expect.objectContaining({ name: '새 체크리스트 이름' })));
  expect(await screen.findByRole('heading', { name: '체크리스트 관리' })).toBeInTheDocument();
});

it('체크리스트 삭제는 취소할 수 있고 확인한 경우에만 삭제한다', async () => {
  const removed = vi.fn();
  server.use(
    http.get('*/api/checklists/7', () => HttpResponse.json(successEnvelope(finalChecklistDetail()))),
    http.delete('*/api/checklists/7', () => {
      removed();
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const user = userEvent.setup();
  renderAuthenticated('/checklists/7');
  await user.click(await screen.findByRole('button', { name: '체크리스트 삭제' }));
  let dialog = within(screen.getByRole('dialog', { name: '체크리스트를 삭제할까요?' }));
  await user.click(dialog.getByRole('button', { name: '취소' }));
  expect(removed).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '체크리스트 삭제' }));
  dialog = within(screen.getByRole('dialog', { name: '체크리스트를 삭제할까요?' }));
  await user.click(dialog.getByRole('button', { name: /^삭제$/ }));
  await waitFor(() => expect(removed).toHaveBeenCalledOnce());
  expect(await screen.findByRole('heading', { name: '체크리스트 관리' })).toBeInTheDocument();
});
