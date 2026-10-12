import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type InsightDefinition = {
  id: number;
  kind: string;
  events?: string[];
  math?: string;
  aggregateBy?: string;
  windowHours?: number;
  targetActionId?: number;
  returningActionId?: number;
  totalIntervals?: number;
  period?: string;
};
type DashboardDefinition = {
  dateFrom: string;
  action: { id: number; events: string[] };
  insights: InsightDefinition[];
};
// 문서에 저장된 측정 계약의 회귀 검사. 원격 설정의 일치 여부는 별도로 조회해 검증한다.
const definition: DashboardDefinition = JSON.parse(readFileSync('docs/analytics-dashboard.json', 'utf8'));
describe('제품 목표 대시보드의 측정 계약', () => {
  it('로그인 성공 뒤에 실패를 필수 단계로 요구하지 않는다', () => {
    const login = definition.insights.find((i) => i.id === 12338944);
    expect(login?.events).toEqual(['$pageview', 'login_started', 'login_succeeded']);
  });
  it('두 등록 퍼널은 저장 성공에서 끝나고 주소 단계는 강제하지 않는다', () => {
    for (const id of [12338945, 12339244]) {
      const insight = definition.insights.find((i) => i.id === id);
      expect(insight?.events?.at(-1)).toBe('property_created');
      expect(insight?.events).not.toContain('property_creation_address_completed');
      expect(insight?.aggregateBy).toBe('properties.$session_id');
      expect(insight?.windowHours).toBe(1);
    }
  });
  it('재사용은 조회가 아닌 기록 행동이고 W4를 관찰할 기간을 확보한다', () => {
    const retention = definition.insights.find((i) => i.kind === 'RetentionQuery');
    expect(definition.dateFrom).toBe('-56d');
    expect(definition.action.events).toEqual(['checklist_item_checked', 'property_memo_saved']);
    expect(retention?.targetActionId).toBe(definition.action.id);
    expect(retention?.returningActionId).toBe(definition.action.id);
    expect(retention?.period).toBe('Week');
    expect(retention?.totalIntervals).toBe(5);
  });
  it('완료 지표를 요청 이벤트로 되돌리지 않는다', () => {
    const features = definition.insights.find((i) => i.id === 12338946);
    expect(features?.events).toContain('property_created');
    expect(features?.events).not.toContain('property_creation_submitted');
    expect(features?.math).toBe('dau');
  });
});
