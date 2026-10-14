import Icon from '@/shared/ui/icon/Icon';

import styles from './MapCurrentLocationButton.module.css';

type MapCurrentLocationButtonProps = {
  isLocating?: boolean;
  onClick: () => void;
  className?: string;
};

const MapCurrentLocationButton = ({ isLocating = false, onClick, className }: MapCurrentLocationButtonProps) => (
  <button
    type="button"
    className={`${styles.button} ${className ?? ''}`.trim()}
    aria-label="내 현재 위치로 이동"
    disabled={isLocating}
    aria-busy={isLocating || undefined}
    onClick={onClick}
  >
    <Icon name="target" size={22} />
  </button>
);

export default MapCurrentLocationButton;
