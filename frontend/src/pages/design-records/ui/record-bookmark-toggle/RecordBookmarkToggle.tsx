import { css } from '@emotion/css';

import type { RecordsMapLayers } from '../../hooks/useRecordsMapLayers';

type Props = { bookmarks: RecordsMapLayers['bookmarks'] };

/**
 * 동네 찾기에서 찜한 동네를 내 기록 지도 위에 칠할지 켜고 끄는 버튼.
 * 현재 위치 버튼 바로 아래, 지도 오른쪽의 조작 버튼 줄에 같은 둥근 모양으로 둔다. 하트로 찜을 알리고, 찜한 동네 수는 작은 뱃지로 보인다.
 */
const RecordBookmarkToggle = ({ bookmarks }: Props) => (
  <button
    className={styles.button}
    type="button"
    aria-pressed={bookmarks.isOn}
    aria-label={bookmarks.isOn ? '찜한 동네 숨기기' : '찜한 동네 보기'}
    title={bookmarks.isOn ? '찜한 동네 숨기기' : '찜한 동네 보기'}
    onClick={bookmarks.toggle}
  >
    {/* 행정동을 닮은 들쭉날쭉한 경계 도형 안에 작은 하트를 둬서, 동네를 찜한다는 뜻을 보인다. */}
    <svg
      aria-hidden="true"
      focusable="false"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    >
      <path
        d="M4.5 8.2 10.2 4l5.6 2.1 3.8 4.4-1 5.3-4.8 4.2-6.4-1.2-3.1-4.3Z"
        fill={bookmarks.isOn ? 'currentColor' : 'none'}
        fillOpacity={bookmarks.isOn ? 0.28 : 0}
      />
      <path
        d="M12 15.6s-3-1.9-3-4.1a1.7 1.7 0 0 1 3-1.1 1.7 1.7 0 0 1 3 1.1c0 2.2-3 4.1-3 4.1Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
    {bookmarks.count > 0 && <span aria-hidden="true">{bookmarks.count}</span>}
  </button>
);

const styles = {
  button: css`
    label: RecordBookmarkToggle-button;
    position: absolute;
    z-index: 12;
    top: 13.7rem;
    right: 1.15rem;
    display: grid;
    place-items: center;
    width: 2.65rem;
    height: 2.65rem;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: #fff;
    color: #41444b;
    box-shadow: 0 2px 10px #00000016;
    cursor: pointer;

    & span {
      position: absolute;
      top: -0.25rem;
      right: -0.25rem;
      min-width: 1.15rem;
      height: 1.15rem;
      padding: 0 0.25rem;
      border-radius: 999px;
      background: #7c3aed;
      color: #fff;
      font-size: 0.65rem;
      font-weight: 800;
      line-height: 1.15rem;
      text-align: center;
    }
    &[aria-pressed='true'] {
      background: #7c3aed;
      color: #fff;
    }
    &[aria-pressed='true'] span {
      background: #fff;
      color: #7c3aed;
    }
    &:focus-visible {
      outline: 2px solid #25282d;
      outline-offset: 3px;
    }
    [data-desktop='false'] & {
      top: calc(max(0.85rem, env(safe-area-inset-top)) + 16.95rem);
      right: 0.95rem;
    }
  `,
};

export default RecordBookmarkToggle;
