import { css } from '@emotion/css';

import { Button } from '@/shared/ui/button/Button';

import { MIN_SELECTION } from '../../hooks/usePropertyComparison';

type CompareActionBarProps = {
  selectedCount: number;
  isExporting: boolean;
  onDownload: () => void;
};

/** 매물이 하나라도 있으면 보이는 아래 고정 바. 하나만 골라도 PDF로 받는다. */
const CompareActionBar = ({ selectedCount, isExporting, onDownload }: CompareActionBarProps) => {
  return (
    <div className={styles.actionBar}>
      <p>
        {selectedCount < MIN_SELECTION
          ? 'PDF로 받을 매물을 골라 주세요.'
          : `${selectedCount}개 매물의 모든 기록을 PDF로 만들어요.`}
      </p>
      <Button
        className={styles.button}
        fullWidth
        disabled={selectedCount < MIN_SELECTION}
        isLoading={isExporting}
        loadingLabel="PDF 만드는 중…"
        onClick={onDownload}
      >
        선택한 {selectedCount}개 PDF 받기
      </Button>
    </div>
  );
};

const styles = {
  button: css`
    label: CompareActionBar-button;

    @media (min-width: 1024px) {
      &&& {
        width: min(100%, 18rem);
      }
      min-height: 2.5rem;
      font-size: 0.85rem;
    }
  `,
  actionBar: css`
    label: CompareActionBar-actionBar;
    position: fixed;
    z-index: 16;
    right: max(calc((100vw - var(--app-max-width)) / 2), 0px);
    bottom: var(--mobile-tab-space, env(safe-area-inset-bottom));
    left: max(calc((100vw - var(--app-max-width)) / 2), 0px);
    display: grid;
    gap: 0.45rem;
    padding: 0.65rem 1rem 0.85rem;
    border-top: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-canvas) 94%, transparent);
    backdrop-filter: blur(10px);

    /* 데스크탑: 왼쪽 레일(76px)을 피하고, 버튼은 화면 폭을 다 채우지 않고 가운데에 알맞은 크기로 둔다. */
    @media (min-width: 1024px) {
      right: 0;
      left: 76px;
      bottom: 0;
      justify-items: center;
      gap: 0.3rem;
      padding: 0.5rem 1rem 0.65rem;
    }

    & p {
      margin: 0;
      color: var(--color-muted);
      font-size: 0.62rem;
      text-align: center;
    }
  `,
};

export default CompareActionBar;
