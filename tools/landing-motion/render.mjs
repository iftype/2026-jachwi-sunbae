// flyover.html의 window.__seek(t)로 프레임을 하나씩 그려 스크린샷을 찍고 ffmpeg로 MP4를 만든다.
// 타이머 대신 시간을 직접 지정하므로 컴퓨터 성능과 관계없이 매번 같은 영상이 나온다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ffmpegPath from 'ffmpeg-static';
import { chromium } from 'playwright';

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};

const pageFile = option('page', 'flyover.html');
const out = path.resolve(dir, option('out', 'out/flyover.mp4'));
const fps = Number(option('fps', 60));
const scale = Number(option('scale', 1));
const shots = option('shots');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.mkdirSync(path.join(dir, 'out'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1152 }, deviceScaleFactor: scale });
page.on('pageerror', (error) => console.error('pageerror:', error.message));
await page.goto(pathToFileURL(path.join(dir, pageFile)).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
const total = await page.evaluate(() => window.__total);
const stage = await page.$('#vp');

if (shots) {
  for (const t of shots.split(',')) {
    await page.evaluate((time) => window.__seek(time), Number(t));
    const file = path.join(dir, 'out', `shot-${t}.png`);
    await stage.screenshot({ path: file });
    console.log(file);
  }
} else {
  const ffmpeg = spawn(
    ffmpegPath,
    ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  const frames = Math.round(total * fps);
  const startedAt = Date.now();
  for (let i = 0; i < frames; i++) {
    await page.evaluate((time) => window.__seek(time), i / fps);
    const buffer = await stage.screenshot({ type: 'png' });
    if (!ffmpeg.stdin.write(buffer)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
    if (i % 120 === 0) console.log(`frame ${i}/${frames} · ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);
  }
  ffmpeg.stdin.end();
  await new Promise((resolve) => ffmpeg.on('close', resolve));
  console.log(out);
}

await browser.close();
