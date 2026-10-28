import styles from './MapTapHint.module.css';

/**
 * 위치를 고르기 전 화면 아래에 지도를 누르라는 안내를 띄운다. 처음 온 사람이 지도를 눌러야 하는지 몰라 멈추는 일이 많아서,
 * 한 번 보고 닫는 안내 대신 위치를 고를 때까지 매번 띄운다. 지도 위 한 점에 두면 확대·이동해도 따라와 마커처럼 보이므로,
 * 지도와 무관한 화면 아래 띠에 두고 누르는 동작은 띠 안의 아이콘으로 보여준다. 클릭은 지도로 그대로 흘려보낸다.
 */
const MapTapHint = () => (
  <div className={styles.hint}>
    <span className={styles.tap} aria-hidden="true">
      <i />
    </span>
    <p role="note">
      <strong>지도를 눌러 출퇴근 장소를 찍어보세요</strong>
      <small>위 검색창에서 학교·회사를 찾아도 돼요</small>
    </p>
  </div>
);

export default MapTapHint;
