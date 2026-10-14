const fs = require('fs');
const path = require('path');

const packageVersion = require('../package.json').version;
const DEFAULT_DEV_SERVER_PORT = 3000;

// 로컬 개발용 키는 .env.local에 둔다(저장소에 커밋하지 않는다). 이미 설정된 환경 변수는 유지한다.
const loadLocalEnv = () => {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match === null) continue;
    if (process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
};

const readDevServerPort = () => {
  const port = Number(process.env.PORT);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_DEV_SERVER_PORT;
};

const resolveAppEnvironment = (apiBaseUrl) => {
  try {
    const apiUrl = new URL(apiBaseUrl);
    return apiUrl.protocol === 'https:' && apiUrl.hostname === 'api.jachwi-sunbae.kr' ? 'production' : 'development';
  } catch {
    return 'development';
  }
};

const readBuildEnvironment = ({ isProduction, proxyTarget }) => {
  loadLocalEnv();

  const isMockingEnabled = process.env.ENABLE_MSW === 'true';
  const devServerPort = readDevServerPort();
  const apiBaseUrl = proxyTarget
    ? `http://localhost:${devServerPort}`
    : (process.env.API_BASE_URL ?? 'http://localhost:8080');
  const naverMapClientId = process.env.NAVER_MAP_CLIENT_ID ?? '';

  return {
    apiBaseUrl,
    appEnvironment: resolveAppEnvironment(apiBaseUrl),
    appVersion: process.env.APP_VERSION ?? packageVersion,
    devServerPort,
    isMockingEnabled,
    commuteDataSource: isMockingEnabled && process.env.USE_REAL_COMMUTE_API !== 'true' ? 'mock' : 'server',
    boundaryBaseUrl: process.env.ADMIN_BOUNDARY_BASE_URL ?? '/boundaries',
    mapProviderMode: isProduction
      ? 'naver'
      : (process.env.MAP_PROVIDER_MODE ?? (naverMapClientId === '' ? 'demo' : 'naver')),
    naverMapClientId,
    posthogHost: process.env.POSTHOG_HOST ?? '',
    posthogProjectToken: process.env.POSTHOG_PROJECT_TOKEN ?? '',
  };
};

module.exports = { loadLocalEnv, readBuildEnvironment };
