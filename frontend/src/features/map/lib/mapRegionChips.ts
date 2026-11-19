import type { MapRegion } from '../model/MapCanvas';
import { mapZoomScale } from './mapMarkerPresentation';
import { regionLabelPosition } from './mapRegionSummary';

/** 앱 확대 단계 1이 네이버 zoom 19다(`naverMapEngine`의 변환과 같다). */
const NAVER_ZOOM_BASE = 20;
/** 이름표 글자 한 칸과 안쪽 여백, 높이를 px로 어림한다. 이름표끼리 이만큼 떨어져 있어야 함께 보인다. */
const CHAR_WIDTH = 11;
const CHIP_PADDING = 18;
const CHIP_HEIGHT = 20;
const CHIP_GAP = 4;

/** 지도 축척(256px 타일)에서 위경도를 세계 픽셀 좌표로 바꾼다. 같은 단계 안의 상대 거리만 쓰므로 화면을 움직여도 결과가 같다. */
const worldPixel = (point: { latitude: number; longitude: number }, zoom: number) => {
  const size = 256 * 2 ** zoom;
  const sin = Math.sin((point.latitude * Math.PI) / 180);
  return {
    x: ((point.longitude + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
};

const commuteMinutes = (region: MapRegion) => {
  const minutes = Number.parseInt(region.rentLabel?.commute ?? '', 10);
  return Number.isNaN(minutes) ? Infinity : minutes;
};

/**
 * 휴대폰 이름표 가운데 서로 겹치지 않는 것만 고른다. 고른 동네, 찜한 동네, 월세 조건 안, 통근이 짧은 동네 순으로 먼저 자리를 잡고,
 * 앞서 자리 잡은 이름표와 겹치는 것은 숨긴다. 멀리 볼수록 동이 촘촘해져 보이는 수가 저절로 줄어든다.
 */
export const pickVisibleChips = (regions: MapRegion[], selectedId: string | null, level: number): Set<string> => {
  const zoom = NAVER_ZOOM_BASE - level;
  const scale = mapZoomScale(level);
  const rank = (region: MapRegion) => [
    region.id === selectedId ? 0 : 1,
    region.rentLabel?.isBookmarked === true || (region.showsName === true && !region.rentLabel) ? 0 : 1,
    region.rentLabel?.filteredOut === true ? 1 : 0,
    commuteMinutes(region),
  ];
  const ordered = regions
    .map((region, index) => ({ region, index, rank: rank(region) }))
    .sort((a, b) => {
      for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
      return a.index - b.index;
    });
  const placed: { left: number; right: number; top: number; bottom: number }[] = [];
  const visible = new Set<string>();
  for (const { region } of ordered) {
    const { x, y } = worldPixel(regionLabelPosition(region), zoom);
    const text =
      region.name.length + (region.rentLabel?.commute?.length ?? 0) + (region.rentLabel?.isBookmarked ? 1 : 0);
    const halfWidth = ((text * CHAR_WIDTH + CHIP_PADDING) * scale + CHIP_GAP) / 2;
    const halfHeight = (CHIP_HEIGHT * scale + CHIP_GAP) / 2;
    const box = { left: x - halfWidth, right: x + halfWidth, top: y - halfHeight, bottom: y + halfHeight };
    if (
      placed.some(
        (other) => box.left < other.right && other.left < box.right && box.top < other.bottom && other.top < box.bottom,
      )
    )
      continue;
    placed.push(box);
    visible.add(region.id);
  }
  return visible;
};
