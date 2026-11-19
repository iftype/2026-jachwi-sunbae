import type { ReactNode } from 'react';
import { useId } from 'react';

import * as styles from './DetailSection.styles';

export type DetailSectionProps = {
  title: string;
  /** 제목을 대신해 스크린리더가 읽을 이름이 필요할 때 사용한다. */
  label?: string;
  meta?: ReactNode;
  /** 편집 링크나 섹션별 대표 액션을 헤더 오른쪽에 배치한다. */
  action?: ReactNode;
  /** 섹션에 덧붙일 상태 표시. 수정 중인 섹션의 바탕을 바꿀 때 쓴다. */
  isHighlighted?: boolean;
  children: ReactNode;
};

/** 매물 상세처럼 제목·보조 정보·액션을 반복하는 화면 섹션의 표시 구조만 담당한다. */
const DetailSection = ({ title, label, meta, action, isHighlighted = false, children }: DetailSectionProps) => {
  const headingId = useId();

  return (
    <section
      className={styles.section}
      data-highlighted={isHighlighted || undefined}
      aria-label={label}
      aria-labelledby={label === undefined ? headingId : undefined}
    >
      <div className={styles.heading}>
        <div>
          <h2 id={headingId}>{title}</h2>
          {meta}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
};

export default DetailSection;
