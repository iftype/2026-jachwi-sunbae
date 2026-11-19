import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PropertyBasicInfoSection from '@/pages/property-detail/ui/property-basic-info-section/PropertyBasicInfoSection';
import { forgetJustCreated, markJustCreated } from '@/features/property/lib/justCreatedProperties';
import type { PropertyDetail } from '@/features/property/model/Property';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

/** 이름 `새 매물`, 금액 없음. 예전에는 이 값만 보고 처음 등록으로 추정해 이름 입력 칸을 바로 열었다. */
const emptyProperty: PropertyDetail = {
  propertyId: 77,
  name: '새 매물',
  depositAmount: 0,
  monthlyRentAmount: 0,
  discoverySource: { type: 'TEXT', value: '' },
  location: { address: '서울 관악구 신림로 123', latitude: 37.4842, longitude: 126.9297 },
  availableMoveInDate: null,
  maintenanceFeeAmount: null,
  visitScheduledAt: null,
  roomOptions: [],
  utilityOptions: [],
  photoPreview: { totalCount: 0, photos: [] },
  createdAt: '2026-10-20T14:30:00',
  updatedAt: '2026-10-27T10:00:00',
};

const show = () =>
  render(
    <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>
      <QueryClientProvider client={new QueryClient()}>
        <PropertyBasicInfoSection
          property={emptyProperty}
          editingField={null}
          onEdit={() => undefined}
          onSaved={() => undefined}
          onCancel={() => undefined}
          onEditLocation={() => undefined}
          savedField={null}
        />
      </QueryClientProvider>
    </PublicConfigProvider>,
  );

afterEach(() => forgetJustCreated(emptyProperty.propertyId));

describe('매물 상세 기본 정보의 보기 모드와 수정 모드', () => {
  it('방금 등록한 매물은 이름 입력이 바로 열리고 포커스된다', () => {
    markJustCreated(emptyProperty.propertyId);
    show();
    expect(screen.getByRole('textbox', { name: '매물 이름' })).toHaveFocus();
  });

  it('같은 매물을 목록에서 다시 열면 보기 모드다', () => {
    markJustCreated(emptyProperty.propertyId);
    show().unmount();
    // 상세를 닫으면 방금 만든 매물이 아니다.
    show();
    expect(screen.queryByRole('textbox', { name: '매물 이름' })).not.toBeInTheDocument();
  });

  it('이름과 금액이 비어 있어도(새 매물, 가격 없음) 신호가 없으면 보기 모드다', () => {
    show();
    expect(screen.queryByRole('textbox', { name: '매물 이름' })).not.toBeInTheDocument();
    expect(screen.getByText('새 매물')).toBeInTheDocument();
  });

  it('새로고침하면 메모리 신호가 사라져 보기 모드다', () => {
    markJustCreated(emptyProperty.propertyId);
    // 새로고침은 메모리를 비운다.
    forgetJustCreated(emptyProperty.propertyId);
    show();
    expect(screen.queryByRole('textbox', { name: '매물 이름' })).not.toBeInTheDocument();
  });
});
