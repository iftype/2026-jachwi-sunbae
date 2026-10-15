import Icon from '@/shared/ui/icon/Icon';

import type { AddressSearchStatus } from '../../model/AddressSearch';
import type { MapAddress } from '../../model/Map';

import styles from './AddressSearchResults.module.css';

type AddressSearchResultsProps = {
  results: MapAddress[];
  status: AddressSearchStatus;
  onSelect: (address: MapAddress) => void;
};
/** API와 라우터 없이 검색 결과·로딩·오류를 표현한다. 지도와 위치 선택에서 함께 쓴다. */
const AddressSearchResults = ({ results, status, onSelect }: AddressSearchResultsProps) => (
  <>
    {status === 'loading' && (
      <p className={styles.state} role="status">
        주소를 찾는 중이에요…
      </p>
    )}
    {status === 'error' && (
      <p className={styles.error} role="alert">
        주소를 찾지 못했어요. 다시 시도해 주세요.
      </p>
    )}
    {status === 'success' && results.length === 0 && <p className={styles.state}>검색 결과가 없어요.</p>}
    {status === 'success' && results.length > 0 && (
      <ul className={styles.results} aria-label="주소 검색 결과">
        {results.map((result) => {
          const primary = result.roadAddress ?? result.jibunAddress ?? result.address ?? '주소 정보 없음';
          const secondary = result.roadAddress !== null && result.jibunAddress !== null ? result.jibunAddress : null;

          return (
            <li key={`${result.latitude}-${result.longitude}`}>
              <button type="button" className={styles.item} onClick={() => onSelect(result)}>
                <Icon name="locate" size={18} />
                <span className={styles.text}>
                  <strong>{primary}</strong>
                  {secondary !== null && <small>{secondary}</small>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </>
);
export default AddressSearchResults;
