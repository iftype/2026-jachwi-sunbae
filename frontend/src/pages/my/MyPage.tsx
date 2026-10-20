import { useOutletContext } from 'react-router-dom';

import { clearAuthentication } from '@/features/auth/model/authStore';
import type { Member } from '@/features/auth/model/Member';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import { Button } from '@/shared/ui/button/Button';
import type { IconName } from '@/shared/ui/icon/Icon';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import MyMenuLink from './ui/my-menu-link/MyMenuLink';
import MyNoticeLink from './ui/my-notice-link/MyNoticeLink';

import styles from './MyPage.module.css';

const myMenuItems: Array<{ to: string; icon: IconName; label: string }> = [
  { to: '/properties', icon: 'home', label: '내 매물 관리' },
  { to: '/checklists', icon: 'checklist', label: '내 체크리스트 관리' },
  { to: '/map', icon: 'map', label: '지도와 주변 시설' },
  { to: '/compare', icon: 'external-link', label: '매물 비교 PDF' },
  { to: '/about', icon: 'info', label: '자취선배 소개' },
];

const myNoticeItems = [
  {
    to: '/tips',
    title: '선배팁 · 계약 전 꼭 확인할 7가지',
    description: '먼저 자취한 선배들이 남긴 정보를 확인해요.',
  },
  {
    to: '/privacy#account-deletion',
    title: '계정 및 데이터 삭제 요청',
    description: '자취선배 계정과 연결된 기록의 삭제를 요청해요.',
  },
];

const MyPage = () => {
  const config = usePublicConfig();
  const member = useOutletContext<Member>();
  const displayInitial = member.displayName.trim().slice(0, 1) || '자';

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <TopNavigation title="마이" backTo="/" backLabel="홈으로 돌아가기" />
        <section className={styles.profileCard} aria-labelledby="member-heading">
          <span className={styles.avatar} aria-hidden="true">
            {displayInitial}
          </span>
          <div className={styles.memberInfo}>
            <h2 id="member-heading">{member.displayName}</h2>
            <p>
              {member.passwordProtected ? '비밀번호로 기록을 보호하고 있어요.' : '비밀번호 없는 공유 닉네임이에요.'}
            </p>
            <small>브라우저를 닫으면 다시 닉네임으로 시작합니다.</small>
          </div>
        </section>
        <nav className={styles.menu} aria-label="내 기록">
          {myMenuItems.map((item) => (
            <MyMenuLink key={item.to} {...item} />
          ))}
        </nav>
        {myNoticeItems.map((item) => (
          <MyNoticeLink key={item.to} {...item} />
        ))}
        <footer className={styles.footer}>
          <span>자취선배 MVP2 · {config.mapProviderMode === 'demo' ? 'DEMO MAP' : 'LIVE MAP'}</span>
          <Button variant="text" className={styles.logoutButton} onClick={() => clearAuthentication('logout')}>
            로그아웃
          </Button>
        </footer>
      </div>
    </main>
  );
};

export default MyPage;
