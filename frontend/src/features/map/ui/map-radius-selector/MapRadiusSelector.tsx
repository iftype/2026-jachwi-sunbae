import styles from './MapRadiusSelector.module.css';

export type MapRadiusOption<T extends number | string> = {
  value: T;
  label: string;
  isSelected: boolean;
};

type MapRadiusSelectorProps<T extends number | string> = {
  label: string;
  options: MapRadiusOption<T>[];
  onSelect: (value: T) => void;
  className?: string;
  disabled?: boolean;
};

const MapRadiusSelector = <T extends number | string>({
  label,
  options,
  onSelect,
  className = '',
  disabled = false,
}: MapRadiusSelectorProps<T>) => (
  <div className={`${styles.filters} ${className}`} aria-label={label}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        disabled={disabled}
        aria-pressed={option.isSelected}
        onClick={() => onSelect(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export default MapRadiusSelector;
