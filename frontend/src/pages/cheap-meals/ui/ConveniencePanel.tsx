import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { describeMealError, usePromotions } from '@/features/meal-deals/api/mealDealsApi';
import { formatKst, httpsUrl, won } from '@/features/meal-deals/lib/presentation';
import { type Brand, BRANDS, PROMOTIONS } from '@/features/meal-deals/model/MealDeal';
import { LogClick } from '@/shared/lib/analytics/logging';
import { Button } from '@/shared/ui/button/Button';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';
import QueryState from '@/shared/ui/query-state/QueryState';
import SearchField from '@/shared/ui/search-field/SearchField';
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/segmented-control/SegmentedControl';

import type { MealLayout } from '../hooks/useMealTabs';
import { CHEAP_MEAL_EVENTS, outboundClickedParams } from '../lib/cheapMealAnalytics';
import { type ProductSort, type PromotionFilter, selectProducts } from '../lib/convenienceProducts';
import type { MealDetail } from '../model/MealNavigation';
import EmptyState from './MealEmptyState';
import ProductImage from './ProductImage';

import * as shared from './MealContent.styles';

const PAGE_SIZE = 24;
const filters: { value: PromotionFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'ONE_PLUS_ONE', label: '1+1' },
  { value: 'TWO_PLUS_ONE', label: '2+1' },
  { value: 'SALE', label: '할인' },
  { value: 'OTHER', label: '기타 행사' },
];
const sorts: { value: ProductSort; label: string }[] = [
  { value: 'DEFAULT', label: '기본순' },
  { value: 'PRICE_ASC', label: '가격 낮은 순' },
  { value: 'PRICE_DESC', label: '가격 높은 순' },
];
type ConveniencePanelProps = { isActive: boolean; layout: MealLayout; onDetail: (detail: MealDetail) => void };

const ConveniencePanel = ({ isActive, layout, onDetail }: ConveniencePanelProps) => {
  const [brand, setBrand] = useState<Brand>('EMART24');
  const [filter, setFilter] = useState<PromotionFilter>('ALL');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<ProductSort>('DEFAULT');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const query = usePromotions(brand, isActive);
  const isSearching = keyword.trim().length > 0;
  const brandControl = (
    <SegmentedControl
      value={brand}
      onValueChange={(value) => {
        setBrand(value as Brand);
        setLimit(PAGE_SIZE);
      }}
      aria-label="편의점 브랜드"
    >
      {Object.entries(BRANDS).map(([value, label]) => (
        <SegmentedControlItem key={value} value={value}>
          {label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
  const filterControl = (
    <SegmentedControl
      className={styles.filters}
      value={filter}
      onValueChange={(value) => {
        setFilter(value as PromotionFilter);
        setLimit(PAGE_SIZE);
      }}
      aria-label="행사 유형"
    >
      {filters.map(({ value, label }) => (
        <SegmentedControlItem key={value} value={value}>
          {label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
  /* 검색 버튼 없이 입력할 때마다 결과를 바꾸고, 정렬 메뉴는 검색창 오른쪽에 둔다. */
  const searchRow = (
    <div className={styles.searchRow}>
      <SearchField
        className={styles.search}
        label="상품명 검색"
        value={keyword}
        placeholder="찾는 상품명을 검색하세요 (예: 콜라, 라면)"
        maxLength={50}
        showSubmitButton={false}
        onValueChange={(value) => {
          setKeyword(value);
          setLimit(PAGE_SIZE);
        }}
        onSubmit={() => {}}
      />
      <select
        className={styles.sort}
        value={sort}
        onChange={(event) => {
          setSort(event.target.value as ProductSort);
          setLimit(PAGE_SIZE);
        }}
        aria-label="가격 정렬"
      >
        {sorts.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <section className={cx(shared.section, layout === 'desktop' && shared.sectionDesktop)} aria-label="편의점 행사상품">
      {/* 데스크탑 리스트 칸은 좁아서 브랜드, 검색, 행사 유형을 세로로 쌓는다. */}
      {brandControl}
      {searchRow}
      {filterControl}
      <QueryState query={query} loadingTitle="행사상품을 불러오고 있어요" describeError={describeMealError}>
        {(result) => {
          const products = selectProducts(result.products, { filter, keyword, sort });
          const source = httpsUrl(result.sourceUrl);
          // 미수집·빈 목록은 API 상태라 검색 결과 0건보다 먼저 구분한다.
          const isSourceEmpty = result.count === 0;
          return (
            <>
              <p className={shared.description} aria-live="polite">
                {BRANDS[brand]} · {isSearching ? '검색 결과 ' : ''}
                {products.length.toLocaleString('ko-KR')}개 상품
              </p>
              {products.length === 0 ? (
                <EmptyState
                  variant="plain"
                  title={
                    result.collectedAt === null && isSourceEmpty
                      ? '아직 행사정보를 수집하지 않았어요'
                      : isSourceEmpty
                        ? '현재 등록된 행사상품이 없어요'
                        : isSearching
                          ? '검색어와 일치하는 상품이 없어요'
                          : '이 행사 유형의 상품이 없어요'
                  }
                  description={
                    result.collectedAt === null
                      ? '공식 행사 페이지에서 최신 정보를 확인해 주세요.'
                      : !isSourceEmpty && isSearching
                        ? '다른 상품명으로 검색하거나 행사 유형을 바꿔 보세요.'
                        : '다른 행사 유형이나 브랜드를 살펴보세요.'
                  }
                />
              ) : (
                <ul className={cx(styles.grid, layout === 'desktop' && styles.gridDesktop)} aria-label="행사상품 목록">
                  {products.slice(0, limit).map((product, index) => (
                    <li key={`${index}-${product.name}-${product.promotionType}`}>
                      <button
                        type="button"
                        className={styles.card}
                        onClick={() => onDetail({ kind: 'product', product, brand, sourceUrl: result.sourceUrl })}
                        aria-label={`${product.name} 상세 보기`}
                      >
                        <span className={styles.thumb}>
                          <ProductImage src={product.imageUrl} name={product.name} />
                        </span>
                        <span className={styles.body}>
                          <span className={shared.itemHeading}>
                            <span className={shared.badge}>{PROMOTIONS[product.promotionType]}</span>
                            <strong className={styles.name}>{product.name}</strong>
                          </span>
                          <span className={styles.price}>{won(product.price)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {products.length > limit && (
                <Button fullWidth variant="secondary" onClick={() => setLimit((value) => value + PAGE_SIZE)}>
                  상품 더 보기 ({Math.min(limit, products.length)}/{products.length})
                </Button>
              )}
              <footer className={styles.footer}>
                <InlineNotice>
                  마지막 수집:{' '}
                  {result.collectedAt === null ? '아직 수집되지 않음' : `${formatKst(result.collectedAt)} (한국 시간)`}
                  <br />
                  개별 매장에 따라 행사 적용과 재고가 다를 수 있어요. 표시한 금액은 상품 판매가격이며, 행사 조건은 공식
                  안내를 확인해 주세요.
                </InlineNotice>
                {source && (
                  <LogClick
                    event={CHEAP_MEAL_EVENTS.outboundClicked}
                    params={outboundClickedParams('convenience', 'official_source', brand)}
                  >
                    <a className={shared.sourceLink} href={source} target="_blank" rel="noreferrer">
                      {BRANDS[brand]} 공식 행사정보 ↗
                    </a>
                  </LogClick>
                )}
              </footer>
            </>
          );
        }}
      </QueryState>
    </section>
  );
};
const styles = {
  filters: css`
    label: ConveniencePanel-filters;
    margin: 0.75rem 0 0.25rem;
  `,
  searchRow: css`
    label: ConveniencePanel-searchRow;
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  `,
  search: css`
    label: ConveniencePanel-search;
    flex: 1;
    min-width: 0;
  `,
  sort: css`
    label: ConveniencePanel-sort;
    flex: none;
    min-height: 2.5rem;
    padding: 0 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-ink);
    font: inherit;
    font-size: 0.87rem;
    cursor: pointer;

    &:focus-visible {
      outline: 0;
      border-color: var(--color-ink, #212124);
    }
  `,
  footer: css`
    label: ConveniencePanel-footer;
    display: grid;
    gap: 0.5rem;
    margin-top: 1.25rem;
  `,
  grid: css`
    label: ConveniencePanel-grid;
    list-style: none;
    padding: 0;
    margin: 0 0 1.5rem;
    display: grid;
    /* 폭에 따라 열 수를 늘린다. 휴대폰은 두 칸, 태블릿은 서너 칸이 되고 칸 크기는 비슷하게 둔다. */
    grid-template-columns: repeat(auto-fill, minmax(min(9.5rem, calc(50% - 0.4rem)), 1fr));
    gap: 1.4rem 0.8rem;
  `,
  gridDesktop: css`
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  `,
  thumb: css`
    label: ConveniencePanel-thumb;
    flex: none;
    width: 3.5rem;
  `,
  body: css`
    label: ConveniencePanel-body;
    display: grid;
    min-width: 0;
    flex: 1;
    gap: 0.15rem;
    justify-items: start;
  `,
  card: css`
    label: ConveniencePanel-card;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-ink);
    text-align: left;
    cursor: pointer;
    font: inherit;
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
  `,
  name: css`
    label: ConveniencePanel-name;
    font-size: 0.87rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  `,
  price: css`
    label: ConveniencePanel-price;
    font-weight: 700;
    font-size: 0.95rem;
    margin-top: auto;
  `,
};
export default ConveniencePanel;
