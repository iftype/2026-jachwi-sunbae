import { css } from '@emotion/css';
import type { ReactNode } from 'react';

import DetailSection from '@/shared/ui/detail-section/DetailSection';

type PropertyInfoSectionProps = {
  title: string;
  /** 화면에 보이는 제목과 다른 이름으로 섹션을 읽어야 할 때 쓴다. */
  label?: string;
  /** 섹션 헤더 오른쪽에 놓을 편집 링크 등. */
  action?: ReactNode;
  /** 제목 바로 옆에 놓을 것. 수정 연필처럼 제목에 딸린 버튼에 쓴다. */
  meta?: ReactNode;
  children: ReactNode;
};

/** 매물 상세의 정보 목록을 DetailSection 안에 배치하는 feature 조합 UI. */
const PropertyInfoSection = ({ title, label, action, meta, children }: PropertyInfoSectionProps) => (
  <DetailSection title={title} label={label} action={action} meta={meta}>
    <dl className={styles.summary}>{children}</dl>
  </DetailSection>
);

const styles = {
  summary: css`
    label: PropertyInfoSection-summary;
    display: grid;
    gap: 0;
    margin: 0;
  `,
};

export default PropertyInfoSection;
