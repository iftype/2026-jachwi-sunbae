import { css } from '@emotion/css';
import { useRef } from 'react';

import { acceptedAiImportTypes } from '@/features/property/model/usePropertyAiImport';
import Icon from '@/shared/ui/icon/Icon';

type PropertyAiImportButtonProps = {
  isImporting: boolean;
  onSelectFiles: (files: File[]) => void;
};

/** 기본 정보 제목 오른쪽에 두는 버튼. 누르면 파일 선택 창을 열고, 고른 이미지를 바로 분석에 넘긴다. */
const PropertyAiImportButton = ({ isImporting, onSelectFiles }: PropertyAiImportButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={styles.button} disabled={isImporting} onClick={() => inputRef.current?.click()}>
        <Icon name="sparkles" size={14} />
        {isImporting ? '분석 중…' : '매물정보 자동 입력'}
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
  // 섹션 헤더의 텍스트형 버튼 규칙(.heading button)보다 우선하도록 선택자를 겹친다.
  button: css`
    label: PropertyAiImportButton-button;

    && {
      gap: 0.3rem;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      background: linear-gradient(135deg, #7c3aed, #6d28d9);
      color: #fff;
      font-size: 0.72rem;
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
