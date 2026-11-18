import PropertyCard from '@/features/property/ui/property-card/PropertyCard';
import { RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import EmptyState from '@/shared/ui/empty-state/EmptyState';

import type { RecordsState } from '../../hooks/useRecords';
import RecordCardMenu from './RecordCardMenu';

import * as styles from './RecordList.styles';

type RecordListProps = {
  records: RecordsState['records'];
  district: string;
  /** 주면 기록을 눌러도 상세로 넘어가지 않고 이 함수를 부른다(데스크탑은 리스트 자리에 상세를 연다). */
  onOpen?: (recordId: string) => void;
  onNotice: (message: string) => void;
  className?: string;
};

const RecordList = ({ records, district, onOpen, onNotice, className }: RecordListProps) => {
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
      <ul className={styles.items}>
        {records.map((record) => (
          <li key={record.id}>
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
