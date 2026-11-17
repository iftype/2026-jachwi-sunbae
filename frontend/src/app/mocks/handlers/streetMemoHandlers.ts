import { http, HttpResponse } from 'msw';

import { failure, success } from '../mockStore';

export type MockStreetMemo = {
  streetMemoId: number;
  latitude: number;
  longitude: number;
  memo: string;
  preference: 'LIKE' | 'DISLIKE';
  isMine: boolean;
  /** 메모 위치의 행정동 코드. 서버가 찾지 못한 메모는 null이다. */
  adminDongCode?: string | null;
};

/**
 * 서울시청 근처에 다른 회원이 남긴 메모 두 개와, 동네 찾기 목업 결과의 역삼1동(`11230640`)에 남긴 메모 세 개.
 * 역삼1동의 마지막 메모는 행정동 코드가 없어 동네 찾기 지도에서 가까이 확대했을 때만 보인다.
 */
const SEED_MEMOS: MockStreetMemo[] = [
  {
    streetMemoId: 1,
    latitude: 37.5671,
    longitude: 126.9772,
    memo: '늦게까지 여는 세탁소가 있어요.',
    preference: 'LIKE',
    isMine: false,
    adminDongCode: '11140550',
  },
  {
    streetMemoId: 2,
    latitude: 37.5658,
    longitude: 126.9795,
    memo: '저녁에 배달 오토바이가 많이 다녀요.',
    preference: 'DISLIKE',
    isMine: false,
    adminDongCode: '11140550',
  },
  {
    streetMemoId: 3,
    latitude: 37.5003,
    longitude: 127.0359,
    memo: '역까지 평지라 걷기 편해요.',
    preference: 'LIKE',
    isMine: false,
    adminDongCode: '11230640',
  },
  {
    streetMemoId: 4,
    latitude: 37.4987,
    longitude: 127.0331,
    memo: '골목에 늦게까지 여는 식당이 많아요.',
    preference: 'LIKE',
    isMine: false,
    adminDongCode: '11230640',
  },
  {
    streetMemoId: 5,
    latitude: 37.5011,
    longitude: 127.0387,
    memo: '큰길 쪽은 밤에도 차 소리가 커요.',
    preference: 'DISLIKE',
    isMine: false,
    adminDongCode: null,
  },
];

const readBound = (params: URLSearchParams, key: string) => {
  const value = params.get(key);
  return value === null ? null : Number(value);
};

/** 호출마다 저장소를 새로 만든다. 테스트끼리 메모가 섞이지 않게 테스트는 매번 새로 만들어 쓴다. 새로 쓴 메모는 본인 메모가 된다. */
export const createStreetMemoHandlers = (initial: MockStreetMemo[] = SEED_MEMOS) => {
  const memos = initial.map((memo) => ({ ...memo }));
  let nextId = Math.max(0, ...memos.map((memo) => memo.streetMemoId)) + 1;
  return [
    http.get('*/api/street-memos', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const bounds = ['minLatitude', 'maxLatitude', 'minLongitude', 'maxLongitude'].map((key) =>
        readBound(params, key),
      );
      if (!bounds.every((value): value is number => value !== null && Number.isFinite(value)))
        return failure('STREET_MEMO_QUERY_INVALID', 400);
      const [south, north, west, east] = bounds;
      return success(
        memos.filter(
          (memo) =>
            memo.latitude >= south && memo.latitude <= north && memo.longitude >= west && memo.longitude <= east,
        ),
      );
    }),
    http.post('*/api/street-memos', async ({ request }) => {
      const body = (await request.json()) as Partial<MockStreetMemo>;
      if (
        typeof body.latitude !== 'number' ||
        typeof body.longitude !== 'number' ||
        typeof body.memo !== 'string' ||
        (body.preference !== 'LIKE' && body.preference !== 'DISLIKE')
      )
        return failure('STREET_MEMO_INVALID', 400);
      const memo: MockStreetMemo = {
        streetMemoId: nextId++,
        latitude: body.latitude,
        longitude: body.longitude,
        memo: body.memo,
        preference: body.preference,
        isMine: true,
        adminDongCode: null,
      };
      memos.push(memo);
      return success(memo, 201);
    }),
    http.delete('*/api/street-memos/:streetMemoId', ({ params }) => {
      const index = memos.findIndex((memo) => memo.streetMemoId === Number(params.streetMemoId) && memo.isMine);
      if (index === -1) return failure('STREET_MEMO_NOT_FOUND', 404);
      memos.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
};

export const streetMemoHandlers = createStreetMemoHandlers();
