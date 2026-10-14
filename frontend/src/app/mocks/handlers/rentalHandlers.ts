import { delay, http, HttpResponse } from 'msw';

/** 금액은 시안용 가상 거래다. 서버와 동일한 페이지 응답을 반환한다. */
export const rentalHandlers = [
  http.get('*/api/rental-transactions', async ({ request }) => {
    const params = new URL(request.url).searchParams;
    const legalDongCode = params.get('legalDongCode') ?? '';
    const page = Number(params.get('page') ?? 0);
    const size = Number(params.get('size') ?? 20);
    if (
      !/^\d{10}$/.test(legalDongCode) ||
      !Number.isInteger(page) ||
      page < 0 ||
      page > 10000 ||
      !Number.isInteger(size) ||
      size < 1 ||
      size > 100
    )
      return HttpResponse.json(
        { code: 'INVALID_REQUEST', message: '요청 값을 확인해주세요.', errors: [] },
        { status: 400 },
      );
    await delay(350);
    const seed = Number(legalDongCode.slice(-6));
    const totalCount = seed % 7 === 0 ? 0 : 105;
    const items = Array.from({ length: Math.max(0, Math.min(size, totalCount - page * size)) }, (_, index) => ({
      rentalTransactionId: page * size + index + 1,
      housingType: 'OFFICETEL',
      depositAmountKrw: 10000000 + index * 100000,
      monthlyRentAmountKrw: 350000 + (seed % 30) * 10000 + index * 1000,
      areaM2: 24,
      areaBasis: 'EXCLUSIVE',
      contractDate: '2026-09-01',
      contractType: 'NEW',
    }));
    return HttpResponse.json({
      code: 'SUCCESS',
      message: '요청이 성공했습니다.',
      data: {
        legalDongCode,
        legalDongName: null,
        referenceLabel: '소형 주택 월세 참고 정보',
        queryStartDate: '2026-04-13',
        queryEndDate: '2026-10-13',
        datasetPeriodStart: '2026-04-01',
        datasetPeriodEnd: '2026-10-01',
        collectedAt: '2026-10-13T00:00:00Z',
        items,
        page,
        size,
        totalCount,
        hasNext: (page + 1) * size < totalCount,
      },
    });
  }),
];
