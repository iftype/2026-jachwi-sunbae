// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DEV_API_ENV, resolveApiMode } from '../../../.claude/skills/verify-jachwi/scripts/api-mode.mjs';

const scripts = resolve(__dirname, '../../../.claude/skills/verify-jachwi/scripts');
const apiMode = resolve(scripts, 'api-mode.mjs');

// 검증이 dev 서버에 익명 회원과 기록을 남기지 않게 하는 규칙이다. dev API 모드는 옵션과 환경 변수가 둘 다 있을 때만 켜진다.
describe('검증 API 모드', () => {
  it('옵션이 없으면 mock이다', () => {
    expect(resolveApiMode(undefined, {})).toBe('mock');
    expect(resolveApiMode('mock', {})).toBe('mock');
  });

  it('옵션 없이 환경 변수만 있어도 mock이다', () => {
    expect(resolveApiMode(undefined, { [DEV_API_ENV]: '1' })).toBe('mock');
  });

  it('dev를 요청하면서 환경 변수가 없으면 실패하고 이유를 말한다', () => {
    expect(() => resolveApiMode('dev', {})).toThrow(DEV_API_ENV);
    expect(() => resolveApiMode('dev', { [DEV_API_ENV]: '0' })).toThrow('익명 회원');
  });

  it('옵션과 환경 변수가 둘 다 있을 때만 dev다', () => {
    expect(resolveApiMode('dev', { [DEV_API_ENV]: '1' })).toBe('dev');
  });

  it('알 수 없는 모드는 실패한다', () => {
    expect(() => resolveApiMode('prod', { [DEV_API_ENV]: '1' })).toThrow('알 수 없는');
  });

  it('스크립트 진입점도 같다: dev 요청이 옵션만이면 종료 코드 1, 옵션 없으면 mock', () => {
    const env = { ...process.env, [DEV_API_ENV]: '' };
    const denied = spawnSync('node', [apiMode, '--api', 'dev'], { env, encoding: 'utf8' });

    expect(denied.status).toBe(1);
    expect(denied.stderr).toContain('FAIL');
    expect(execFileSync('node', [apiMode], { env, encoding: 'utf8' }).trim()).toBe('mock');
    expect(
      execFileSync('node', [apiMode, '--api', 'dev'], { env: { ...env, [DEV_API_ENV]: '1' }, encoding: 'utf8' }).trim(),
    ).toBe('dev');
  });

  it('launch, doctor, serve는 dev 요청이 옵션만이면 서버를 띄우기 전에 실패한다', () => {
    const env = { ...process.env, [DEV_API_ENV]: '' };
    const commands: [string, string[]][] = [
      ['bash', [resolve(scripts, 'launch.sh'), '3999', '--api', 'dev']],
      ['bash', [resolve(scripts, 'doctor.sh'), '3999', '--api', 'dev']],
      ['node', [resolve(scripts, 'serve.mjs'), '--dist', '/nonexistent', '--api', 'dev']],
    ];

    for (const [command, args] of commands) {
      const result = spawnSync(command, args, { env, encoding: 'utf8', timeout: 20_000 });

      expect(result.status, args[0]).not.toBe(0);
      expect(result.stderr, args[0]).toContain(DEV_API_ENV);
    }
  });
});
