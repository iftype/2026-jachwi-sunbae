import { Button } from '@/shared/ui/button/Button';

import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import { MINUTE_OPTIONS, RENT_OPTIONS } from '../../NeighborhoodFilters';

import styles from './ConditionPanel.module.css';

type ConditionPanelProps = {
  preview: Pick<
    NeighborhoodPreviewContext,
    | 'hasChosenMapPoint'
    | 'mapCandidate'
    | 'isSearching'
    | 'searchError'
    | 'addressResults'
    | 'selectAddress'
    | 'maxMinutes'
    | 'changeMaxMinutes'
    | 'maxTransfers'
    | 'changeMaxTransfers'
    | 'maxRent'
    | 'changeMaxRent'
    | 'isValidCommuteTime'
  >;
  disabled: boolean;
  onSubmit: () => void;
};

/**
 * 데스크탑 동네 찾기의 왼쪽 칸. 휴대폰은 지도 위 칩과 바텀시트로 조건을 고르지만,
 * 데스크탑은 본 방 기록처럼 왼쪽 칸에 출퇴근 장소·조건·찾기 버튼을 펼쳐 두고 지도는 위치를 찍는 데만 쓴다.
 */
const ConditionPanel = ({ preview, disabled, onSubmit }: ConditionPanelProps) => (
  <aside className={styles.panel} aria-label="탐색 조건">
    <h2>어디로 출퇴근·통학하세요?</h2>
    <section className={styles.place} aria-label="출퇴근 장소">
      {preview.hasChosenMapPoint ? (
        <>
          <small>출퇴근 장소</small>
          <strong>{preview.mapCandidate.name}</strong>
        </>
      ) : (
        <p>위에서 학교·회사를 검색하거나 지도에서 위치를 골라주세요.</p>
      )}
    </section>
    {!preview.hasChosenMapPoint &&
      (preview.isSearching || preview.searchError || preview.addressResults.length > 0) && (
        <div className={styles.addresses}>
          {preview.isSearching && <p role="status">주소를 찾고 있어요.</p>}
          {preview.searchError && <p role="alert">{preview.searchError}</p>}
          {preview.addressResults.map((address) => (
            <button
              type="button"
              key={`${address.latitude}-${address.longitude}`}
              onClick={() => preview.selectAddress(address)}
            >
              {address.roadAddress ?? address.jibunAddress ?? address.address}
            </button>
          ))}
        </div>
      )}
    <fieldset className={styles.field} disabled={disabled}>
      <legend>통근 시간</legend>
      <div className={styles.choices} role="radiogroup" aria-label="최대 통근 시간">
        {MINUTE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            role="radio"
            aria-checked={preview.maxMinutes === option.value}
            variant={preview.maxMinutes === option.value ? 'soft' : 'secondary'}
            onClick={() => preview.changeMaxMinutes(option.value)}
          >
            {option.value}분
          </Button>
        ))}
      </div>
    </fieldset>
    <fieldset className={styles.field} disabled={disabled}>
      <legend>환승 횟수</legend>
      <div className={styles.choices} role="radiogroup" aria-label="최대 환승 횟수">
        {[0, 1, 2].map((count) => (
          <Button
            key={count}
            role="radio"
            aria-checked={preview.maxTransfers === count}
            variant={preview.maxTransfers === count ? 'soft' : 'secondary'}
            onClick={() => preview.changeMaxTransfers(count)}
          >
            {count === 0 ? '환승 없음' : `${count}회 이하`}
          </Button>
        ))}
      </div>
    </fieldset>
    <fieldset className={styles.field} disabled={disabled}>
      <legend>월세 시세</legend>
      <select
        className={styles.select}
        aria-label="최대 월세 시세"
        value={preview.maxRent}
        onChange={(event) => preview.changeMaxRent(Number(event.target.value))}
      >
        {RENT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <small>최근 6개월 실거래 월세 중앙값으로 걸러요.</small>
    </fieldset>
    <Button
      className={styles.submit}
      fullWidth
      disabled={disabled || !preview.hasChosenMapPoint || !preview.isValidCommuteTime}
      onClick={onSubmit}
    >
      이 조건으로 동네 찾기
    </Button>
  </aside>
);

export default ConditionPanel;
