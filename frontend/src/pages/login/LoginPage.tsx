import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError, getSafeApiErrorMessage } from '@/features/auth/api/apiClient';
import { submitNicknameLogin } from '@/features/auth/api/authApi';
import { setAuthentication } from '@/features/auth/model/authStore';
import { useAuthentication } from '@/features/auth/model/useAuthentication';
import { trackExplorationLogin } from '@/features/onboarding/lib/explorationJourney';
import logo from '@/shared/assets/jachwi-sunbae-logo-lockup-v3.svg';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';
import { Button } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';
import TextField from '@/shared/ui/text-field/TextField';

import styles from './LoginPage.module.css';

const getLoginErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.code === 'NICKNAME_AUTHENTICATION_FAILED') {
      return '닉네임 또는 비밀번호가 맞지 않아요.';
    }
    if (error.code === 'NICKNAME_PASSWORD_UNEXPECTED') {
      return '이미 비밀번호 없이 사용하는 닉네임이에요. 비밀번호를 비우고 다시 시작해 주세요.';
    }
    if (error.code === 'NICKNAME_AUTH_RATE_LIMITED') {
      return '비밀번호를 여러 번 확인하지 못했어요. 10분 뒤 다시 시도해 주세요.';
    }
    if (error.code === 'NICKNAME_INVALID') {
      return '닉네임은 1자 이상 30자 이하로 입력해 주세요.';
    }
    if (error.code === 'NICKNAME_PASSWORD_INVALID') {
      return '비밀번호는 4자 이상 64자 이하로 입력해 주세요.';
    }
  }
  return getSafeApiErrorMessage(error);
};

const LoginPage = () => {
  const config = usePublicConfig();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const isStartingRef = useRef(false);
  const { terminationReason } = useAuthentication();
  const navigate = useNavigate();

  useEffect(() => {
    trackPostHogEvent('login_page_viewed');
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isStartingRef.current) return;

    const trimmedNickname = nickname.trim();
    if (trimmedNickname.length === 0) {
      setStartError('이름 또는 닉네임을 입력해 주세요.');
      return;
    }
    if (password.length > 0 && password.length < 4) {
      setStartError('비밀번호는 사용하려면 4자 이상 입력해 주세요.');
      return;
    }

    isStartingRef.current = true;
    setIsStarting(true);
    setStartError(null);
    trackPostHogEvent('login_started', { login_method: 'nickname' });

    try {
      const response = await submitNicknameLogin(config, {
        nickname: trimmedNickname,
        password: password.length === 0 ? undefined : password,
      });
      setAuthentication(response);
      trackPostHogEvent('login_succeeded', { new_member: response.newMember });
      trackExplorationLogin(response.newMember);
      navigate('/properties', { replace: true });
    } catch (error) {
      isStartingRef.current = false;
      setIsStarting(false);
      setStartError(getLoginErrorMessage(error));
      trackPostHogEvent('login_failed', {
        login_method: 'nickname',
        error_kind: error instanceof ApiError ? error.kind : 'unknown',
        error_code: error instanceof ApiError ? error.code : null,
      });
    }
  };

  const authenticationNotice =
    terminationReason === 'expired'
      ? '로그인 시간이 지나 다시 시작해야 해요.'
      : terminationReason === 'unauthorized'
        ? '인증을 확인하지 못해 로그아웃됐어요. 다시 시작해 주세요.'
        : null;

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-heading">
        <div className={styles.heroLogo}>
          <img src={logo} alt="자취선배" />
        </div>
        <h1 id="login-heading" className="sr-only">
          자취선배 시작하기
        </h1>

        <form className={styles.actions} aria-label="닉네임으로 시작하기" onSubmit={handleLogin}>
          {authenticationNotice !== null && <InlineNotice>{authenticationNotice}</InlineNotice>}
          {startError !== null && <InlineNotice tone="error">{startError}</InlineNotice>}
          <TextField
            label="이름 또는 닉네임"
            requirement="필수"
            fieldClassName={styles.inlineField}
            autoComplete="username"
            maxLength={30}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="예: 자취초보"
            disabled={isStarting}
          />
          <TextField
            label="비밀번호"
            requirement="선택"
            fieldClassName={styles.inlineField}
            helpText="기록을 보호하려면 4자 이상 입력해 주세요."
            type="password"
            autoComplete="current-password"
            maxLength={64}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호 입력"
            disabled={isStarting}
          />
          <p className={styles.sharedWarning}>
            비밀번호를 비우면 같은 닉네임을 입력한 사람이 기록을 함께 조회하고 수정할 수 있어요.
          </p>
          <Button
            className={styles.loginButton}
            variant="primary"
            type="submit"
            fullWidth
            isLoading={isStarting}
            loadingLabel="시작하는 중…"
          >
            <Icon name="arrow-right" size={16} />
            이름으로 시작하기
          </Button>

          <p className={styles.agreement}>
            처음 쓰는 닉네임이면 새 기록 공간을 만들어요. <Link to="/privacy">개인정보·광고 측정 안내</Link>
          </p>
        </form>
      </section>
    </main>
  );
};

export default LoginPage;
