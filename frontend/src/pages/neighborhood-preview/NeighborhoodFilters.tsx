import { useState } from 'react';

import { Button } from '@/shared/ui/button/Button';
import WheelPicker from '@/shared/ui/wheel-picker/WheelPicker';

import type { NeighborhoodPreviewContext } from './hooks/useNeighborhoodPreview';

import styles from './NeighborhoodFilters.module.css';

type FilterValues = Pick<
  NeighborhoodPreviewContext,
  'maxMinutes' | 'changeMaxMinutes' | 'maxTransfers' | 'changeMaxTransfers' | 'maxRent' | 'changeMaxRent'
>;
export type NeighborhoodFilterField = 'minutes' | 'transfers' | 'rent';
const RENT_OPTIONS = [
  { value: 0, label: '전체 가격' },
  ...Array.from({ length: 20 }, (_, index) => ({ value: (index + 1) * 10, label: `${(index + 1) * 10}만원 이하` })),
];
const MINUTE_OPTIONS = Array.from({ length: 6 }, (_, index) => ({
  value: (index + 1) * 10,
  label: `${(index + 1) * 10}분 이내`,
}));
const NeighborhoodFilters = ({
  preview,
  field,
  onClose,
  onApply,
}: {
  preview: FilterValues;
  field: NeighborhoodFilterField;
  onClose: () => void;
  onApply?: () => void;
}) => {
  const [draft, setDraft] = useState(
    field === 'minutes' ? preview.maxMinutes : field === 'rent' ? preview.maxRent : preview.maxTransfers,
  );
  return (
    <div className={styles.editor}>
      {field !== 'transfers' ? (
        <WheelPicker
          label={field === 'rent' ? '최대 월세 평균가' : '최대 통근 시간'}
          options={field === 'rent' ? RENT_OPTIONS : MINUTE_OPTIONS}
          value={draft}
          onValueChange={setDraft}
        />
      ) : (
        <div className={styles.choices} role="radiogroup" aria-label="최대 환승 횟수">
          {[0, 1, 2].map((count) => (
            <Button
              key={count}
              role="radio"
              aria-checked={draft === count}
              variant={draft === count ? 'soft' : 'secondary'}
              onClick={() => setDraft(count)}
            >
              {count === 0 ? '환승 없음' : `${count}회 이하`}
            </Button>
          ))}
        </div>
      )}
      <Button
        variant="soft"
        fullWidth
        onClick={() => {
          if (field === 'minutes') preview.changeMaxMinutes(draft);
          else if (field === 'rent') preview.changeMaxRent(draft);
          else preview.changeMaxTransfers(draft);
          onApply?.();
          onClose();
        }}
      >
        적용
      </Button>
    </div>
  );
};
export default NeighborhoodFilters;
