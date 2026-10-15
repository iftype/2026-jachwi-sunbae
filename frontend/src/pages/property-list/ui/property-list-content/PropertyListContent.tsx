import { getPropertyErrorMessage } from '@/features/property/api/propertyErrorMessages';
import type { usePropertyList } from '@/features/property/api/useProperties';
import type { PropertySummary } from '@/features/property/model/Property';
import PropertyCard from '@/features/property/ui/property-card/PropertyCard';
import mascotImage from '@/shared/assets/empty-property.jpg';
import { Button, ButtonLink } from '@/shared/ui/button/Button';
import EmptyState from '@/shared/ui/empty-state/EmptyState';
import Icon from '@/shared/ui/icon/Icon';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';
import PageAction from '@/shared/ui/page-action/PageAction';

import PropertyListSkeleton from '../property-list-skeleton/PropertyListSkeleton';

import styles from './PropertyListContent.module.css';

type PropertyListQuery = ReturnType<typeof usePropertyList>;

type PropertyListContentProps = {
  properties: PropertyListQuery;
  items: PropertySummary[];
  filteredItems: PropertySummary[];
  query: string;
};

const PropertyListContent = ({ properties, items, filteredItems, query }: PropertyListContentProps) => {
  const hasInitialError = properties.isError && !properties.isFetchNextPageError;
  const totalElements = properties.data?.pages[0]?.totalElements ?? 0;

  if (properties.isPending) {
    return <PropertyListSkeleton />;
  }

  if (hasInitialError) {
    return (
      <div className={styles.errorState}>
        <div className={styles.errorMascot} aria-hidden="true">
          <img src={mascotImage} alt="" />
        </div>
        <InlineNotice tone="error">
          <strong>매물 목록을 불러오지 못했어요.</strong>
          <span>{getPropertyErrorMessage(properties.error)}</span>
        </InlineNotice>
        <Button variant="secondary" fullWidth onClick={() => void properties.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className={styles.listToolbar}>
        <span className={styles.totalCount}>
          전체 <strong>{totalElements}</strong>
        </span>
      </div>

      {items.length === 0 && (
        <>
          <EmptyState
            title={query.length > 0 ? '검색 결과가 없어요.' : '아직 등록한 매물이 없어요.'}
            description={
              query.length > 0
                ? '다른 이름으로 검색해 보세요.'
                : '기본 정보부터 현장 체크까지 한 흐름으로 관리할 수 있어요.'
            }
            action={
              query.length === 0 ? (
                <ButtonLink to="/properties/new">
                  <Icon name="plus" size={15} />첫 매물 등록하기
                </ButtonLink>
              ) : undefined
            }
          />
          {query.length === 0 && <PropertyListGuide />}
        </>
      )}

      {filteredItems.length > 0 && (
        <section className={styles.cardList} aria-label="매물 목록">
          {filteredItems.map((property) => (
            <PropertyCard key={property.propertyId} property={property} />
          ))}
        </section>
      )}

      {items.length > 0 && filteredItems.length === 0 && (
        <EmptyState
          variant="plain"
          title={query.length > 0 ? '검색 결과가 없어요.' : '해당 상태의 매물이 없어요.'}
          description={query.length > 0 ? '다른 이름으로 검색해 보세요.' : '다른 상태를 선택해 보세요.'}
        />
      )}

      {properties.hasNextPage && (
        <div className={styles.loadMore}>
          {properties.isFetchNextPageError && (
            <InlineNotice tone="error">다음 매물을 불러오지 못했어요. 기존 목록은 그대로 유지됩니다.</InlineNotice>
          )}
          <Button
            variant="secondary"
            fullWidth
            isLoading={properties.isFetchingNextPage}
            loadingLabel="추가 매물 불러오는 중…"
            onClick={() => void properties.fetchNextPage()}
          >
            {properties.isFetchNextPageError ? '다시 불러오기' : '매물 더 보기'}
          </Button>
        </div>
      )}

      {items.length > 0 && (
        <PageAction to="/properties/new" aria-label="매물 추가">
          매물 추가
        </PageAction>
      )}
    </>
  );
};

const PropertyListGuide = () => (
  <section className={styles.guide} aria-labelledby="property-guide-heading">
    <div className={styles.sectionHeading}>
      <h2 id="property-guide-heading">이렇게 진행해요</h2>
      <span>4 STEPS</span>
    </div>
    <ol className={styles.steps}>
      {['매물 등록', '정보 입력', '체크 선택', '현장 체크'].map((label, index) => (
        <li key={label}>
          <strong>{String(index + 1).padStart(2, '0')}</strong>
          <span>{label}</span>
        </li>
      ))}
    </ol>
    <InlineNotice>입력 내용은 언제든 수정할 수 있으며 단계별로 이어서 진행할 수 있어요.</InlineNotice>
  </section>
);

export default PropertyListContent;
