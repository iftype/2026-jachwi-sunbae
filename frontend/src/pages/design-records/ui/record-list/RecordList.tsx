import { useState } from 'react';

import PropertyCard from '@/features/property/ui/property-card/PropertyCard';
import { RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import Icon from '@/shared/ui/icon/Icon';

import type { RecordsState } from '../../hooks/useRecords';
import RecordDeleteButton from './RecordDeleteButton';

import styles from './RecordList.module.css';

type RecordListProps = {
  records: RecordsState['records'];
  district: string;
  /** 주면 기록을 눌러도 상세로 넘어가지 않고 이 함수를 부른다(데스크탑은 리스트 자리에 상세를 연다). */
  onOpen?: (recordId: string) => void;
  onNotice: (message: string) => void;
  className?: string;
};

/** 기록 리스트. 인프라 지도 매물 목록과 같은 공용 PropertyCard에 더보기(삭제) 메뉴를 붙인다. */
const RecordList = ({ records, district, onOpen, onNotice, className }: RecordListProps) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <section className={className} aria-labelledby="record-list-heading">
      <h2 id="record-list-heading" className="sr-only">
        {district === '전체' ? '모든 기록' : `${district} 기록`}
      </h2>
      {/* 리스트 필터는 아직 기능 구현 전이라 모양만 두고 누를 수 없게 막는다. */}
      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="기록 필터 (준비 중)">
          <button type="button" disabled>
            최근순 <Icon name="chevron-down" size={14} />
          </button>
          <button type="button" disabled>
            월세 <Icon name="chevron-down" size={14} />
          </button>
          <button type="button" disabled>
            체크 진행 <Icon name="chevron-down" size={14} />
          </button>
        </div>
        <span className={styles.comingSoon}>필터 준비 중</span>
      </div>
      <ul className={styles.items}>
        {records.map((record) => (
          <li key={record.id}>
            <PropertyCard
              property={record.summary}
              returnTo={RECORDS_PATH}
              onOpen={onOpen === undefined ? undefined : () => onOpen(record.id)}
              actions={
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.menuToggle}
                    aria-label={`${record.name} 메뉴`}
                    aria-expanded={openMenuId === record.id}
                    onClick={() => setOpenMenuId((current) => (current === record.id ? null : record.id))}
                  >
                    <Icon name="more-vertical" size={20} />
                  </button>
                  {openMenuId === record.id && (
                    <div className={styles.menu}>
                      <RecordDeleteButton
                        propertyId={Number(record.id)}
                        onDone={(message) => {
                          setOpenMenuId(null);
                          onNotice(message);
                        }}
                      />
                    </div>
                  )}
                </div>
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
};

export default RecordList;
