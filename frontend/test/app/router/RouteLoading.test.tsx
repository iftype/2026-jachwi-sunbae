import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import BootSkeleton from '@/app/router/BootSkeleton';
import RouteLoading from '@/app/router/RouteLoading';

it('페이지 전체를 바꾸는 로딩은 늦추지 않고 바로 진행 표시를 보여 준다', () => {
  render(<RouteLoading />);
  const loading = screen.getByRole('progressbar').parentElement as HTMLElement;
  const style = getComputedStyle(loading);
  expect(style.opacity).not.toBe('0');
  expect(style.animation).toBe('');
});

it('홈 뼈대는 index.html의 앱 뼈대와 마크업이 같아, JS를 받기 전부터 React가 그린 뒤까지 모양이 그대로다', () => {
  const html = readFileSync(resolve(__dirname, '../../../index.html'), 'utf8');
  // 포맷터가 넣은 태그 사이 줄바꿈은 화면에 영향이 없으므로 지우고 비교한다.
  const bootSkeleton = html
    .match(/<div id="root">([\s\S]*?)<\/div>\s*<script>/)?.[1]
    .trim()
    .replace(/>\s+</g, '><');
  expect(bootSkeleton).toBeDefined();
  expect(renderToStaticMarkup(<BootSkeleton />)).toBe(bootSkeleton);
});
