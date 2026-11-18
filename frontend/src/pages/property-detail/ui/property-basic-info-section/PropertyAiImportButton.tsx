import { css } from '@emotion/css';
import { useRef } from 'react';

import { acceptedAiImportTypes } from '@/features/property/model/usePropertyAiImport';
import Icon from '@/shared/ui/icon/Icon';

type PropertyAiImportButtonProps = {
  isImporting: boolean;
  onSelectFiles: (files: File[]) => void;
};

/** 기본 정보 섹션 밖에 두는 버튼. 누르면 파일 선택 창을 열고, 고른 이미지를 바로 분석에 넘긴다. */
const PropertyAiImportButton = ({ isImporting, onSelectFiles }: PropertyAiImportButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={styles.button} disabled={isImporting} onClick={() => inputRef.current?.click()}>
        <Icon name="sparkles" size={14} />
        {isImporting ? '분석 중…' : '캡처 이미지로 자동입력'}
      </button>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={acceptedAiImportTypes.join(',')}
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          onSelectFiles(Array.from(event.target.files ?? []));
          // 같은 파일을 다시 골라도 change가 일어나게 비운다.
          event.target.value = '';
        }}
      />
    </>
  );
};

const styles = {
  // 섹션 제목 줄 밖(topAction)에 놓여도 모양이 같도록, 헤더 버튼 규칙(.heading button)에 기대지 않고 필요한 값을 모두 직접 둔다.
  button: css`
    label: PropertyAiImportButton-button;

    && {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: 0.3rem;
      border: 0;
      font: inherit;
      font-size: 0.72rem;
      font-weight: 800;
      cursor: pointer;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      background: linear-gradient(135deg, #7c3aed, #6d28d9);
      color: #fff;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgb(109 40 217 / 25%);
    }

    &&:disabled {
      opacity: 0.6;
      cursor: default;
    }
  `,
};

export default PropertyAiImportButton;
