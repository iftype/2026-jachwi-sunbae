import MapBadgeRail from '@/shared/ui/map-badge-rail/MapBadgeRail';

type RecordDistrictsProps = {
  districts: string[];
  /** 동네별 매물 수. 뱃지 오른쪽에 숫자로 둔다. */
  counts?: Record<string, number>;
  district: string;
  onSelect: (district: string) => void;
  /** 지도 위에 떠 있을 때 고르지 않은 뱃지를 흰 바탕·그림자로 바꿔 지도 위에서도 잘 보이게 한다. */
  overMap?: boolean;
  className?: string;
  desktopMap?: boolean;
};

/** 기록한 동네 뱃지 줄. 고른 동네의 기록만 리스트와 지도에 보여 준다. */
const RecordDistricts = ({
  districts,
  counts,
  district,
  onSelect,
  overMap = false,
  className,
  desktopMap,
}: RecordDistrictsProps) => (
  <MapBadgeRail
    items={districts.map((name) => ({ id: name, label: name, value: counts?.[name] }))}
    selectedId={district}
    onSelect={onSelect}
    label="기록한 동네"
    overMap={overMap}
    desktopMap={desktopMap}
    className={className}
  />
);
export default RecordDistricts;
