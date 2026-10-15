import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import ChecklistProgressBar from '@/features/checklist/ui/checklist-progress-bar/ChecklistProgressBar';
import { DEFAULT_MAP_CENTER } from '@/features/map/lib/mapLocation';
import type { MapMarker } from '@/features/map/model/Map';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import { usePropertyList } from '@/features/property/api/useProperties';
import { useRemoveProperty } from '@/features/property/api/usePropertyMutations';
import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import { enterDesignShell } from '@/shared/lib/navigation/designShell';
import Icon from '@/shared/ui/icon/Icon';

import { recordPresentation } from './model/recordPresentation';

import styles from './DesignRecordsPage.module.css';

type RecordDeleteButtonProps = { propertyId: number; onDone: (message: string) => void };

const RecordDeleteButton = ({ propertyId, onDone }: RecordDeleteButtonProps) => {
  const removeProperty = useRemoveProperty(propertyId);
  return (
    <button
      type="button"
      disabled={removeProperty.isPending}
      onClick={() =>
        removeProperty.mutate(undefined, {
          onSuccess: () => onDone('기록을 삭제했어요.'),
          onError: () => onDone('기록을 삭제하지 못했어요. 다시 시도해주세요.'),
        })
      }
    >
      <Icon name="trash" size={16} /> 삭제
    </button>
  );
};

const DesignRecordsPage = () => {
  const navigate = useNavigate();
  useEffect(enterDesignShell, []);
  const [view, setView] = useState<'map' | 'list'>('map');
  const properties = usePropertyList();
  const allRecords = useMemo(
    () => properties.data?.pages.flatMap((page) => page.content).map(recordPresentation) ?? [],
    [properties.data],
  );
  const districts = ['전체', ...new Set(allRecords.map((record) => record.district))];
  const [district, setDistrict] = useState('전체');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [center, setCenter] = useState(DEFAULT_MAP_CENTER);
  const [level, setLevel] = useState(8);
  const [notice, setNotice] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const records = useMemo(
    () => allRecords.filter((record) => district === '전체' || record.district === district),
    [allRecords, district],
  );
  const selected = records.find((record) => record.id === selectedId);
  useEffect(() => {
    const first = allRecords.find((record) => record.latitude !== null && record.longitude !== null);
    if (first && first.latitude !== null && first.longitude !== null)
      setCenter({ latitude: first.latitude, longitude: first.longitude });
  }, [allRecords]);
  const markers = useMemo<MapMarker[]>(
    () =>
      records.flatMap((record) =>
        record.latitude !== null && record.longitude !== null
          ? [
              {
                id: record.id,
                latitude: record.latitude,
                longitude: record.longitude,
                label: record.name,
                summary: { amount: record.price },
                tone: 'property',
                actionable: true,
              },
            ]
          : [],
      ),
    [records],
  );
  const selectDistrict = (next: string) => {
    setDistrict(next);
    const first = allRecords.find(
      (record) =>
        (next === '전체' || record.district === next) && record.latitude !== null && record.longitude !== null,
    );
    setSelectedId(null);
    if (first && first.latitude !== null && first.longitude !== null)
      setCenter({ latitude: first.latitude, longitude: first.longitude });
    setLevel(next === '전체' ? 8 : 5);
  };
  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <Link className={styles.back} to="/design-preview" aria-label="홈으로 돌아가기">
            <Icon name="chevron-left" size={24} />
          </Link>
          <h1 className="sr-only">본 방 기록</h1>
          <nav className={styles.switch} aria-label="기록 보기 방식">
            <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
              <Icon name="map" size={17} /> 지도
            </button>
            <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
              <Icon name="checklist" size={17} /> 리스트
            </button>
          </nav>
        </header>
        <nav className={styles.districts} aria-label="기록한 동네">
          {districts.map((label) => (
            <button key={label} type="button" aria-pressed={district === label} onClick={() => selectDistrict(label)}>
              {label}
            </button>
          ))}
        </nav>
        {properties.isPending ? (
          <div className={styles.list} role="status">
            기록을 불러오는 중이에요.
          </div>
        ) : properties.isError ? (
          <div className={styles.list} role="alert">
            기록을 불러오지 못했어요.{' '}
            <button type="button" onClick={() => void properties.refetch()}>
              다시 시도
            </button>
          </div>
        ) : view === 'map' ? (
          <section className={styles.map} aria-label="본 방 기록 지도">
            <MapCanvas
              center={center}
              markers={markers}
              level={level}
              selectedMarkerId={selected?.id ?? null}
              onSelectMarker={(marker) => setSelectedId(marker.id)}
              onCenterChange={(latitude, longitude) => setCenter({ latitude, longitude })}
              onLevelChange={setLevel}
            />
            <button
              className={styles.recenter}
              type="button"
              aria-label="선택한 동네로 지도 이동"
              onClick={() => {
                const first = records.find((record) => record.latitude !== null && record.longitude !== null);
                if (first && first.latitude !== null && first.longitude !== null)
                  setCenter({ latitude: first.latitude, longitude: first.longitude });
              }}
            >
              <Icon name="target" size={22} />
            </button>
            {!selected && (
              <span className={styles.mapHint}>
                {records.length ? '내가 기록한 방만 표시돼요' : '아직 기록한 방이 없어요'}
                {records.some((record) => record.latitude === null || record.longitude === null)
                  ? ' · 위치 없는 기록은 리스트에서 확인해요'
                  : ''}
              </span>
            )}
            {selected && (
              <article className={styles.selectedCard}>
                <Link
                  className={styles.selectedMain}
                  to={`/properties/${selected.id}`}
                  state={{ returnTo: '/design-preview/records' }}
                >
                  {selected.representativePhoto ? (
                    <AuthenticatedPhoto
                      propertyId={Number(selected.id)}
                      photoId={selected.representativePhoto.photoId}
                      contentUrl={selected.representativePhoto.contentUrl}
                      alt={`${selected.name} 대표 사진`}
                      className={styles.selectedPhoto}
                    />
                  ) : (
                    <span className={styles.selectedPhotoFallback} aria-hidden="true">
                      <Icon name="home" size={22} />
                    </span>
                  )}
                  <span className={styles.selectedDetails}>
                    <strong>{selected.name}</strong>
                    <span>{selected.price}</span>
                  </span>
                </Link>
                <button
                  className={styles.dismissCard}
                  type="button"
                  aria-label="매물 카드 닫기"
                  onClick={() => setSelectedId(null)}
                >
                  <Icon name="close" size={18} />
                </button>
              </article>
            )}
          </section>
        ) : (
          <section className={styles.list} aria-labelledby="record-list-heading">
            <div className={styles.listHeading}>
              <h2 id="record-list-heading">{district === '전체' ? '모든 기록' : `${district} 기록`}</h2>
              <span>{records.length}곳</span>
            </div>
            <ul>
              {records.map((record) => (
                <li key={record.id}>
                  <article className={styles.room}>
                    {record.representativePhoto ? (
                      <AuthenticatedPhoto
                        propertyId={Number(record.id)}
                        photoId={record.representativePhoto.photoId}
                        contentUrl={record.representativePhoto.contentUrl}
                        alt={`${record.name} 대표 사진`}
                        className={styles.photo}
                        errorMode="retry-only"
                      />
                    ) : (
                      <span className={`${styles.photo} ${styles.photoFallback}`} aria-label="대표 사진 없음">
                        <Icon name="image" size={18} />
                      </span>
                    )}
                    <Link
                      className={styles.roomBody}
                      to={`/properties/${record.id}`}
                      state={{ returnTo: '/design-preview/records' }}
                    >
                      <strong>{record.name}</strong>
                      <span className={styles.price}>{record.price}</span>
                      <small>{record.note}</small>
                      {record.checklist?.applied ? (
                        <ChecklistProgressBar
                          progress={record.checklist.progress}
                          compact
                          trailing={
                            <strong className={styles.statusCount}>
                              {record.checklist.progress.completedCount}/{record.checklist.progress.totalCount}
                            </strong>
                          }
                        />
                      ) : (
                        <span className={styles.statusStart}>체크리스트 시작 전</span>
                      )}
                    </Link>
                    <div className={styles.recordActions}>
                      <button
                        type="button"
                        className={styles.recordMenuToggle}
                        aria-label={`${record.name} 메뉴`}
                        aria-expanded={openMenuId === record.id}
                        onClick={() => setOpenMenuId((current) => (current === record.id ? null : record.id))}
                      >
                        <Icon name="more-vertical" size={20} />
                      </button>
                      {openMenuId === record.id && (
                        <div className={styles.recordMenu}>
                          <RecordDeleteButton
                            propertyId={Number(record.id)}
                            onDone={(message) => {
                              setOpenMenuId(null);
                              setNotice(message);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!(view === 'map' && selected) && (
          <button type="button" className={styles.add} onClick={() => navigate('/properties/new')}>
            <Icon name="plus" size={20} /> 기록하기
          </button>
        )}
        {notice && (
          <div className={styles.notice} role="status">
            {notice}
            <button type="button" aria-label="안내 닫기" onClick={() => setNotice('')}>
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </div>
    </main>
  );
};

export default DesignRecordsPage;
