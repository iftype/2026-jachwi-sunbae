import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

//QA가 접속할 주소를 결정하고, 등록된 운영 도메인에서는 실행을 막는 환경 설정 파일
const ENV_FILE = resolve(__dirname, '../.env');
const DEFAULT_BASE_URL = 'https://dev.jachwi-sunbae.kr';

// qa/README.md: 운영 데이터에 테스트 회원과 매물이 생기지 않도록 운영에서는 QA를 실행하지 않는다.
const PRODUCTION_HOSTS = new Set(['jachwi-sunbae.kr', 'www.jachwi-sunbae.kr']);

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const resolveBaseUrl = (): string => {
  const configuredUrl = process.env.QA_BASE_URL?.trim();
  const baseUrl = (configuredUrl ? configuredUrl : DEFAULT_BASE_URL).replace(/\/+$/, '');
  if (PRODUCTION_HOSTS.has(new URL(baseUrl).hostname)) {
    throw new Error(`운영 환경(${baseUrl})에서는 QA를 실행하지 않습니다. QA_BASE_URL을 확인하세요.`);
  }
  return baseUrl;
};

export const qaConfig = {
  baseUrl: resolveBaseUrl(),
} as const;
