import { useState } from 'react';

import BottomActionArea from '@/shared/ui/bottom-action-area/BottomActionArea';
import { Button, ButtonLink } from '@/shared/ui/button/Button';
import EmptyState from '@/shared/ui/empty-state/EmptyState';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';
import SearchField from '@/shared/ui/search-field/SearchField';
import TextAreaField from '@/shared/ui/text-field/TextAreaField';
import TextField from '@/shared/ui/text-field/TextField';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import styles from './ComponentCatalog.module.css';

const ComponentCatalog = () => {
  const [query, setQuery] = useState('신림역');
  const colors = [
    { label: 'Brand', token: '--color-brand-300', value: '#CBEFB6' },
    { label: 'Brand surface', token: '--color-surface-brand', value: '#EDF9E6' },
    { label: 'Primary', token: '--color-primary', value: '#3F7C1B' },
    { label: 'Primary strong', token: '--color-primary-strong', value: '#326316' },
    { label: 'Ink', token: '--color-ink', value: '#171C18' },
    { label: 'Muted', token: '--color-muted', value: '#69736B' },
  ];

  return (
    <div className={styles.canvas}>
      <main className={styles.catalog}>
        <TopNavigation title="공용 컴포넌트" backTo="/" />
        <div className={styles.content}>
          <header className={styles.intro}>
            <span>LOCAL COMPONENT CATALOG</span>
            <h1>작게 만들고, 실제 화면에서 조합합니다.</h1>
            <p>공용 컴포넌트는 모양과 접근성만 담당하고 API와 도메인 상태는 페이지에 남깁니다.</p>
          </header>

          <section className={styles.section}>
            <h2>Color</h2>
            <div className={styles.colorGrid}>
              {colors.map((color) => (
                <div className={styles.colorItem} key={color.token}>
                  <span className={styles.colorSwatch} style={{ background: `var(${color.token})` }} />
                  <span>
                    <strong>{color.label}</strong>
                    <small>{color.value}</small>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2>Button</h2>
            <div className={styles.inlineExamples}>
              <Button>확인</Button>
              <Button variant="soft">저장</Button>
              <Button variant="secondary">취소</Button>
              <Button variant="text">나중에</Button>
            </div>
            <Button fullWidth isLoading loadingLabel="저장 중…">
              저장
            </Button>
            <ButtonLink to="/" variant="secondary" fullWidth>
              매물 목록으로 이동
            </ButtonLink>
          </section>

          <section className={styles.section}>
            <h2>Field</h2>
            <TextField label="매물 이름" placeholder="예: 신림역 원룸" />
            <TextField label="보증금" defaultValue="1,000" suffix="만원" helpText="만원 단위로 입력해 주세요." />
            <TextField label="오류 상태" defaultValue="" error="필수 입력값입니다." />
            <TextAreaField label="확인한 곳" rows={3} placeholder="URL이나 중개사 정보를 입력해 주세요." />
          </section>

          <section className={styles.section}>
            <h2>SearchField</h2>
            <SearchField
              label="매물 이름 검색"
              value={query}
              placeholder="매물 이름으로 검색"
              onValueChange={setQuery}
              onSubmit={() => undefined}
            />
          </section>

          <section className={styles.section}>
            <h2>InlineNotice</h2>
            <InlineNotice>입력한 내용은 자동으로 유지되지 않아요.</InlineNotice>
            <InlineNotice tone="warning">체크리스트 단계는 만든 뒤 변경할 수 없어요.</InlineNotice>
            <InlineNotice tone="error">저장하지 못했어요. 잠시 후 다시 시도해 주세요.</InlineNotice>
          </section>

          <section className={styles.section}>
            <h2>EmptyState</h2>
            <EmptyState
              title="아직 등록한 매물이 없어요."
              description="첫 매물을 등록하고 방문 전에 확인할 내용을 준비해 보세요."
              action={<Button>새 매물 등록</Button>}
            />
          </section>

          <section className={styles.section}>
            <h2>BottomActionArea</h2>
            <BottomActionArea placement="inline">
              <Button variant="secondary">이전</Button>
              <Button>다음</Button>
            </BottomActionArea>
          </section>
        </div>
      </main>
    </div>
  );
};

export default ComponentCatalog;
