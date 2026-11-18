/**
 * 앱 화면 코드를 받기 전에 보여 주는 뼈대. 스타일은 index.html의 앱 뼈대(`.boot-skeleton`)를 함께 쓴다.
 * 첫 진입에서는 JS를 받기 전부터 같은 뼈대가 보이고, React가 그려도 모양이 그대로라 뼈대에서 홈으로 한 번만 바뀐다.
 * 마크업은 index.html과 같아야 한다(테스트가 확인한다).
 */
const BootSkeleton = () => (
  <div className="boot-skeleton boot-skeleton--home" role="progressbar" aria-label="화면을 불러오는 중이에요.">
    <div className="boot-skeleton__header" />
    <div className="boot-skeleton__body">
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  </div>
);

export default BootSkeleton;
