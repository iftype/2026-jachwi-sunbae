import styles from './RecordDistricts.module.css';

type RecordDistrictsProps = {
  districts: string[];
  district: string;
  onSelect: (district: string) => void;
  /** 지도 위에 떠 있을 때 고르지 않은 뱃지를 흰 바탕·그림자로 바꿔 지도 위에서도 잘 보이게 한다. */
  overMap?: boolean;
  className?: string;
};

/** 기록한 동네 뱃지 줄. 고른 동네의 기록만 리스트와 지도에 보여 준다. */
const RecordDistricts = ({ districts, district, onSelect, overMap = false, className }: RecordDistrictsProps) => (
  <nav
    className={`${styles.districts} ${className ?? ''}`.trim()}
    data-over-map={overMap || undefined}
    aria-label="기록한 동네"
  >
    {districts.map((label) => (
      <button key={label} type="button" aria-pressed={district === label} onClick={() => onSelect(label)}>
        {label}
      </button>
    ))}
  </nav>
);

export default RecordDistricts;
