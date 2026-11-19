import { css } from '@emotion/css';

/** 방금 저장했을 때 섹션 제목 옆에 잠깐 보여 줄 말. */
const PropertySavedNote = ({ text }: { text: string }) => (
  <span className={styles.feedback} role="status">
    {text}
  </span>
);

const styles = {
  feedback: css`
    label: PropertySavedNote-feedback;
    color: var(--color-brand-blue-ink);
    font-size: 0.75rem;
    font-weight: 700;
  `,
};

export default PropertySavedNote;
