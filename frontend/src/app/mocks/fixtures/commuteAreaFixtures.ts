// 경계만 사용자 제공 실데이터. 통근 시간·정류장·환승 조건은 테스트 샘플이다.
export const commuteAreaFixtures = [
  {
    adminDongCode: '11230640',
    commuteMinutes: 3,
    stations: [
      {
        stopId: 'RS_ACC1_S-2-0222',
        stopName: '역삼역',
        latitude: 37.5006,
        longitude: 127.0364,
        travelMinutes: 3,
        direction: null,
      },
      {
        stopId: 'BS_TAGO_SEB121000123',
        stopName: '역삼역.포스코센터',
        latitude: 37.5021,
        longitude: 127.0399,
        travelMinutes: 5,
        direction: null,
      },
    ],
  },
  {
    adminDongCode: '11210690',
    commuteMinutes: 27,
    stations: [
      {
        stopId: 'RS_ACC1_S-2-0230',
        stopName: '신림역',
        latitude: 37.4842,
        longitude: 126.9297,
        travelMinutes: 27,
        direction: null,
      },
    ],
  },
  {
    adminDongCode: '31023780',
    commuteMinutes: 38,
    stations: [
      {
        stopId: 'MOCK_JEONGJA',
        stopName: '정자역',
        latitude: 37.3672,
        longitude: 127.1086,
        travelMinutes: 38,
        direction: null,
      },
    ],
  },
];

// 최신 응답에는 환승 횟수가 없다. 필터 동작 검증용 MSW 내부 설정으로만 관리한다.
export const mockRequiredTransfers: Record<string, number> = {
  'RS_ACC1_S-2-0222': 0,
  BS_TAGO_SEB121000123: 0,
  'RS_ACC1_S-2-0230': 0,
  MOCK_JEONGJA: 1,
};

// 시세는 시안용 가상 값이다. 정자동은 거래가 5건보다 적어 서버가 금액을 비우는 경우를 보여준다.
export const mockAreaRents: Record<
  string,
  { monthlyRentKrw: number; depositKrw: number; transactionCount: number; legalDongNames: string[] }
> = {
  '11230640': { monthlyRentKrw: 680000, depositKrw: 10000000, transactionCount: 42, legalDongNames: ['역삼동'] },
  '11210690': {
    monthlyRentKrw: 450000,
    depositKrw: 5000000,
    transactionCount: 18,
    legalDongNames: ['신림동', '봉천동'],
  },
};
export const mockRentPeriod = { startDate: '2026-03-31', endDate: '2026-09-30' };
