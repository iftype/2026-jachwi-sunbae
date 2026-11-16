import { css } from '@emotion/css';
import { useState } from 'react';

import MapTapIntro from '@/shared/ui/map-tap-intro/MapTapIntro';

/**
 * 위치를 고르기 전 지도를 눌러 출퇴근 장소를 찍으라는 안내. 본 방 기록과 같은 지도 안내(`MapTapIntro`)를 쓴다.
 * 처음 온 사람이 지도를 눌러야 하는지 몰라 멈추는 일이 많아서, 한 번 보고 마는 안내 대신 위치를 고를 때까지 띄운다.
 * 건너뛰면 이 화면에 있는 동안만 다시 띄우지 않는다. 클릭은 지도로 그대로 흘려보낸다.
 */
const MapTapHint = () => {
  const [isSkipped, setIsSkipped] = useState(false);
  if (isSkipped) return null;
  return (
    <MapTapIntro
      className={styles.overlay}
      title="지도를 눌러 출퇴근 장소를 찍어보세요"
      description="위 검색창에서 학교·회사를 찾아도 돼요"
      onSkip={() => setIsSkipped(true)}
    />
  );
};

const styles = {
  /* 검색창(30), 아래 조건 시트(20), 현재 위치 버튼보다 아래에 깔아 그것들은 어둡게 덮지 않는다. */
  overlay: css`
    label: MapTapHint-overlay;
    z-index: 15;

    /* 밝은 지도 글자와 손 그림 위에서도 읽히게 안내 글만 반투명한 어두운 판 위에 둔다. */
    & > p {
      padding: 0.8rem 1.1rem;
      border-radius: 0.9rem;
      background: rgb(20 23 28 / 72%);
      text-shadow: none;
      backdrop-filter: blur(6px);
    }
  `,
};

export default MapTapHint;
