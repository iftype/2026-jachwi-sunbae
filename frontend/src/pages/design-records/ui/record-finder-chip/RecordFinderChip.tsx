import { css } from '@emotion/css';

import NEIGHBORHOOD_ICON from '@/shared/assets/illustrations/icon-map.webp';
import Icon from '@/shared/ui/icon/Icon';

import { useFinderPrompt } from '../../hooks/useFinderPrompt';

/**
 * 휴대폰 내 기록 지도 머리 줄, 로고와 검색 버튼 사이에 두는 동네 찾기 칩. 누르면 동네 찾기로 넘어간다.
 * 표시 조건은 `useFinderPrompt`를 따르고, 조건에서 빠지면 아무것도 그리지 않아 머리 줄은 빈 채로 둔다.
 */
const RecordFinderChip = () => {
  const open = useFinderPrompt();
  if (open === null) return null;
  return (
    <button type="button" className={styles.chip} onClick={open}>
      <img src={NEIGHBORHOOD_ICON} alt="" width={20} height={20} />
      출퇴근 시간으로 동네 찾기
      <Icon name="chevron-right" size={14} />
    </button>
  );
};

const styles = {
  chip: css`
    label: RecordFinderChip-chip;
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 0.3rem;
    box-sizing: border-box;
    height: 2.5rem;
    padding: 0 0.6rem 0 0.5rem;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-brand-blue-ink) 12%, #fff);
    color: var(--color-brand-blue-ink);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    white-space: nowrap;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
  `,
};

export default RecordFinderChip;
