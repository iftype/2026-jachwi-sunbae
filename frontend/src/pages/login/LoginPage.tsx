import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import guideGoose from '@/pages/design-home/assets/guide-goose.webp';
import { ApiError, getSafeApiErrorMessage } from '@/features/auth/api/apiClient';
import { submitNicknameLogin } from '@/features/auth/api/authApi';
import { setAuthentication } from '@/features/auth/model/authStore';
import { useAuthentication } from '@/features/auth/model/useAuthentication';
import { trackExplorationLogin } from '@/features/onboarding/lib/explorationJourney';
import logo from '@/shared/assets/jachwi-sunbae-goose.webp';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';
import { Button } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';
import InlineNotice from '@/shared/ui/inline-notice/InlineNotice';
import TextField from '@/shared/ui/text-field/TextField';

import styles from './LoginPage.module.css';

type LoginField = 'nickname' | 'password';
type LoginErrors = Partial<Record<LoginField, string>>;

/** 닉네임 형식 오류만 닉네임 칸 아래에, 나머지 오류는 입력 맨 아래인 비밀번호 칸 아래에 보여 준다. */
const getLoginErrorField = (error: unknown): LoginField =>
  error instanceof ApiError && error.code === 'NICKNAME_INVALID' ? 'nickname' : 'password';

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
  const [errors, setErrors] = useState<LoginErrors>({});
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
      setErrors({ nickname: '이름 또는 닉네임을 입력해 주세요.' });
      return;
    }
    if (password.length > 0 && password.length < 4) {
      setErrors({ password: '비밀번호는 사용하려면 4자 이상 입력해 주세요.' });
      return;
    }

    isStartingRef.current = true;
    setIsStarting(true);
    setErrors({});
    trackPostHogEvent('login_started', { login_method: 'nickname' });

    try {
      const response = await submitNicknameLogin(config, {
        nickname: trimmedNickname,
        password: password.length === 0 ? undefined : password,
      });
      setAuthentication(response);
      trackPostHogEvent('login_succeeded', { new_member: response.newMember });
      trackExplorationLogin(response.newMember);
      navigate('/', { replace: true });
    } catch (error) {
      isStartingRef.current = false;
      setIsStarting(false);
      setErrors({ [getLoginErrorField(error)]: getLoginErrorMessage(error) });
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
      <div className={styles.layout}>
        <header className={styles.topBar}>
          <img className={styles.logo} src={logo} width={160} height={160} alt="자취선배" />
        </header>
        {/* 안내 카드와 입력을 한 열로 묶어 화면 가운데에 둔다. */}
        <div className={styles.content}>
          {/* 카드형 홈의 대표 카드처럼 노란 카드에 시작 안내를 크게 두고, 오리가 카드 아래에서 고개를 내민다. */}
          <section className={styles.intro} aria-labelledby="login-heading">
            <h1 id="login-heading" className={styles.introTitle}>
              자취선배 시작하기
            </h1>
            <p className={styles.introDescription}>이름이나 닉네임만 있으면 본 방 기록을 바로 시작해요.</p>
            <img className={styles.introGoose} src={guideGoose} width={200} height={294} alt="" aria-hidden="true" />
          </section>

          <form className={styles.form} aria-label="닉네임으로 시작하기" onSubmit={handleLogin}>
            {authenticationNotice !== null && <InlineNotice>{authenticationNotice}</InlineNotice>}
            {/* 아이디·비밀번호 칸은 라벨 없이 붙여 한 덩어리로 보여 준다. 라벨은 화면 낭독기에만 읽힌다. */}
            <div className={styles.credentials}>
              <TextField
                label="이름 또는 닉네임"
                fieldClassName={styles.credential}
                fieldSize="large"
                autoComplete="username"
                maxLength={30}
                value={nickname}
                error={errors.nickname}
                onChange={(event) => {
                  setNickname(event.target.value);
                  setErrors((current) => ({ ...current, nickname: undefined }));
                }}
                placeholder="이름 또는 닉네임"
                disabled={isStarting}
              />
              <TextField
                label="비밀번호"
                fieldClassName={styles.credential}
                fieldSize="large"
                type="password"
                autoComplete="current-password"
                maxLength={64}
                value={password}
                error={errors.password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrors((current) => ({ ...current, password: undefined }));
                }}
                placeholder="비밀번호 (선택)"
                disabled={isStarting}
              />
            </div>
            <div className={styles.footer}>
              <Button
                className={styles.loginButton}
                variant="primary"
                size="large"
                type="submit"
                fullWidth
                isLoading={isStarting}
                loadingLabel="시작하는 중…"
              >
                이름으로 시작하기
              </Button>
            </div>
            <p className={styles.sharedWarning}>
              <Icon name="info" size={16} />
              <span>비밀번호를 비우면 같은 닉네임을 입력한 사람이 기록을 함께 조회하고 수정할 수 있어요.</span>
            </p>
          </form>
        </div>
        <p className={styles.agreement}>
          처음 쓰는 닉네임이면 새 기록 공간을 만들어요.
          <br />
          <Link to="/privacy">개인정보·광고 측정 안내</Link>
        </p>
      </div>
    </main>
  );
};

export default LoginPage;
