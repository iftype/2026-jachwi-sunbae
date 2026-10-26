import { useNavigate, useOutletContext, useParams } from 'react-router-dom';

import ExplorationRecordAction from '@/features/onboarding/ui/exploration-record-action/ExplorationRecordAction';
import { Button } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';

import useNeighborhoodDetailAnalytics from './hooks/useNeighborhoodDetailAnalytics';
import type { NeighborhoodPreviewContext } from './hooks/useNeighborhoodPreview';
import ListingLink from './ui/listing-link/ListingLink';
import NearbyLink from './ui/nearby-link/NearbyLink';

import styles from './NeighborhoodPricePage.module.css';

const money = (value: number) => `${Math.round(value / 10000).toLocaleString('ko-KR')}만원`;
const NeighborhoodPricePage = () => {
  const preview = useOutletContext<NeighborhoodPreviewContext>();
  const { legalDongCode } = useParams();
  const navigate = useNavigate();
  const area = preview.selectedPrice?.legalDongCode === legalDongCode ? preview.selectedPrice : undefined;
  useNeighborhoodDetailAnalytics({
    feature: 'rental',
    mock: preview.isMockData,
    ready: !!area,
    itemKey: area?.legalDongCode ?? null,
    transactionCount: area?.items.length,
  });
  const close = () => navigate(`${preview.mapPath}?mode=price`, { replace: true });
  return (
    <main className={styles.page} aria-label="동네 월세 상세">
      <header className={styles.header}>
        <Button variant="text" aria-label="월세 상세 닫기" onClick={close}>
          <Icon name="close" size={24} />
        </Button>
        <h1>{area?.name ?? '월세 평균가'}</h1>
      </header>
      {area ? (
        <>
          <p className={styles.address}>{area.fullName}</p>
          <section className={styles.average} aria-label="평균 월세">
            <span>월세 평균가</span>
            <strong>{area.average === null ? '거래 정보 없음' : money(area.average)}</strong>
            <small>{area.items.length}건 · 관리비 제외</small>
          </section>
          <p className={styles.notice}>
            최근 6개월 · 5~10평 소형 주택의 단순 평균이에요.
            <br />
            보증금 차이를 조정한 가격은 아닙니다.
          </p>
          <div className={styles.actions}>
            <ListingLink areaName={area.name} center={area.center} onOpen={preview.openListing} />
            <NearbyLink areaName={area.name} to={preview.nearbyPathFor(area)} onOpen={preview.openNearby} />
            {preview.isPublicExplore && (
              <ExplorationRecordAction
                location={{ ...area.center, address: area.fullName, roadAddress: null, jibunAddress: area.fullName }}
              />
            )}
          </div>
          <h2>주변 월세 거래 기록</h2>
          <p className={styles.period}>{area.period}</p>
          {!area.items.length && <p>조회된 거래가 없어요.</p>}
          <ul className={styles.transactions}>
            {area.items.map((item) => (
              <li key={item.rentalTransactionId}>
                <div>
                  <strong>월세 {money(item.monthlyRentAmountKrw)}</strong>
                  <span>{item.contractDate}</span>
                </div>
                <p>
                  보증금 {money(item.depositAmountKrw)} · {item.areaM2}㎡
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p>지도에서 동네를 먼저 선택해주세요.</p>
          <Button variant="secondary" onClick={close}>
            지도로 돌아가기
          </Button>
        </>
      )}
    </main>
  );
};
export default NeighborhoodPricePage;
