import { css } from '@emotion/css';

import { usePropertyAiImport } from '@/features/property/model/usePropertyAiImport';

import PropertyAiImportButton from './PropertyAiImportButton';

/**
 * 매물정보 자동 입력. 기본 정보 섹션의 일부처럼 보이지 않게, 섹션 밖 위쪽에 따로 한 줄로 둔다.
 * 이미지를 올리면 분석하는 동안의 안내와 결과 안내도 이 줄 아래에 보인다.
 */
const PropertyAiImportBar = ({ propertyId }: { propertyId: number }) => {
  const aiImport = usePropertyAiImport(propertyId);
  return (
    <div className={styles.bar}>
      <PropertyAiImportButton
        isImporting={aiImport.isImporting}
        onSelectFiles={(files) => void aiImport.importFiles(files)}
      />
      {aiImport.isImporting ? (
        <p className={styles.feedback} role="status">
          이미지를 분석하고 있어요. 1분 정도 걸릴 수 있어요.
        </p>
      ) : (
        aiImport.feedback !== null && (
          <p
            className={styles.feedback}
            data-tone={aiImport.feedback.tone}
            role={aiImport.feedback.tone === 'error' ? 'alert' : 'status'}
          >
            {aiImport.feedback.message}
          </p>
        )
      )}
    </div>
  );
};

const styles = {
  bar: css`
    label: PropertyAiImportBar-bar;
    display: grid;
    justify-items: end;
    gap: 0.4rem;
    margin-bottom: 0.75rem;
  `,
  feedback: css`
    label: PropertyAiImportBar-feedback;
    margin: 0;
    color: var(--color-muted);
    font-size: 0.75rem;
    line-height: 1.5;

    &[data-tone='error'] {
      color: var(--color-error);
    }
  `,
};

export default PropertyAiImportBar;
