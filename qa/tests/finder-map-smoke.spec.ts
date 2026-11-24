import type { Page } from "@playwright/test";

import { expect, test } from "../src/fixtures";

// 동네 찾기와 지도 정리 전후를 같은 화면으로 비교하려는 스모크다. 제품 동작 판정은 Scenario 테스트가 한다.
// 로그인 화면이 없어져 회원 픽스처를 쓰지 않는다. 처음 열면 앱이 익명 회원으로 자동 로그인한다.
// QA_SMOKE_STAGE(예: before, after)를 지정하면 단계별 스크린샷을 runs/finder-map-smoke/{단계}/에 남긴다.
const STAGE = process.env.QA_SMOKE_STAGE ?? "adhoc";
const SAMPLE_PROPERTY = "(미리보기) 코엑스 근처";
// 미리보기 매물은 기록이 없는 새 회원에게만 보인다. 로컬 목(serve.mjs --api mock)은 늘 기록이 있는 회원처럼 답하므로
// 목이 새 회원처럼 빈 매물 목록을 주게 하는 쿠키를 넣는다. dev 서버는 이 쿠키를 모르고 새 회원으로 답한다.
const MOCK_NEW_MEMBER_COOKIE = "jachwi-mock-new-member";

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: MOCK_NEW_MEMBER_COOKIE, value: "true", url: baseURL ?? "" }]);
});

const shot = async (page: Page, name: string): Promise<void> => {
  await page.screenshot({ path: `runs/finder-map-smoke/${STAGE}/${name}.png` });
};

const dismissGuide = async (page: Page): Promise<void> => {
  const confirm = page.getByRole("button", { name: "확인", exact: true });
  await confirm.click({ timeout: 5_000 }).catch(() => undefined);
};

test("동네 찾기: 지도에서 목적지를 고르면 통근 동네 결과가 나온다", async ({ page }) => {
  await page.goto("/explore");
  await dismissGuide(page);
  await expect(page.getByText("이 조건으로 추천받아요")).toBeVisible();
  await expect(page.getByText("© NAVER Corp.").first()).toBeAttached();
  await shot(page, "01-explore-conditions");

  await page.getByRole("button", { name: "지도에서 목적지 선택" }).click();
  await expect(page.getByText("지도에서 출퇴근 장소를 눌러 주세요")).toBeVisible();
  await page.touchscreen.tap(200, 300);

  const search = page.getByRole("button", { name: /에서 찾기$/ });
  await expect(search).toBeVisible();
  await shot(page, "02-explore-destination-picked");

  const resultsPromise = page.waitForResponse((response) => response.url().includes("/api/commute-areas/with-rents"));
  await search.click();
  expect((await resultsPromise).ok()).toBe(true);

  await expect(page.getByText("선택한 지역")).toBeVisible();
  await expect(page.getByText(/^\d+분$/).first()).toBeVisible();
  await shot(page, "03-explore-results");
});

test("지도: 홈 지도에 매물 마커가 보이고 리스트와 지도 보기를 오간다", async ({ page }) => {
  await page.goto("/");
  await dismissGuide(page);
  await expect(page.getByText("© NAVER Corp.").first()).toBeAttached();
  await expect(page.getByText(SAMPLE_PROPERTY)).toBeVisible({ timeout: 20_000 });
  await shot(page, "04-home-map-marker");

  await page.getByRole("button", { name: "리스트", exact: true }).click();
  await expect(page.getByText(SAMPLE_PROPERTY)).toBeVisible();
  await shot(page, "05-home-list-view");

  await page.getByRole("button", { name: "지도", exact: true }).click();
  await expect(page.getByText(SAMPLE_PROPERTY)).toBeVisible();
});

test("매물 상세: 마커를 누르면 매물 카드가 열린다", async ({ page }) => {
  await page.goto("/");
  await dismissGuide(page);
  await page.getByText(SAMPLE_PROPERTY).click({ timeout: 20_000 });

  await expect(page.getByText("선택한 매물")).toBeVisible();
  await expect(page.getByText("보증금 3,000만원")).toBeVisible();
  await expect(page.getByText("월세 55만원")).toBeVisible();
  await shot(page, "06-property-card");
});
