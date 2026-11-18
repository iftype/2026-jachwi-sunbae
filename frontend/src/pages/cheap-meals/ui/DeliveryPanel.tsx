import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { describeMealError, useDeliveryOffers } from '@/features/meal-deals/api/mealDealsApi';
import { won } from '@/features/meal-deals/lib/presentation';
import { type Platform, PLATFORMS } from '@/features/meal-deals/model/MealDeal';
import { Button } from '@/shared/ui/button/Button';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';
import QueryState from '@/shared/ui/query-state/QueryState';
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/segmented-control/SegmentedControl';

import type { MealLayout } from '../hooks/useMealTabs';
import type { MealDetail } from '../model/MealNavigation';
import MealEmptyState from './MealEmptyState';

import * as shared from './MealContent.styles';

type DeliveryPanelProps = { isActive: boolean; layout: MealLayout; onDetail: (detail: MealDetail) => void };

const DeliveryPanel = ({ isActive, layout, onDetail }: DeliveryPanelProps) => {
  const [platform, setPlatform] = useState<Platform | 'ALL'>('ALL');
  const [limit, setLimit] = useState(24);
  const query = useDeliveryOffers(isActive);
  return (
    <section className={cx(shared.section, layout === 'desktop' && shared.sectionDesktop)} aria-label="배달 할인정보">
      <h2>배달 할인 모아보기</h2>
      <p className={shared.description}>할인금액뿐 아니라 적용 조건도 확인해 보세요.</p>
      <SegmentedControl
        value={platform}
        onValueChange={(value) => {
          setPlatform(value as Platform | 'ALL');
          setLimit(24);
        }}
        aria-label="배달 플랫폼"
      >
        <SegmentedControlItem value="ALL">전체</SegmentedControlItem>
        {Object.entries(PLATFORMS).map(([value, label]) => (
          <SegmentedControlItem key={value} value={value}>
            {label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <QueryState query={query} loadingTitle="배달 혜택을 불러오고 있어요" describeError={describeMealError}>
        {(data) => {
          const offers = data.filter((offer) => platform === 'ALL' || offer.platform === platform);
          return (
            <>
              <p className={styles.count} aria-live="polite">
                {offers.length}개 혜택
              </p>
              {offers.length === 0 ? (
                <MealEmptyState
                  title="현재 유효한 할인정보가 없어요"
                  description="다른 플랫폼을 고르거나 나중에 다시 확인해 주세요."
                />
              ) : (
                <ul className={cx(styles.list, layout === 'desktop' && styles.listDesktop)} aria-label="배달 혜택 목록">
                  {offers.slice(0, limit).map((offer) => (
                    <li key={offer.id}>
                      <button
                        className={styles.card}
                        type="button"
                        onClick={() => onDetail({ kind: 'delivery', offer })}
                        aria-label={`${PLATFORMS[offer.platform]} ${offer.brandName} 할인 상세 보기`}
                      >
                        <span className={shared.badge}>{PLATFORMS[offer.platform]}</span>
                        <span className={styles.brand}>{offer.brandName}</span>
                        <strong className={styles.amount}>{won(offer.discountAmount)} 할인</strong>
                        <span className={styles.condition}>
                          <span>최소 주문금액</span>
                          <strong>{offer.minOrderAmount === null ? '정보 없음' : won(offer.minOrderAmount)}</strong>
                        </span>
                        <span className={styles.condition}>
                          <span>적용 조건</span>
                          <span>{offer.conditions?.trim() || '정보 없음'}</span>
                        </span>
                        <span className={styles.more}>상세 보기 →</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {offers.length > limit && (
                <Button fullWidth variant="secondary" onClick={() => setLimit((value) => value + 24)}>
                  혜택 더 보기 ({limit}/{offers.length})
                </Button>
              )}
              <div className={styles.notice}>
                <InlineNotice>
                  배달비·중복 할인·매장별 조건은 별도예요. 주문 앱에서 실제 적용 여부와 최종 결제금액을 확인해 주세요.
                </InlineNotice>
              </div>
            </>
          );
        }}
      </QueryState>
    </section>
  );
};
const styles = {
  count: css`
    label: DeliveryPanel-count;
    margin: 1rem 0;
    color: var(--color-ink-soft);
    font-size: 0.8rem;
  `,
  list: css`
    label: DeliveryPanel-list;
    display: grid;
    gap: 1rem;
    list-style: none;
    padding: 0;
    margin: 0 0 1.5rem;
  `,
  listDesktop: css`
    label: DeliveryPanel-listDesktop;
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    margin-bottom: 1rem;

    & li {
      border-bottom: 1px solid var(--color-border);
    }
    & button {
      gap: 0.2rem;
      padding: 0.75rem 0;
      border: 0;
      border-radius: 0;
    }
  `,
  card: css`
    label: DeliveryPanel-card;
    display: flex;
    height: 100%;
    flex-direction: column;
    gap: 0.6rem;
    width: 100%;
    padding: 1.25rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    text-align: left;
    background: var(--color-surface);
    color: var(--color-ink);
    cursor: pointer;
    font: inherit;
    overflow-wrap: anywhere;
  `,
  brand: css`
    label: DeliveryPanel-brand;
    font-size: 0.94rem;
    font-weight: 600;
    margin-top: 0.2rem;
  `,
  amount: css`
    label: DeliveryPanel-amount;
    font-size: 1.05rem;
    letter-spacing: -0.03em;
    margin-bottom: 0.2rem;
  `,
  condition: css`
    label: DeliveryPanel-condition;
    display: grid;
    grid-template-columns: 6rem minmax(0, 1fr);
    gap: 0.4rem;
    width: 100%;
    font-size: 0.8rem;
    line-height: 1.6;
    white-space: pre-wrap;
    & > :first-child {
      color: var(--color-ink-soft);
    }
  `,
  notice: css`
    label: DeliveryPanel-notice;
    margin-top: 1.25rem;
  `,
  more: css`
    label: DeliveryPanel-more;
    align-self: flex-end;
    margin-top: 0.7rem;
    font-size: 0.8rem;
    color: var(--color-ink-soft);
  `,
};
export default DeliveryPanel;
