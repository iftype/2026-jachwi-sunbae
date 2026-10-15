import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const snippet = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

const runSnippet = (origin: string, storage = { getItem: vi.fn(() => null), setItem: vi.fn() }) => {
  if (snippet === undefined) throw new Error('Maze 스니펫을 찾을 수 없습니다.');
  const browser = { location: { origin }, sessionStorage: storage };
  runInNewContext(snippet, { window: browser, document, Date });
  return { browser, storage };
};

describe('Maze 웹사이트 테스트 스니펫', () => {
  afterEach(() => {
    document.head.querySelectorAll('script').forEach((script) => script.remove());
  });

  it('운영 도메인에서 팀 전용 로더를 비동기로 추가한다', () => {
    const { browser, storage } = runSnippet('https://www.jachwi-sunbae.kr');
    const script = document.head.querySelector('script');
    expect(script?.src).toBe(
      'https://snippet.maze.co/maze-universal-loader.js?apiKey=25d1f829-0857-4a92-a8f0-e8fa7bf184e9',
    );
    expect(script?.async).toBe(true);
    expect(browser).toHaveProperty('mazeUniversalSnippetApiKey', '25d1f829-0857-4a92-a8f0-e8fa7bf184e9');
    expect(storage.setItem).toHaveBeenCalledWith('maze-us', expect.any(Number));
  });

  it.each(['https://dev.jachwi-sunbae.kr', 'http://localhost:3000', 'http://www.jachwi-sunbae.kr'])(
    '%s에서는 로드하거나 세션 저장소를 읽지 않는다',
    (origin) => {
      const { browser, storage } = runSnippet(origin);
      expect(document.head.querySelector('script')).toBeNull();
      expect(storage.getItem).not.toHaveBeenCalled();
      expect(browser).not.toHaveProperty('mazeUniversalSnippetApiKey');
    },
  );

  it('세션 저장소 접근이 막혀도 로더를 추가한다', () => {
    const blocked = vi.fn(() => {
      throw new Error('Storage blocked');
    });
    expect(() => runSnippet('https://www.jachwi-sunbae.kr', { getItem: blocked, setItem: blocked })).not.toThrow();
    expect(document.head.querySelector('script')?.async).toBe(true);
  });

  it('현재 스크립트의 nonce를 로더에도 전달한다', () => {
    const currentScript = document.createElement('script');
    currentScript.nonce = 'test-nonce';
    document.head.appendChild(currentScript);
    runSnippet('https://www.jachwi-sunbae.kr');
    expect(document.head.querySelectorAll('script')[1]?.nonce).toBe('test-nonce');
  });
});
