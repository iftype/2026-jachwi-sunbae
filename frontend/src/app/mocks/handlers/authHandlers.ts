import { http } from 'msw';

import { success } from '../mockStore';

// 로컬 목은 Refresh 쿠키를 흉내 내지 않고 늘 같은 익명 회원(1번)으로 복원한다.
const tokenResponse = () =>
  success({
    accessToken: 'local-msw-access-token',
    tokenType: 'Bearer',
    expiresIn: 900,
    newMember: false,
    member: { memberId: 1 },
  });

export const authHandlers = [
  http.post('*/api/auth/login', tokenResponse),
  http.post('*/api/auth/refresh', tokenResponse),
  http.get('*/api/members/me', () => success({ id: 1 })),
];
