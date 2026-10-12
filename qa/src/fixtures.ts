import { test as base } from '@playwright/test';

import { applyFault } from './faults';
import { type ApiMember, type QaMember, startApiMember, startAsNewMember } from './member';
import { nextRunId } from './run-id';

// QA 실행이 제품 분석 데이터에 섞이지 않도록 분석 요청을 보내지 않는다.
const ANALYTICS_URL = /posthog\.com/;

type QaFixtures = {
  /** 이 테스트만 쓰는 새 회원. 사용하면 로그인한 상태로 매물 목록에서 시작한다. */
  member: QaMember;
  /** 같은 Run의 두 번째 회원 `qa-{runId}-b`. 화면 없이 API로 시작한다. 사용하면 member도 함께 준비된다. */
  otherMember: ApiMember;
};

export const test = base.extend<QaFixtures>({
  context: async ({ context }, use) => {
    await context.route(ANALYTICS_URL, (route) => route.abort());
    // QA_FAULT를 지정하면 의도적 결함을 주입한다. 지정하지 않으면 아무것도 바꾸지 않는다.
    await applyFault(context);
    await use(context);
  },
  member: async ({ page }, use) => {
    const runId = await nextRunId();
    await use(await startAsNewMember(page, runId));
  },
  otherMember: async ({ member, request }, use) => {
    await use(await startApiMember(request, member.apiOrigin, `${member.nickname}-b`));
  },
});

export { expect } from '@playwright/test';
