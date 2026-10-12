import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { analyzeRun } from './ai-analysis';
import { writeReport } from './report';
// qa/.env의 QA_AI_MODEL 등 환경변수를 불러온다.
import './config';

// 테스트를 다시 실행하지 않고 저장된 Run을 다시 분석하고 Run Report를 다시 만든다.
// 사용법: npm run analyze -- runs/F02-S01-261007-094025
//        npm run render -- runs/F02-S01-261007-094025  (AI 분석 없이 Run Report만 다시 만든다)

const main = async (): Promise<void> => {
  const renderOnly = process.argv.includes('--no-ai');
  const runDirs = process.argv.slice(2).filter((arg) => arg !== '--no-ai');
  if (runDirs.length === 0) {
    console.error('분석할 Run 디렉터리를 지정하세요. 예: npm run analyze -- runs/F02-S01-261007-094025');
    process.exit(1);
  }

  for (const runDir of runDirs) {
    const absolute = resolve(process.cwd(), runDir);
    if (!existsSync(resolve(absolute, 'result.json'))) {
      console.error(`${runDir}에 result.json이 없습니다.`);
      process.exitCode = 1;
      continue;
    }
    if (!renderOnly) {
      console.log(`AI 분석 중: ${runDir}`);
      const record = await analyzeRun(absolute);
      console.log(record.status === 'COMPLETED' ? '  AI 분석 완료' : `  AI 분석 실패: ${record.error}`);
    }
    console.log(`  Run Report: ${writeReport(absolute)}`);
  }
};

void main();
