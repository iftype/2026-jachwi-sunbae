import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import App from '@/app/App';
import {
  checkItemPageFixture,
  checklistPageFixture,
  checklistSummaryFixture,
  customChecklistItemFixture,
  mixedChecklistDetailFixture,
  onlineItemFixture,
  presetFixture,
  providedChecklistItemFixture,
  secondChecklistSummaryFixture,
} from '@/app/mocks/fixtures/checklistFixtures';
import {
  errorEnvelope,
  memberFixture,
  photoFixture,
  propertyDetailResponseFixture,
  propertyPageFixture,
  propertyPhotoResponseFixture,
  propertySummaryFixture,
  secondPropertySummaryFixture,
  successEnvelope,
} from '@/app/mocks/fixtures/propertyFixtures';
import { clearAuthentication, setAuthentication } from '@/features/auth/model/authStore';
import type { ChecklistDetail } from '@/features/checklist/model/checklistTypes';

import ComponentCatalog from './ComponentCatalog';

const scenario = new URLSearchParams(window.location.search).get('scenario') ?? 'list-two';

const routeByScenario: Record<string, string> = {
  components: '/',
  login: '/login',
  unauthorized: '/',
  'not-found': '/does-not-exist',
  'list-empty': '/',
  'list-two': '/',
  new: '/properties/new',
  detail: '/properties/10',
  'memo-empty': '/properties/10',
  'memo-success': '/properties/10',
  'memo-failure': '/properties/10',
  'property-delete': '/properties/10',
  'photos-empty': '/properties/10/photos',
  'photos-many': '/properties/10/photos',
  'photo-read-failure': '/properties/10/photos',
  'photo-delete': '/properties/10/photos',
  'checklist-home': '/checklists',
  'checklist-list': '/checklists/ON_SITE',
  'checklist-create': '/checklists/new?stage=ON_SITE',
  'checklist-detail': '/checklists/7',
  'checklist-detail-inactive': '/checklists/7',
  'checklist-detail-many': '/checklists/7',
  'checklist-save-failure': '/checklists/7',
  'active-checklist': '/properties/10/active-checklists/ON_SITE',
  my: '/me',
  'todo-compare': '/compare',
  'todo-export': '/export',
  'todo-tips': '/tips',
};

window.history.replaceState(null, '', routeByScenario[scenario] ?? '/');
if (scenario === 'login') {
  clearAuthentication(null);
} else if (scenario !== 'components') {
  setAuthentication({ accessToken: 'browser-test-memory-token', tokenType: 'Bearer', expiresIn: 60 * 60 });
}

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const createPlaceholderPhoto = (photoId: number) => {
  const palettes = [
    ['#c8d4b4', '#73875c'],
    ['#e4d5b8', '#9b805c'],
    ['#c9d6d8', '#6d8588'],
    ['#d8c7c2', '#8b6d64'],
    ['#d5d1bd', '#79735c'],
  ];
  const [start, end] = palettes[photoId % palettes.length];
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 480;
  const context = canvas.getContext('2d');

  if (context === null) return Promise.resolve(new Blob([], { type: 'image/png' }));

  const gradient = context.createLinearGradient(0, 0, 480, 480);
  gradient.addColorStop(0, start);
  gradient.addColorStop(1, end);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 480, 480);
  context.strokeStyle = 'rgba(255,255,255,.72)';
  context.lineWidth = 18;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(70, 345);
  context.lineTo(180, 225);
  context.lineTo(252, 295);
  context.lineTo(300, 250);
  context.lineTo(410, 345);
  context.stroke();
  context.fillStyle = 'rgba(255,255,255,.72)';
  context.beginPath();
  context.arc(165, 150, 38, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,.9)';
  context.font = '28px sans-serif';
  context.textAlign = 'center';
  context.fillText(`PHOTO ${photoId - 80}`, 240, 420);

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? new Blob([], { type: 'image/png' })), 'image/png');
  });
};

const photos = Array.from({ length: 8 }, (_, index) => ({
  ...photoFixture,
  photoId: 81 + index,
  contentUrl: `/api/properties/10/photos/${81 + index}`,
  createdAt: `2026-08-10T07:${String(35 + index).padStart(2, '0')}:00Z`,
}));
const photoResponses = photos.map((photo) => propertyPhotoResponseFixture(photo));
// 매물 상세의 photos 는 사진 목록과 달리 propertyId 를 갖지 않는다.
const detailPhotoResponses = photoResponses.map(({ propertyId: _propertyId, ...photo }) => photo);

let checklistSaveAttempts = 0;
let createdChecklist = {
  ...mixedChecklistDetailFixture,
  checklistId: 9,
  name: '브라우저 생성 체크리스트',
} as ChecklistDetail;

const systemCheckItems = presetFixture.items.map(({ id, stage, itemType, question }) => ({
  id,
  stage,
  itemType,
  question,
}));

type BrowserChecklistItemInput = { systemCheckItemId?: unknown; question?: unknown };
type BrowserChecklistResponseItem = {
  id: number;
  origin: 'PROVIDED' | 'CUSTOM';
  systemCheckItemId: number | null;
  itemType: 'CORE' | 'OPTIONAL';
  question: string;
  displayOrder: number;
  active: boolean;
};

const toChecklistResponseItems = (inputs: BrowserChecklistItemInput[]): BrowserChecklistResponseItem[] => {
  const result: BrowserChecklistResponseItem[] = [];
  inputs.forEach((input, index) => {
    if (typeof input.systemCheckItemId === 'number') {
      const item = systemCheckItems.find((candidate) => candidate.id === input.systemCheckItemId);
      if (item !== undefined) {
        result.push({
          id: 700 + index,
          origin: 'PROVIDED',
          systemCheckItemId: item.id,
          itemType: item.itemType,
          question: item.question,
          displayOrder: index + 1,
          active: true,
        });
      }
      return;
    }
    if (input.systemCheckItemId === null && typeof input.question === 'string' && input.question.trim().length > 0) {
      result.push({
        id: 700 + index,
        origin: 'CUSTOM',
        systemCheckItemId: null,
        itemType: 'OPTIONAL',
        question: input.question.trim(),
        displayOrder: index + 1,
        active: true,
      });
    }
  });
  return result;
};

type PropertyChecklistWire = {
  id: number;
  propertyId: number;
  sourceChecklistId: number;
  checklistName: string;
  stage: 'ON_SITE' | 'PRE_CONTRACT';
  items: Array<{
    id: number;
    systemCheckItemId: number;
    question: string;
    displayOrder: number;
    status: 'UNCONFIRMED' | 'GOOD' | 'CAUTION';
    memo: string;
  }>;
};

let propertyChecklist: PropertyChecklistWire = {
  id: 71,
  propertyId: 10,
  sourceChecklistId: 7,
  checklistName: checklistSummaryFixture.name,
  stage: 'ON_SITE' as const,
  items: [
    {
      id: 711,
      systemCheckItemId: 101,
      question: onlineItemFixture.question,
      displayOrder: 1,
      status: 'GOOD' as const,
      memo: '수도 요금 포함',
    },
    {
      id: 712,
      systemCheckItemId: 102,
      question: presetFixture.items[1]?.question ?? '입주 가능한 날짜는 언제인가요?',
      displayOrder: 2,
      status: 'CAUTION' as const,
      memo: '날짜 재확인 필요',
    },
  ],
};

const browserTestFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/auth/refresh' && request.method === 'POST' && scenario === 'unauthorized') {
    return jsonResponse(errorEnvelope('REFRESH_TOKEN_INVALID'), 401);
  }

  if ((path === '/api/auth/login' || path === '/api/auth/refresh') && request.method === 'POST') {
    return jsonResponse(
      successEnvelope({
        accessToken: 'browser-test-auto-login-token',
        tokenType: 'Bearer',
        expiresIn: 3_600,
        newMember: false,
        member: { memberId: 1 },
      }),
    );
  }

  if (path === '/api/members/me' && request.method === 'GET') {
    if (scenario === 'unauthorized') return jsonResponse(errorEnvelope('ACCESS_TOKEN_INVALID'), 401);
    return jsonResponse(successEnvelope(memberFixture));
  }

  if (path === '/api/properties' && request.method === 'GET') {
    const content = scenario === 'list-empty' ? [] : [propertySummaryFixture, secondPropertySummaryFixture];
    return jsonResponse(successEnvelope(propertyPageFixture(content)));
  }

  if (path === '/api/properties' && request.method === 'POST') {
    return jsonResponse(
      successEnvelope({
        id: 10,
        name: '브라우저 등록 매물',
        depositAmount: 10_000_000,
        monthlyRentAmount: 550_000,
        discoverySource: '동네 중개사 추천',
        address: '서울 관악구 신림로 12',
        latitude: 37.484,
        longitude: 126.929,
        availableMoveInDate: null,
        maintenanceFeeAmount: null,
        visitScheduledAt: null,
        roomOptions: [],
        utilityOptions: [],
        createdAt: '2026-08-10T07:30:00Z',
        updatedAt: '2026-08-10T07:30:00Z',
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
      201,
    );
  }

  if (path === '/api/properties/10' && request.method === 'GET') {
    const detail = propertyDetailResponseFixture();
    return jsonResponse(
      successEnvelope({
        ...detail,
        name: '긴 이름도 줄바꿈되는 신림역 근처 채광 좋은 원룸 매물',
        depositAmount: Number.MAX_SAFE_INTEGER,
        discoverySource:
          '동네를 걷다가 발견한 중개사에서 소개받은 매우 긴 발견 경로 설명입니다. 화면 밖으로 넘치지 않아야 합니다.',
        photos: scenario === 'photos-empty' ? [] : detailPhotoResponses.slice(0, 5),
      }),
    );
  }

  if (path === '/api/properties/10/memo' && request.method === 'GET') {
    return jsonResponse(
      successEnvelope({
        propertyId: 10,
        freeMemo: scenario === 'memo-empty' ? '' : '채광 다시 확인',
      }),
    );
  }

  if (path === '/api/properties/10/memo' && request.method === 'PUT') {
    if (scenario === 'memo-failure') return jsonResponse(errorEnvelope('INTERNAL_SERVER_ERROR'), 500);
    const body = (await request.json()) as { freeMemo: string };
    return jsonResponse(successEnvelope({ propertyId: 10, freeMemo: body.freeMemo }));
  }

  if (path === '/api/check-items' && request.method === 'GET') {
    const stage = url.searchParams.get('stage');
    const query = url.searchParams.get('query')?.trim() ?? '';
    const items = systemCheckItems.filter(
      (item) => item.stage === stage && (query.length === 0 || item.question.includes(query)),
    );
    return jsonResponse(successEnvelope(checkItemPageFixture(items)));
  }

  if (path === '/api/checklist-presets' && request.method === 'GET') {
    return jsonResponse(successEnvelope(presetFixture));
  }

  if (path === '/api/checklists' && request.method === 'GET') {
    return jsonResponse(
      successEnvelope(checklistPageFixture([checklistSummaryFixture, secondChecklistSummaryFixture])),
    );
  }

  if (path === '/api/checklists' && request.method === 'POST') {
    const body = (await request.json()) as {
      name?: unknown;
      stage?: unknown;
      items?: unknown;
    };
    const inputs = Array.isArray(body.items) ? (body.items as BrowserChecklistItemInput[]) : [];
    const responseItems = toChecklistResponseItems(inputs);
    const response = {
      id: 9,
      name: typeof body.name === 'string' ? body.name : '브라우저 생성 체크리스트',
      stage: 'ON_SITE' as const,
      itemCount: responseItems.length,
      items: responseItems,
    };
    createdChecklist = {
      ...mixedChecklistDetailFixture,
      checklistId: response.id,
      name: response.name,
      stage: response.stage,
      itemCount: response.itemCount,
      items: responseItems.map((item) =>
        item.origin === 'PROVIDED' && item.systemCheckItemId !== null
          ? {
              checklistItemId: item.id,
              origin: 'PROVIDED' as const,
              sourceCheckItemId: item.systemCheckItemId,
              checkItemId: item.systemCheckItemId,
              itemType: item.itemType,
              question: item.question,
              guide: null,
              order: item.displayOrder,
              active: item.active,
            }
          : {
              checklistItemId: item.id,
              origin: 'CUSTOM' as const,
              sourceCheckItemId: null,
              checkItemId: null,
              itemType: item.itemType,
              question: item.question,
              guide: null,
              order: item.displayOrder,
              active: item.active,
            },
      ),
    };
    return jsonResponse(successEnvelope(response), 201);
  }

  if (path === '/api/checklists/9' && request.method === 'GET') {
    return jsonResponse(
      successEnvelope({
        id: createdChecklist.checklistId,
        name: createdChecklist.name,
        stage: createdChecklist.stage,
        itemCount: createdChecklist.itemCount,
        items: createdChecklist.items.map((item) => ({
          id: item.checklistItemId,
          origin: item.origin,
          systemCheckItemId: item.sourceCheckItemId,
          itemType: item.itemType,
          question: item.question,
          displayOrder: item.order,
          active: item.active,
        })),
      }),
    );
  }

  if (path === '/api/checklists/7' && request.method === 'GET') {
    const inactiveItem = {
      ...providedChecklistItemFixture,
      id: 799,
      checklistItemId: 799,
      sourceCheckItemId: 999,
      checkItemId: 999,
      question: '기존에만 남아 있는 매우 긴 비활성 제공 항목으로 유지와 제거 여부를 직접 결정해야 합니다.',
      order: 1,
    };
    const manyCustomItems = Array.from({ length: 16 }, (_, index) => ({
      ...customChecklistItemFixture,
      id: 800 + index,
      checklistItemId: 800 + index,
      question: index === 0 ? `🏠${'가'.repeat(199)}` : `직접 추가한 확인 질문 ${index + 1}`,
      order: index + 2,
    }));
    const items =
      scenario === 'checklist-detail-inactive'
        ? [inactiveItem, customChecklistItemFixture]
        : scenario === 'checklist-detail-many'
          ? [providedChecklistItemFixture, ...manyCustomItems]
          : mixedChecklistDetailFixture.items;
    return jsonResponse(
      successEnvelope({
        ...mixedChecklistDetailFixture,
        name: '긴 이름도 안전하게 표시되는 온라인과 전화로 미리 확인할 체크리스트',
        items,
        itemCount: items.length,
      }),
    );
  }

  if (path === '/api/checklists/7' && request.method === 'PUT') {
    checklistSaveAttempts += 1;
    if (scenario === 'checklist-save-failure' && checklistSaveAttempts === 1) {
      return jsonResponse(errorEnvelope('INTERNAL_SERVER_ERROR'), 500);
    }
    const body = (await request.json()) as {
      name?: unknown;
      items?: unknown;
    };
    const inputs = Array.isArray(body.items) ? (body.items as BrowserChecklistItemInput[]) : [];
    const items = toChecklistResponseItems(inputs);
    return jsonResponse(
      successEnvelope({
        id: 7,
        name: typeof body.name === 'string' ? body.name : mixedChecklistDetailFixture.name,
        stage: 'ON_SITE',
        items,
        itemCount: items.length,
      }),
    );
  }

  if (path === '/api/checklists/7' && request.method === 'DELETE') {
    return new Response(null, { status: 200 });
  }

  if (path === '/api/properties/10/checklists/ON_SITE' && request.method === 'PUT') {
    const body = (await request.json()) as { checklistId?: unknown };
    const sourceChecklistId = typeof body.checklistId === 'number' ? body.checklistId : 7;
    propertyChecklist = {
      ...propertyChecklist,
      sourceChecklistId,
      checklistName: sourceChecklistId === 8 ? secondChecklistSummaryFixture.name : checklistSummaryFixture.name,
    };
    return jsonResponse(successEnvelope(propertyChecklist));
  }

  if (path === '/api/properties/10/checklists' && request.method === 'GET') {
    const progress = {
      totalCount: propertyChecklist.items.length,
      completedCount: propertyChecklist.items.filter((item) => item.status !== 'UNCONFIRMED').length,
      goodCount: propertyChecklist.items.filter((item) => item.status === 'GOOD').length,
      cautionCount: propertyChecklist.items.filter((item) => item.status === 'CAUTION').length,
      unconfirmedCount: propertyChecklist.items.filter((item) => item.status === 'UNCONFIRMED').length,
      progressRate: 100,
    };
    const emptyProgress = {
      totalCount: 0,
      completedCount: 0,
      goodCount: 0,
      cautionCount: 0,
      unconfirmedCount: 0,
      progressRate: 0,
    };
    return jsonResponse(
      successEnvelope({
        propertyId: 10,
        overallProgress: progress,
        stages: [
          {
            stage: 'ON_SITE',
            applied: true,
            propertyChecklistId: propertyChecklist.id,
            checklistName: propertyChecklist.checklistName,
            sourceChecklistId: propertyChecklist.sourceChecklistId,
            progress,
          },
          {
            stage: 'ON_SITE',
            applied: false,
            propertyChecklistId: null,
            checklistName: null,
            sourceChecklistId: null,
            progress: emptyProgress,
          },
          {
            stage: 'PRE_CONTRACT',
            applied: false,
            propertyChecklistId: null,
            checklistName: null,
            sourceChecklistId: null,
            progress: emptyProgress,
          },
        ],
      }),
    );
  }

  if (path === `/api/properties/10/checklists/${propertyChecklist.id}` && request.method === 'GET') {
    return jsonResponse(successEnvelope(propertyChecklist));
  }

  if (/^\/api\/properties\/10\/checklists\/71\/items\/\d+\/status$/.test(path) && request.method === 'PATCH') {
    const itemId = Number(path.split('/').at(-2));
    const body = (await request.json()) as { status?: unknown };
    if (body.status !== 'UNCONFIRMED' && body.status !== 'GOOD' && body.status !== 'CAUTION') {
      return jsonResponse(errorEnvelope('INVALID_REQUEST'), 400);
    }
    const status = body.status;
    propertyChecklist = {
      ...propertyChecklist,
      items: propertyChecklist.items.map((item) => (item.id === itemId ? { ...item, status } : item)),
    };
    return jsonResponse(successEnvelope({ item: { id: itemId, status } }));
  }

  if (/^\/api\/properties\/10\/checklists\/71\/items\/\d+\/memo$/.test(path) && request.method === 'PATCH') {
    const itemId = Number(path.split('/').at(-2));
    const body = (await request.json()) as { memo?: unknown };
    if (typeof body.memo !== 'string') return jsonResponse(errorEnvelope('INVALID_REQUEST'), 400);
    const memo = body.memo;
    propertyChecklist = {
      ...propertyChecklist,
      items: propertyChecklist.items.map((item) => (item.id === itemId ? { ...item, memo } : item)),
    };
    return jsonResponse(successEnvelope({ item: { id: itemId, memo } }));
  }

  if (path === '/api/properties/10' && request.method === 'DELETE') {
    return new Response(null, { status: 200 });
  }

  if (path === '/api/properties/10/photos' && request.method === 'GET') {
    const selectedPhotos = scenario === 'photos-empty' ? [] : photoResponses;
    return jsonResponse(successEnvelope({ propertyId: 10, items: selectedPhotos, totalCount: selectedPhotos.length }));
  }

  if (path === '/api/properties/10/photos' && request.method === 'POST') {
    return jsonResponse(errorEnvelope('API_CONTRACT_NOT_IMPLEMENTED'), 501);
  }

  if (/^\/api\/properties\/10\/photos\/\d+$/.test(path) && request.method === 'GET') {
    if (scenario === 'photo-read-failure') return jsonResponse(errorEnvelope('PHOTO_READ_FAILED'), 500);
    const photoId = Number(path.match(/photos\/(\d+)$/)?.[1] ?? 81);
    return new Response(await createPlaceholderPhoto(photoId), { headers: { 'Content-Type': 'image/png' } });
  }

  if (/^\/api\/properties\/10\/photos\/\d+$/.test(path) && request.method === 'DELETE') {
    return new Response(null, { status: 200 });
  }

  if (/^\/api\/properties\/10\/photos\/\d+\/representative$/.test(path) && request.method === 'PUT') {
    return new Response(null, { status: 200 });
  }

  return jsonResponse(errorEnvelope('INTERNAL_SERVER_ERROR'), 500);
};

window.fetch = browserTestFetch;

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('브라우저 테스트 루트 요소를 찾을 수 없습니다.');
}

createRoot(rootElement).render(
  <StrictMode>
    {scenario === 'components' ? (
      <MemoryRouter>
        <ComponentCatalog />
      </MemoryRouter>
    ) : (
      <App
        config={{
          apiBaseUrl: 'http://localhost:8080',
        }}
      />
    )}
  </StrictMode>,
);
