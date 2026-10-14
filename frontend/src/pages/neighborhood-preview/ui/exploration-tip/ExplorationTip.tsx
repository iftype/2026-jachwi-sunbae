import styles from './ExplorationTip.module.css';

type Props = {
  step: 'location' | 'filter' | 'search';
  mode: 'commute' | 'price';
  onSkip: () => void;
  onKeepDefaults: () => void;
};
const ExplorationTip = ({ step, mode, onSkip, onKeepDefaults }: Props) => {
  const title =
    step === 'location'
      ? '먼저 위치를 골라주세요'
      : step === 'filter'
        ? '원하는 조건을 정해주세요'
        : '이제 동네를 찾아볼까요?';
  const description =
    step === 'location'
      ? mode === 'commute'
        ? '출퇴근하는 곳을 검색하거나 지도를 눌러주세요.'
        : '관심 있는 동네를 검색하거나 지도를 눌러주세요.'
      : step === 'filter'
        ? mode === 'commute'
          ? '위의 통근 시간·환승 배지를 눌러 바꿀 수 있어요.'
          : '위의 월세 배지를 눌러 가격 범위를 정할 수 있어요.'
        : '지도 마커 옆 ‘선택한 조건으로 찾기’를 눌러주세요.';
  return (
    <aside className={styles.tip} data-step={step} aria-label="동네 탐색 사용 안내">
      <div role="status" aria-live="polite" aria-atomic="true">
        <small>{step === 'location' ? '1' : step === 'filter' ? '2' : '3'} / 3</small>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className={styles.actions}>
        {step === 'filter' && <button onClick={onKeepDefaults}>지금 조건으로 할게요 →</button>}
        <button onClick={onSkip}>안내 건너뛰기</button>
      </div>
    </aside>
  );
};
export default ExplorationTip;
