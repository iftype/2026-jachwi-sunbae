import { css } from '@emotion/css';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { logoutAuthentication } from '@/features/auth/api/apiClient';
import appleLogo from '@/features/auth/assets/apple-logo-white.svg';
import kakaoSymbol from '@/features/auth/assets/kakao-symbol.svg';
import { getAuthenticationSnapshot } from '@/features/auth/model/authStore';
import {
  getAvailableOAuthProviders,
  isOAuthLinkAvailable,
  usesNativeOAuth,
} from '@/features/auth/model/oauthAvailability';
import { detectUnfinishedOAuthLink, startNativeOAuthLink, startOAuthLink } from '@/features/auth/model/oauthFlow';
import {
  OAUTH_PROVIDER_LABELS,
  type OAuthNotice,
  type OAuthProvider,
  readLinkedProvider,
  stashOAuthNotice,
  takeStashedOAuthNotice,
} from '@/features/auth/model/oauthLink';
import { readPropertyCount } from '@/features/property/api/propertyCount';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import { HOME_PATH } from '@/shared/lib/navigation/appPaths';
import Icon from '@/shared/ui/icon/Icon';
import Toast from '@/shared/ui/toast/Toast';

type AccountLinkCardProps = {
  memberId: number;
  /** 페이지를 새로 여는 방법. 테스트에서 바꾼다. */
  reloadPage?: () => void;
};

/**
 * 제공자 버튼은 각 사의 로그인 버튼 규칙을 따른다.
 * - 카카오: 완성형 문구 "카카오 로그인"과 말풍선 심볼(https://developers.kakao.com/docs/ko/kakaologin/design-guide)
 * - Apple: "Sign in with Apple"의 한국어 문구와 Apple 로고(https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple)
 */
const PROVIDER_BUTTON_LABELS: Record<OAuthProvider, string> = { KAKAO: '카카오 로그인', APPLE: 'Apple로 로그인' };

type Status = 'idle' | 'working';

const UNKNOWN_RESULT_NOTICE: OAuthNotice = {
  tone: 'error',
  title: '계정 인증 결과를 확인하지 못했어요',
  description: '네트워크를 확인한 뒤 화면을 새로 고쳐 주세요.',
};

const LOGOUT_FAILED_NOTICE: OAuthNotice = {
  tone: 'error',
  title: '로그아웃하지 못했어요',
  description: '지금 계정과 기록은 그대로예요. 잠시 후 다시 시도해 주세요.',
};

/** 복귀 화면이 넘긴 결과 안내. 다른 화면 상태가 섞여 있어도 형식이 맞을 때만 쓴다. */
export const readOAuthNoticeFromState = (state: unknown): OAuthNotice | null => {
  if (typeof state !== 'object' || state === null || !('oauthNotice' in state)) return null;
  const notice = (state as { oauthNotice: unknown }).oauthNotice;
  if (typeof notice !== 'object' || notice === null) return null;
  const { title, description, tone } = notice as Record<string, unknown>;
  return typeof title === 'string' && typeof description === 'string' && (tone === 'success' || tone === 'error')
    ? { title, description, tone }
    : null;
};

/**
 * 계정 연결. 익명으로 쓰다가 필요할 때 카카오나 Apple 계정을 연결해 기록을 보관하고 다른 기기에서 이어 쓴다.
 * 연결한 회원에게는 연결한 계정과 로그아웃만 보여 준다. 다른 계정을 쓰려면 로그아웃해 새 익명 회원이 된 뒤 연결한다.
 * 버튼을 누르면 확인 창 없이 바로 연결이나 로그아웃을 시작한다. 취소나 실패는 지금 회원을 그대로 둔다.
 * 연결 상태는 아직 서버가 알려 주지 않아, 이 기기에서 인증을 마쳤을 때 기억한 값으로 보여 준다.
 * 브라우저는 제공자 화면으로 떠났다가 복귀 화면으로 돌아오고, 앱 WebView는 네이티브 로그인 브리지로 이 화면에서 마친다.
 */
const AccountLinkCard = ({ memberId, reloadPage = () => window.location.reload() }: AccountLinkCardProps) => {
  const config = usePublicConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  // 네이티브 흐름은 이 화면에서 연결을 마치므로, 같은 회원에 연결했을 때도 다시 읽도록 횟수를 둔다.
  const [linkRevision, setLinkRevision] = useState(0);
  const linkedProvider = useMemo(() => readLinkedProvider(memberId), [memberId, linkRevision]);
  const [status, setStatus] = useState<Status>('idle');
  const [notice, setNotice] = useState<OAuthNotice | null>(
    () => readOAuthNoticeFromState(location.state) ?? takeStashedOAuthNotice(),
  );

  /*
   * 제공자 화면에서 취소하거나 콜백이 실패하면 #570은 JSON 오류로 끝나 사용자가 뒤로 가기로 돌아온다.
   * 마이를 다시 볼 때 쓰지 않은 시작 정보가 남아 있으면 연결을 마치지 못했다고 알린다.
   * 뒤로 가기가 페이지를 메모리에서 되살리면(bfcache) 떠나기 직전의 진행 중 버튼도 되돌린다.
   */
  useEffect(() => {
    if (!isOAuthLinkAvailable()) return undefined;
    const showUnfinished = () => {
      void detectUnfinishedOAuthLink(() => readPropertyCount(config, queryClient)).then((unfinished) => {
        if (unfinished !== null) setNotice(unfinished);
      });
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setStatus('idle');
      showUnfinished();
    };
    showUnfinished();
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [config, queryClient]);

  const providers = getAvailableOAuthProviders();

  const closeNotice = () => {
    setNotice(null);
    // 새로 고침이나 뒤로 가기로 같은 안내가 다시 뜨지 않게 기록의 상태를 지운다.
    if (readOAuthNoticeFromState(location.state) !== null) {
      void navigate(location.pathname, { replace: true, state: null });
    }
  };

  const toast = (
    <Toast
      className={styles.toast}
      isOpen={notice !== null}
      title={notice?.title ?? ''}
      description={notice?.description}
      onClose={closeNotice}
    />
  );

  /*
   * 앱 WebView는 네이티브 로그인 브리지와 제공자 키가 있는 앱에서만 계정 연결과 로그아웃을 보여 준다.
   * 서버에 API가 없다고 방금 확인해 숨길 때도 그 안내는 보여 준다.
   */
  if (providers.length === 0) return notice === null ? null : toast;

  const linkInApp = async (provider: OAuthProvider) => {
    setStatus('working');
    const result = await startNativeOAuthLink({
      config,
      provider,
      memberId,
      countProperties: () => readPropertyCount(config, queryClient),
    }).catch(() => UNKNOWN_RESULT_NOTICE);
    const currentMemberId = getAuthenticationSnapshot().session?.memberId ?? null;
    if (currentMemberId !== null && currentMemberId !== memberId) {
      // 이미 이 계정으로 쓰던 회원으로 바뀌었다. 화면에 붙어 있던 조회는 이전 회원을 계속 보므로,
      // 브라우저 흐름처럼 페이지를 새로 열어 새 회원으로 다시 그리고 결과 안내는 새 화면이 보여 준다.
      stashOAuthNotice(result);
      reloadPage();
      return;
    }
    setStatus('idle');
    setLinkRevision((current) => current + 1);
    setNotice(result);
  };

  const linkInBrowser = async (provider: OAuthProvider) => {
    setStatus('working');
    const result = await startOAuthLink({
      config,
      provider,
      memberId,
      countProperties: () => readPropertyCount(config, queryClient),
    });
    // 제공자 화면으로 떠나는 중에는 버튼을 진행 상태로 둔다.
    if (result.kind === 'left-page') return;
    setStatus('idle');
    setNotice(result.notice);
  };

  const logout = async () => {
    if (status === 'working') return;
    setStatus('working');
    try {
      await logoutAuthentication(config);
    } catch {
      setStatus('idle');
      setNotice(LOGOUT_FAILED_NOTICE);
      return;
    }
    // 새 익명 회원으로 바뀌었다. 회원과 무관해 보이는 캐시까지 남기지 않는다.
    queryClient.clear();
    void navigate(HOME_PATH, { replace: true });
  };

  const link = (provider: OAuthProvider) => {
    if (status === 'working') return;
    void (usesNativeOAuth() ? linkInApp : linkInBrowser)(provider);
  };

  const linkedLabel = linkedProvider === null ? null : OAUTH_PROVIDER_LABELS[linkedProvider];

  return (
    <section className={styles.card} aria-labelledby="account-link-title">
      <div className={styles.header}>
        <span className={styles.icon}>
          <Icon name="user" size={16} />
        </span>
        <div>
          <h2 id="account-link-title" className={styles.title}>
            {linkedLabel === null ? '계정 연결' : `${linkedLabel} 계정 연결됨`}
          </h2>
          <p className={styles.description}>
            {linkedLabel === null
              ? '다른 기기에서도 방 기록을 이어서 볼 수 있어요.'
              : '다른 계정을 쓰려면 로그아웃한 뒤 연결해 주세요.'}
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        {linkedLabel === null &&
          providers.map((provider) => (
            <button
              key={provider}
              type="button"
              className={`${styles.providerButton} ${provider === 'KAKAO' ? styles.kakao : styles.apple}`}
              disabled={status === 'working'}
              aria-busy={status === 'working'}
              onClick={() => link(provider)}
            >
              {provider === 'KAKAO' ? (
                <img className={styles.kakaoSymbol} src={kakaoSymbol} alt="" aria-hidden="true" />
              ) : (
                <img className={styles.appleLogo} src={appleLogo} alt="" aria-hidden="true" />
              )}
              {PROVIDER_BUTTON_LABELS[provider]}
            </button>
          ))}
        {linkedLabel !== null && (
          <button
            type="button"
            className={styles.logoutButton}
            disabled={status === 'working'}
            aria-busy={status === 'working'}
            onClick={() => void logout()}
          >
            로그아웃
          </button>
        )}
      </div>

      {toast}
    </section>
  );
};

const styles = {
  card: css`
    label: AccountLinkCard-card;
    display: grid;
    gap: 0.55rem;
    padding: var(--my-card-padding);
    border-radius: var(--radius-md);
    background: var(--my-card-surface, var(--color-card-surface));
    color: var(--color-ink);
  `,

  header: css`
    label: AccountLinkCard-header;
    display: grid;
    grid-template-columns: 1.25rem minmax(0, 1fr);
    gap: 0.45rem;
    align-items: start;
  `,

  icon: css`
    label: AccountLinkCard-icon;
    display: grid;
    place-items: center;
    height: 1.4rem;
  `,

  title: css`
    label: AccountLinkCard-title;
    margin: 0;
    font-size: var(--my-text-size, 0.95rem);
    letter-spacing: -0.02em;
  `,

  description: css`
    label: AccountLinkCard-description;
    margin: 0.15rem 0 0;
    color: var(--color-ink-soft);
    font-size: var(--my-subtext-size, 0.78rem);
    line-height: 1.35;
    word-break: keep-all;
  `,

  actions: css`
    label: AccountLinkCard-actions;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
    gap: 0.4rem;
  `,

  /*
   * 두 버튼은 높이 44px, 모서리 12px(카카오 규정), 같은 글자 크기로 맞춘다.
   * 글자 세로 길이는 카카오 규정(버튼 높이의 1/3 이하)과 Apple 웹 공식 한국어 버튼의 비율에 맞춘 15px다.
   * Apple 최소 크기(140x30)를 넘고, 로고와 문구를 가운데에 함께 둔다(카카오가 허용하는 가운데 정렬).
   */
  providerButton: css`
    label: AccountLinkCard-providerButton;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 2.75rem;
    padding: 0 0.4rem;
    border: 0;
    border-radius: 12px;
    font: inherit;
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
  `,

  kakao: css`
    label: AccountLinkCard-kakao;
    background: #fee500;
    color: rgb(0 0 0 / 85%);
  `,

  /* Apple은 밝은 바탕에 검정 버튼을 쓴다. 이 서비스는 다크 모드가 없어 카드가 늘 밝으므로 흰 버튼은 두지 않는다. */
  apple: css`
    label: AccountLinkCard-apple;
    background: #000000;
    color: #ffffff;
  `,

  /* 카카오 심볼은 모양, 비율, 색을 바꾸지 않는다. */
  kakaoSymbol: css`
    label: AccountLinkCard-kakaoSymbol;
    width: 1.125rem;
    height: 1.125rem;
  `,

  /* Apple 로고 파일은 위아래 여백을 품고 있어 버튼 높이에 맞춘다. 여백을 잘라 내지 않는다. */
  appleLogo: css`
    label: AccountLinkCard-appleLogo;
    height: 100%;
    margin-right: -0.25rem;
    margin-left: -0.25rem;
  `,

  logoutButton: css`
    label: AccountLinkCard-logoutButton;
    justify-self: start;
    padding: 0.25rem 0.35rem;
    border: 0;
    background: none;
    color: var(--color-muted);
    font: inherit;
    font-size: var(--my-subtext-size, 0.78rem);
    text-decoration: underline;
    text-underline-offset: 0.2em;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }
  `,

  /* 마이 화면은 스크롤되므로 화면 아래에 고정하고, 앱 탭바와 하단 메뉴 위에 띄운다. 등장 애니메이션이 transform을 쓰므로 가운데 정렬은 margin으로 한다. */
  toast: css`
    label: AccountLinkCard-toast;
    position: fixed;
    bottom: calc(5.5rem + var(--native-tab-bar-height, 0px) + env(safe-area-inset-bottom));
    max-width: 26rem;
    margin-right: auto;
    margin-left: auto;
  `,
};

export default AccountLinkCard;
