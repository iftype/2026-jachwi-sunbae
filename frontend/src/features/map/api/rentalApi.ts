import { apiRequest } from '@/features/auth/api/apiClient';
import { readArray, readInteger, readRecord, readString } from '@/shared/api/responseParsers';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

export type RentalItem = {
  rentalTransactionId: number;
  monthlyRentAmountKrw: number;
  depositAmountKrw: number;
  contractDate: string;
  areaM2: number;
};
export const fetchRentalAverage = async (config: PublicConfig, legalDongCode: string, signal?: AbortSignal) => {
  const items: RentalItem[] = [];
  let snapshot: string | null | undefined;
  let total: number | undefined;
  for (let page = 0; page <= 10000; page++) {
    const result = await apiRequest({
      config,
      signal,
      path: `/api/rental-transactions?${new URLSearchParams({ legalDongCode, page: String(page), size: '100' })}`,
      parseData: (value) => {
        const data = readRecord(value);
        if (
          readString(data, 'legalDongCode') !== legalDongCode ||
          readInteger(data, 'page') !== page ||
          typeof data.hasNext !== 'boolean'
        )
          throw new Error('거래 페이지가 올바르지 않습니다.');
        const entries = readArray(data, 'items').map((value) => {
          const item = readRecord(value);
          const rent = readInteger(item, 'monthlyRentAmountKrw');
          const deposit = readInteger(item, 'depositAmountKrw');
          if (rent < 0 || deposit < 0 || typeof item.areaM2 !== 'number' || !Number.isFinite(item.areaM2))
            throw new Error('거래 금액이 올바르지 않습니다.');
          return {
            rentalTransactionId: readInteger(item, 'rentalTransactionId'),
            monthlyRentAmountKrw: rent,
            depositAmountKrw: deposit,
            contractDate: readString(item, 'contractDate'),
            areaM2: item.areaM2,
          };
        });
        if (data.collectedAt !== null && typeof data.collectedAt !== 'string')
          throw new Error('수집일이 올바르지 않습니다.');
        return {
          items: entries,
          hasNext: data.hasNext,
          totalCount: readInteger(data, 'totalCount'),
          collectedAt: data.collectedAt,
          period: `${readString(data, 'queryStartDate')} ~ ${readString(data, 'queryEndDate')}`,
        };
      },
    });
    if (page > 0 && (snapshot !== result.collectedAt || total !== result.totalCount))
      throw new Error('거래 자료가 갱신되었습니다. 다시 조회해주세요.');
    snapshot = result.collectedAt;
    total = result.totalCount;
    items.push(...result.items);
    if (new Set(items.map((item) => item.rentalTransactionId)).size !== items.length || items.length > total)
      throw new Error('거래 자료가 중복되었습니다.');
    if (!result.hasNext) {
      if (items.length !== total) throw new Error('전체 거래를 불러오지 못했습니다.');
      return {
        items,
        period: result.period,
        average: items.length ? items.reduce((sum, item) => sum + item.monthlyRentAmountKrw, 0) / items.length : null,
      };
    }
    if (!result.items.length) throw new Error('거래 페이지가 비어 있습니다.');
  }
  throw new Error('거래 페이지 범위를 초과했습니다.');
};
