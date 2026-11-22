// 네이버 지도 키가 없는 곳(CI)에서 지도 SDK 자리에 띄우는 목 서버다. SDK 내부는 건드리지 않고, 앱이 부르는 주소와 응답 무게만 흉내 낸다.
// 사용: node .claude/skills/verify-jachwi/scripts/map-sdk-stub.mjs --port 4443
//   브라우저는 measure.mjs --map-sdk stub 이 oapi.map.naver.com 을 이 서버로 돌린다(host-resolver-rules, 자체 서명 인증서).
// - maps.js: 실제 SDK의 전송 크기만큼 주석으로 채운 뒤, 실제 SDK처럼 maps-gl.js 를 붙이고 다 받으면 callback 을 부른다.
// - maps-gl.js: 실제 전송 크기만큼 주석.
// - naver.maps 는 만들지 않는다. 앱은 "SDK를 불러오지 못했다" 경로로 가고 지도는 뜨지 않는다. 그래서 CI 판정은 지도와 무관한 순간만 잰다.
// 크기는 2026-11-23에 잰 실제 전송 크기(gzip)다. 회선 제한에서 SDK가 다른 요청과 대역폭을 나누는 모양을 남기려는 것이다.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

export const MAP_SDK_HOST = 'oapi.map.naver.com';
const SIZES = { 'maps.js': 91634, 'maps-gl.js': 275899 };

const { values: args } = parseArgs({ options: { port: { type: 'string', default: '4443' } } });

const dir = mkdtempSync(join(tmpdir(), 'map-sdk-stub-'));
execFileSync(
  'openssl',
  [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '2',
    '-subj',
    `/CN=${MAP_SDK_HOST}`,
    '-keyout',
    'privkey.pem',
    '-out',
    'cert.pem',
  ],
  { cwd: dir, stdio: 'ignore' },
);

const pad = (body, size) => `${body}\n/*${'x'.repeat(Math.max(0, size - body.length - 6))}*/\n`;

const mapsJs = (callback) =>
  pad(
    `(function(){var s=document.createElement('script');s.src='https://${MAP_SDK_HOST}/openapi/v3/maps-gl.js';` +
      `s.onload=s.onerror=function(){var f=window[${JSON.stringify(callback)}];if(typeof f==='function')f();};` +
      `document.head.appendChild(s);})();`,
    SIZES['maps.js'],
  );

createServer({ key: readFileSync(join(dir, 'privkey.pem')), cert: readFileSync(join(dir, 'cert.pem')) }, (req, res) => {
  const url = new URL(req.url ?? '/', `https://${MAP_SDK_HOST}`);
  const name = url.pathname.split('/').pop();
  if (!(name in SIZES)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const body = name === 'maps.js' ? mapsJs(url.searchParams.get('callback') ?? '') : pad('', SIZES[name]);
  res.writeHead(200, {
    'content-type': 'text/javascript',
    'access-control-allow-origin': '*',
    'cache-control': 'max-age=86400',
  });
  res.end(body);
}).listen(Number(args.port), () => console.log(`map sdk stub https://localhost:${args.port} -> ${MAP_SDK_HOST}`));
