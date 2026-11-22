// 검증이 쓰는 API 모드를 정한다. 기본은 mock이다. dev(실제 dev 서버로 중계)는 dev 서버에 익명 회원과 기록을 남기므로
// 옵션 `--api dev`와 환경 변수 `VERIFY_ALLOW_DEV_API=1`이 둘 다 있을 때만 켠다. 하나라도 없으면 이유를 말하고 실패한다.
// 셸에서: node api-mode.mjs [--api mock|dev]  (성공하면 모드를 출력하고, 실패하면 이유를 stderr에 쓰고 1로 끝난다)
import { fileURLToPath } from 'node:url';

export const DEV_API_ENV = 'VERIFY_ALLOW_DEV_API';

export const resolveApiMode = (requested, env = process.env) => {
  const mode = requested ?? 'mock';
  if (mode === 'mock') return 'mock';
  if (mode !== 'dev') throw new Error(`알 수 없는 API 모드 "${mode}". mock 또는 dev만 쓴다.`);
  if (env[DEV_API_ENV] !== '1') {
    throw new Error(
      `dev API 모드는 dev 서버에 익명 회원과 기록을 남긴다. 실제 서버 동작을 꼭 봐야 할 때만 --api dev 와 ${DEV_API_ENV}=1 을 함께 준다. 기능 검증은 기본인 mock으로 한다.`,
    );
  }
  return 'dev';
};

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const index = process.argv.indexOf('--api');
  try {
    console.log(resolveApiMode(index === -1 ? undefined : process.argv[index + 1]));
  } catch (error) {
    console.error(`FAIL ${error.message}`);
    process.exit(1);
  }
}
