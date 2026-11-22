// 두 스크린샷(또는 같은 이름의 파일이 든 두 폴더)을 픽셀로 비교하고 전, 후, 차이를 나란히 붙인 그림을 만든다.
// 사용:
//   node .claude/skills/verify-jachwi/scripts/compare.mjs <전.png|전 폴더> <후.png|후 폴더> <출력 폴더>
// 출력: <출력 폴더>/<이름>.side.png(왼쪽 전, 가운데 후, 오른쪽 다른 픽셀을 빨갛게), <출력 폴더>/compare.md(다른 픽셀 비율 표)
// 다른 픽셀: 어느 색 채널이든 차이가 24를 넘는 픽셀. 글꼴 안티에일리어싱 정도의 차이는 넘기지 않는다.
// 크기가 다르면 다른 픽셀 비율을 계산하지 않고 "크기 다름"으로 적는다(레이아웃이 바뀐 것이다).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [beforeArg, afterArg, outArg] = process.argv.slice(2);
if (!beforeArg || !afterArg || !outArg) throw new Error('사용: compare.mjs <전> <후> <출력 폴더>');
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(join(repoRoot, 'qa/package.json'));
const { chromium } = (await import(pathToFileURL(require.resolve('@playwright/test')).href)).default;

const pairs = statSync(beforeArg).isDirectory()
  ? readdirSync(beforeArg)
      .filter((name) => name.endsWith('.png') && existsSync(join(afterArg, name)))
      .sort()
      .map((name) => [join(beforeArg, name), join(afterArg, name), name.replace(/\.png$/, '')])
  : [[beforeArg, afterArg, basename(beforeArg).replace(/\.png$/, '')]];
const out = resolve(outArg);
mkdirSync(out, { recursive: true });

const diffInPage = async ({ before, after }) => {
  const load = (src) =>
    new Promise((done) => {
      const image = new Image();
      image.onload = () => done(image);
      image.src = src;
    });
  const [a, b] = await Promise.all([load(before), load(after)]);
  const sameSize = a.width === b.width && a.height === b.height;
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const pixels = (image) => {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, width, height);
  };
  const pa = pixels(a);
  const pb = pixels(b);
  const diff = new ImageData(width, height);
  let changed = 0;
  for (let i = 0; i < pa.data.length; i += 4) {
    const different =
      Math.abs(pa.data[i] - pb.data[i]) > 24 ||
      Math.abs(pa.data[i + 1] - pb.data[i + 1]) > 24 ||
      Math.abs(pa.data[i + 2] - pb.data[i + 2]) > 24;
    if (different) changed += 1;
    const gray = (pb.data[i] + pb.data[i + 1] + pb.data[i + 2]) / 3;
    diff.data.set(different ? [230, 30, 30, 255] : [gray, gray, gray, 90], i);
  }
  const sheet = document.createElement('canvas');
  const gap = 16;
  sheet.width = width * 3 + gap * 2;
  sheet.height = height + 32;
  const context = sheet.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, sheet.width, sheet.height);
  context.fillStyle = '#111';
  context.font = '20px sans-serif';
  ['전', '후', '다른 픽셀'].forEach((label, index) => context.fillText(label, index * (width + gap) + 4, 22));
  context.drawImage(a, 0, 32);
  context.drawImage(b, width + gap, 32);
  context.putImageData(diff, (width + gap) * 2, 32);
  return { sameSize, ratio: changed / (width * height), png: sheet.toDataURL('image/png') };
};

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage();
const rows = [];
for (const [beforeFile, afterFile, name] of pairs) {
  const asDataUrl = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  const result = await page.evaluate(diffInPage, { before: asDataUrl(beforeFile), after: asDataUrl(afterFile) });
  writeFileSync(join(out, `${name}.side.png`), Buffer.from(result.png.split(',')[1], 'base64'));
  const ratio = result.sameSize ? `${(result.ratio * 100).toFixed(2)}%` : '크기 다름';
  rows.push(`| ${name} | ${ratio} | ${name}.side.png |`);
  console.log(name, ratio);
}
await browser.close();
writeFileSync(
  join(out, 'compare.md'),
  `| 화면 | 다른 픽셀 비율 | 나란히 보기 |\n| --- | --- | --- |\n${rows.join('\n')}\n`,
);
