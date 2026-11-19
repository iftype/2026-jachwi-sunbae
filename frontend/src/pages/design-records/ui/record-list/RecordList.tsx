import { useEffect, useRef } from 'react';

import { isPreviewProperty } from '@/features/property/model/sampleProperties';
import PropertyCard from '@/features/property/ui/property-card/PropertyCard';
import { RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import EmptyState from '@/shared/ui/empty-state/EmptyState';

import type { RecordsState } from '../../hooks/useRecords';
import RecordCompareLink from '../record-compare-link/RecordCompareLink';
import RecordCardMenu from './RecordCardMenu';

import * as styles from './RecordList.styles';

type RecordListProps = {
  records: RecordsState['records'];
  district: string;
  /** 주면 기록을 눌러도 상세로 넘어가지 않고 이 함수를 부른다(데스크탑은 리스트 자리에 상세를 연다). */
  onOpen?: (recordId: string) => void;
  /** 지도에서 고른 매물. 그 카드를 눈에 띄게 하고 보이는 자리로 스크롤한다. */
  selectedId?: string;
  onNotice: (message: string) => void;
  className?: string;
  showCompare?: boolean;
};

const RecordList = ({
  records,
  district,
  onOpen,
  selectedId,
  onNotice,
  className,
  showCompare = false,
}: RecordListProps) => {
  const selectedRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // scrollIntoView가 없는 환경(jsdom 등)에서도 터지지 않게 있을 때만 부른다.
    selectedRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);
  // 예시 매물만 보일 때는 개수를 세지 않는다.
  const realCount = records.filter((record) => !isPreviewProperty(record.id)).length;
  return (
    <section className={className} aria-labelledby="record-list-heading">
      <h2 id="record-list-heading" className="sr-only">
        {district === '전체' ? '모든 기록' : `${district} 기록`}
      </h2>
      {records.length === 0 && (
        <EmptyState
          variant="plain"
          illustration="empty-properties"
          title={district === '전체' ? '아직 기록한 방이 없어요' : `${district}에 기록한 방이 없어요`}
          description="집을 보러 가면 사진과 체크한 내용을 남겨 두세요. 여기에 모여요."
        />
      )}
      {showCompare && records.length > 0 && <RecordCompareLink count={realCount > 0 ? realCount : undefined} />}
      <ul className={styles.items}>
        {records.map((record) => (
          <li
            key={record.id}
            ref={record.id === selectedId ? selectedRef : undefined}
            className={styles.item}
            data-selected={record.id === selectedId || undefined}
          >
            <PropertyCard
              property={record.summary}
              returnTo={RECORDS_PATH}
              onOpen={onOpen === undefined ? undefined : () => onOpen(record.id)}
              actions={<RecordCardMenu propertyId={Number(record.id)} propertyName={record.name} onDone={onNotice} />}
            />
          </li>
        ))}
      </ul>
    </section>
  );
};

export default RecordList;
