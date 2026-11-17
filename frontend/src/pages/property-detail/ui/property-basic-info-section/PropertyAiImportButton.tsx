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
      <button type="button" disabled={isImporting} onClick={() => inputRef.current?.click()}>
        <Icon name="image" size={16} /> {isImporting ? '분석 중…' : '이미지로 정보 채우기'}
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

export default PropertyAiImportButton;
