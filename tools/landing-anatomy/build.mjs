// 자취선배 랜딩 이야기를 anatomy 스타일의 등각 기계 그림 한 장으로 만든다.
// 실행: node tools/landing-anatomy/build.mjs [--audit]
// anatomy 스킬 위치는 ANATOMY_HOME(기본 ~/.claude/skills/anatomy)에서 찾는다.
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ANATOMY = process.env.ANATOMY_HOME ?? join(homedir(), ".claude", "skills", "anatomy");
const load = (rel) => import(pathToFileURL(join(ANATOMY, rel)).href);
const k = await load("kit/iso-kit.mjs");
const A = await load("kit/audit.mjs");
const { kitScript } = await load("scripts/inline-kit.mjs");

const WIDTH = 600;
const HEIGHT = 350;

// ---------- 세계 배치 (단위는 대략 화면 1px) ----------
const PITCH = 22;
const TILE = 18;
const FX = -128; // 동네 판 안쪽 왼쪽
const FY = -70; // 동네 판 안쪽 뒤쪽
const FW = 3 + M.COLS * PITCH - 4 + 3;
const FD = 3 + M.ROWS * PITCH - 4 + 3;
const RIM = 7;
const FLOOR_H = 2;
const RIM_TOP = 9;
const TILE_H = 4;
const LIFT = 3;
const XBAR_Z = 32; // 가로 노선 막대 바닥
const BAR_T = 2.4; // 막대 두께
const YBAR_Z = XBAR_Z + BAR_T; // 세로 노선 막대는 가로 막대 위에 얹힌다

const PLATE = { x: -142, y: -84, w: 320, d: 162, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

const DIAL = { x: 88, y: -46, r: 30, knob: 17 };
const RACK = { x: 132, y: -74, w: 34, d: 62, r: 2 };
const RACK_H = 6;
const CARD = { w: 26, d: 2, h: 22 };
const SLOT_Y = (i) => RACK.y + 7 + i * 11.5;
const SWITCH = { x: 54, y: -2, w: 44, d: 14, r: 2 };
const SW_POS = (t) => SWITCH.x + 10 + t * 12;
const RAIL = { x: 50, y: 30, w: 116, d: 10, r: 1.5 };
const RENT_POS = (i) => RAIL.x + 10 + i * 16;
const LABEL = { x: 112, y: 52, w: 56, d: 16, r: 1.5 };

const tilePlan = (c, r) => ({ x: FX + 3 + c * PITCH, y: FY + 3 + r * PITCH, w: TILE, d: TILE, r: 1.2 });
const tileCentre = (c, r) => [FX + 3 + c * PITCH + TILE / 2, FY + 3 + r * PITCH + TILE / 2];
const gapX = (g) => FX + 1 + (g + 1) * PITCH; // 열 g와 g+1 사이 틈의 가운데
const gapY = (g) => FY + 1 + (g + 1) * PITCH;
const colName = (c) => "ABCDEFG"[c];
const tileName = (i) => `${colName(i % M.COLS)}${Math.floor(i / M.COLS) + 1}`;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [FX, FY, YBAR_Z + BAR_T + 2], [FX + FW, FY, YBAR_Z + BAR_T + 2], [RACK.x, RACK.y, RACK_H + CARD.h + 2]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 56, elevation: 34 },
);
const V = k.towardViewer(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ---------- 기록기: 모든 부품의 진짜 모양을 남기고, 겹치는 곳의 깊이를 재서 그리는 순서를 정한다 ----------
const R = A.recorder(P);
const put = (name, ref, svg, shapes = [], extra = {}) => R.put({ name, at: ref, bias: 0, svg, shapes, piece: "rig", ...extra });
let solids = 0;
function slab(name, plan, z, h, style = {}, { steps = 4, bevel = 0, inner = "", extra = "", wrap, meta = {} } = {}) {
  solids++;
  const shape = R.solid(A.slab(plan, z, h, { name, ...meta }, steps));
  const svg = S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", inner, ...style }) + extra;
  put(name, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], wrap ? wrap(svg) : svg, [shape]);
  return shape;
}
function cyl(name, cx, cy, r, z, h, style = {}, { steps = 28, bevel = 0, extra = "", meta = {} } = {}) {
  solids++;
  const shape = R.solid(A.cylinder(cx, cy, r, z, h, { name, ...meta }));
  put(name, [cx, cy, z + h / 2], S(k.cylinder(cx, cy, r, z, h, P, steps, bevel), { tone: "mid", ...style }) + extra, [shape]);
  return shape;
}

// ---------- 받침판과 발 ----------
const statics = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
  solids += 2;
  R.solid(A.cylinder(x, y, 7, -PLATE_H - FOOT_H, FOOT_H, { name: "stand.foot", ground: true }));
  statics.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
  statics.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
}
solids++;
R.solid(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate", ground: true }, 8));
statics.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H / 2, P, 8), { tone: "faint" }) }));
statics.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "faint" }));
const plateScrews = k.corners(PLATE, 10);
statics.push(L(plateScrews.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
statics.push(D(plateScrews.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));

// ---------- 동네 판: 바닥, 테두리, 귀퉁이 나사 ----------
const TRAY = { x: FX - RIM, y: FY - RIM, w: FW + RIM * 2, d: FD + RIM * 2, r: 4 };
const screwsAt = (points, z) => L(points.map(([x, y]) => k.ring(x, y, 1.6, z, P, 14)).join(""), { tone: "lo" }) + D(points.map(([x, y]) => at([x, y, z])), { size: 0.45 });
slab("tray.floor", TRAY, 0, FLOOR_H, { tone: "lo" }, { steps: 6, bevel: 0.5 });
slab("tray.rim.back", { x: TRAY.x, y: TRAY.y, w: TRAY.w, d: RIM, r: 1.5 }, FLOOR_H, RIM_TOP - FLOOR_H, {}, { bevel: 0.5, extra: screwsAt(k.corners(TRAY, RIM / 2).filter(([, y]) => y < FY), RIM_TOP) });
slab("tray.rim.front", { x: TRAY.x, y: FY + FD, w: TRAY.w, d: RIM, r: 1.5 }, FLOOR_H, RIM_TOP - FLOOR_H, {}, {
  bevel: 0.5,
  extra: (() => {
    // 앞 테두리 위의 눈금자: 열마다 큰 눈금, 그 사이 작은 눈금
    const edge = FY + FD + 1;
    const t = k.topTicks(FX + 3 + TILE / 2, FX + FW - 3 - TILE / 2, PITCH / 4, 4, edge, RIM_TOP, [1.6, 3], P);
    return L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + screwsAt(k.corners(TRAY, RIM / 2).filter(([, y]) => y > FY), RIM_TOP);
  })(),
});
slab("tray.rim.left", { x: TRAY.x, y: FY, w: RIM, d: FD, r: 0.6 }, FLOOR_H, RIM_TOP - FLOOR_H, {}, { bevel: 0.5 });
slab("tray.rim.right", { x: FX + FW, y: FY, w: RIM, d: FD, r: 0.6 }, FLOOR_H, RIM_TOP - FLOOR_H, {}, {
  bevel: 0.5,
  extra: (() => {
    const edge = FX + FW + RIM - 1;
    const t = k.topTicks(FY + 3 + TILE / 2, FY + FD - 3 - TILE / 2, PITCH / 4, 4, edge, RIM_TOP, [-1.6, -3], P, "y");
    return L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" });
  })(),
});
// ---------- 동네 칸 42개: 칠해지면 3만큼 떠오르고 시간대 색을 띤다 ----------
const TIMES = M.solve();
const RENT = M.rents();
const HOME_I = M.HOME[1] * M.COLS + M.HOME[0];
const lift = k.translateAlong(P, [0, 0, LIFT]).match(/translate\(([-\d.]+) ([-\d.]+)\)/).slice(1).map(Number);
for (let r = 0; r < M.ROWS; r++) {
  for (let c = 0; c < M.COLS; c++) {
    const i = r * M.COLS + c;
    const plan = tilePlan(c, r);
    const [cx, cy] = tileCentre(c, r);
    if (i === HOME_I) {
      // 회사 칸: 칸 위에 빌딩 한 채. 이 그림에서 유일하게 밝게 칠하는 부분이다.
      slab("home.tile", plan, FLOOR_H, TILE_H, { tone: "mid" }, { bevel: 0.5 });
      const tower = { x: cx - 7, y: cy - 7, w: 14, d: 14, r: 0.8 };
      const towerTop = FLOOR_H + TILE_H + 21;
      const windows = [];
      for (const z of [3.5, 7, 10.5, 14, 17.5].map((dz) => FLOOR_H + TILE_H + dz)) windows.push(k.sideSeam(tower, z, P, 2));
      slab("home.tower", tower, FLOOR_H + TILE_H, towerTop - FLOOR_H - TILE_H, { tone: "hi", lit: true, crease: "lo" }, { steps: 2, bevel: 0.4, inner: L(windows.join(""), { tone: "lo" }) });
      const roof = k.insetPlan(tower, 2.5);
      slab("home.roof", roof, towerTop, 1.6, { tone: "hi" }, { steps: 2 });
      cyl("home.mast", cx, cy, 0.7, towerTop + 1.6, 5, { tone: "hi" }, { steps: 10, extra: D([at([cx, cy, towerTop + 6.6])], { size: 0.9, tone: "hi", pulse: true }) });
      continue;
    }
    solids += 2;
    const shape = R.solid(A.slab(plan, FLOOR_H, TILE_H, { name: `tile.${tileName(i)}` }, 4));
    const pinX = cx + 3;
    const pinY = cy - 3;
    const pinShape = R.solid(A.cylinder(pinX, pinY, 0.6, FLOOR_H + TILE_H, 7, { name: `pin.${tileName(i)}` }));
    const inset = L(k.planOutline(k.insetPlan(plan, 2.4), FLOOR_H + TILE_H, P, 4), { tone: "faint", className: "lb-inset" });
    const pin =
      `<g class="lb-pin">` +
      S(k.cylinder(pinX, pinY, 0.6, FLOOR_H + TILE_H, 7, P, 10), { tone: "mid", crease: "none" }) +
      S(k.cylinder(pinX, pinY, 2.2, FLOOR_H + TILE_H + 7, 2.4, P, 18, 0.3), { tone: "hi", className: "lb-pin-head" }) +
      `</g>`;
    const svg = `<g class="lb-tile" data-tile="${i}" data-name="${tileName(i)}">${S(k.slabOf(plan, FLOOR_H, TILE_H, P, 4, 0.5), { tone: "mid", className: "lb-tile-body", inner: "" })}${inset}${pin}</g>`;
    put(`tile.${tileName(i)}`, [cx, cy, FLOOR_H + TILE_H / 2], svg, [shape, pinShape]);
  }
}

// ---------- 노선 막대: 가로 막대 위에 세로 막대가 얹히고, 끝은 기둥 위에 선다 ----------
const POST_R = 1.6;
const stopsOf = (line) => {
  const [a, b] = line.span ?? [0, (line.along === "x" ? M.COLS : M.ROWS) - 1];
  return { a, b };
};
for (const line of M.LINES) {
  const subway = line.kind === "subway";
  const w = subway ? 3.2 : 2.2;
  const { a, b } = stopsOf(line);
  const full = line.along === "x" ? [0, M.COLS - 1] : [0, M.ROWS - 1];
  const z = line.along === "x" ? XBAR_Z : YBAR_Z;
  if (line.along === "x") {
    const y = gapY(line.gap);
    const x0 = a === full[0] ? FX - RIM / 2 : gapX(a - 1);
    const x1 = b === full[1] ? FX + FW + RIM / 2 : gapX(b);
    const plan = { x: x0 - 2.4, y: y - w / 2, w: x1 - x0 + 4.8, d: w, r: 0.6 };
    const stops = [];
    for (let c = a; c <= b; c++) stops.push(at([tileCentre(c, 0)[0], y, z + BAR_T]));
    const groove = subway ? L(k.lineOnTop([plan.x, y], [plan.x + plan.w, y], z + BAR_T, P), { tone: "faint" }) : "";
    for (const [px, base] of [[x0, a === full[0] ? RIM_TOP : FLOOR_H], [x1, b === full[1] ? RIM_TOP : FLOOR_H]]) {
      cyl(`line.${line.id}.post`, px, y, POST_R, base + 1.2, z - base - 1.2, {}, { steps: 16 });
      cyl(`line.${line.id}.foot`, px, y, POST_R + 0.9, base, 1.2, { tone: "lo" }, { steps: 16 });
    }
    slab(`line.${line.id}`, plan, z, BAR_T, { tone: subway ? "hi" : "mid", crease: "lo" }, {
      steps: 2,
      bevel: 0.3,
      extra: groove + D(stops, { size: subway ? 0.55 : 0.45, tone: subway ? "hi" : "mid" }),
      meta: { owner: "transit" },
    });
  } else {
    const x = gapX(line.gap);
    const y0 = a === full[0] ? FY - RIM / 2 : gapY(a - 1);
    const y1 = b === full[1] ? FY + FD + RIM / 2 : gapY(b);
    const plan = { x: x - w / 2, y: y0 - 2.4, w, d: y1 - y0 + 4.8, r: 0.6 };
    const stops = [];
    for (let r = a; r <= b; r++) stops.push(at([x, tileCentre(0, r)[1], z + BAR_T]));
    const groove = subway ? L(k.lineOnTop([x, plan.y], [x, plan.y + plan.d], z + BAR_T, P), { tone: "faint" }) : "";
    for (const [py, base] of [[y0, a === full[0] ? RIM_TOP : FLOOR_H], [y1, b === full[1] ? RIM_TOP : FLOOR_H]]) {
      cyl(`line.${line.id}.post`, x, py, POST_R, base + 1.2, z - base - 1.2, {}, { steps: 16 });
      cyl(`line.${line.id}.foot`, x, py, POST_R + 0.9, base, 1.2, { tone: "lo" }, { steps: 16 });
    }
    slab(`line.${line.id}`, plan, z, BAR_T, { tone: subway ? "hi" : "mid", crease: "lo" }, {
      steps: 2,
      bevel: 0.3,
      extra: groove + D(stops, { size: subway ? 0.55 : 0.45, tone: subway ? "hi" : "mid" }),
      meta: { owner: "transit" },
    });
  }
}

// ---------- 통근 시간 다이얼: 0~90분 눈금, 손잡이가 돌면 칠해지는 칸이 바뀐다 ----------
const MIN_TO_ANGLE = (m) => (-135 + (m / 90) * 270) * (Math.PI / 180);
slab("dial.bezel", { x: DIAL.x - DIAL.r, y: DIAL.y - DIAL.r, w: DIAL.r * 2, d: DIAL.r * 2, r: DIAL.r }, 0, 1.4, { tone: "lo" }, {
  steps: 16,
  extra: (() => {
    const t = k.radialTicks(DIAL.x, DIAL.y, DIAL.r - 1.6, 18, 3, 1.4, [2, 4.2], P, MIN_TO_ANGLE(0), MIN_TO_ANGLE(90) - MIN_TO_ANGLE(0));
    const a60 = MIN_TO_ANGLE(60);
    const r0 = DIAL.r - 1.6;
    const mark = k.lineOnTop([DIAL.x + Math.sin(a60) * (r0 - 4.2), DIAL.y - Math.cos(a60) * (r0 - 4.2)], [DIAL.x + Math.sin(a60) * r0, DIAL.y - Math.cos(a60) * r0], 1.4, P);
    return L(k.ring(DIAL.x, DIAL.y, DIAL.r - 1.6, 1.4, P, 64), { tone: "faint" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + L(mark, { tone: "hi", className: "lb-sixty" });
  })(),
});
const pointerAt = (minutes) => {
  const a = MIN_TO_ANGLE(minutes);
  return k.lineOnTop([DIAL.x + Math.sin(a) * 2, DIAL.y - Math.cos(a) * 2], [DIAL.x + Math.sin(a) * (DIAL.knob - 5), DIAL.y - Math.cos(a) * (DIAL.knob - 5)], 10, P);
};
cyl("dial.knob", DIAL.x, DIAL.y, DIAL.knob, 1.4, 7, {}, { steps: 56, bevel: 0.6, extra: L(k.knurl(DIAL.x, DIAL.y, DIAL.knob, 2.4, 8.4, 64, P), { tone: "lo" }) });
cyl("dial.cap", DIAL.x, DIAL.y, DIAL.knob - 4, 8.4, 1.6, { tone: "hi", crease: "lo" }, {
  steps: 48,
  bevel: 0.4,
  extra: L(k.ring(DIAL.x, DIAL.y, 2, 10, P, 16), { tone: "mid" }) + `<path data-part="pointer" class="iso-line" data-tone="hi" data-free="end" d="${pointerAt(M.MINUTES.start)}" style="stroke-width:1.2"/>`,
});

// ---------- 환승 스위치: 0, 1, 2회 세 자리 ----------
slab("switch.base", SWITCH, 0, 3, { tone: "mid" }, {
  bevel: 0.5,
  extra:
    L(k.planOutline({ x: SWITCH.x + 7, y: SWITCH.y + SWITCH.d / 2 - 1.4, w: SWITCH.w - 14, d: 2.8, r: 1.4 }, 3, P, 6), { tone: "lo" }) +
    D([0, 1, 2].map((t) => at([SW_POS(t), SWITCH.y + 2.6, 3])), { size: 0.55, tone: "mid" }) +
    D([at([SWITCH.x + 2.6, SWITCH.y + 2.6, 3]), at([SWITCH.x + SWITCH.w - 2.6, SWITCH.y + SWITCH.d - 2.6, 3])], { size: 0.4, tone: "lo" }),
});
const THUMB = { x: SW_POS(1) - 3.5, y: SWITCH.y + SWITCH.d / 2 - 3.5, w: 7, d: 7, r: 1.2 };
solids++;
const thumbShape = R.solid(A.slab(THUMB, 3, 4, { name: "switch.thumb" }, 3));
put(
  "switch.thumb",
  [SW_POS(1), SWITCH.y + SWITCH.d / 2, 5],
  `<g data-part="thumb" class="lb-hit" data-act="transfer">${S(k.slabOf(THUMB, 3, 4, P, 3, 0.4), { tone: "hi", crease: "lo" })}${L(
    [-1.6, 0, 1.6].map((dx) => k.lineOnTop([SW_POS(1) + dx, THUMB.y + 1], [SW_POS(1) + dx, THUMB.y + THUMB.d - 1], 7, P)).join(""),
    { tone: "lo" },
  )}</g>`,
  [thumbShape],
);

// ---------- 월세 상한 레일: 45~70만원, 맨 끝은 상한 없음 ----------
slab("rent.rail", RAIL, 0, 2, { tone: "lo" }, {
  bevel: 0.4,
  extra: (() => {
    const minor = [];
    const major = [];
    for (let i = 0; i < M.RENTS.length; i++) {
      major.push(k.lineOnTop([RENT_POS(i), RAIL.y + RAIL.d], [RENT_POS(i), RAIL.y + RAIL.d - 3], 2, P));
      if (i < M.RENTS.length - 1) minor.push(k.lineOnTop([RENT_POS(i) + 8, RAIL.y + RAIL.d], [RENT_POS(i) + 8, RAIL.y + RAIL.d - 1.6], 2, P));
    }
    return L(minor.join(""), { tone: "lo" }) + L(major.join(""), { tone: "mid" }) + L(k.lineOnTop([RAIL.x, RAIL.y + 3.4], [RAIL.x + RAIL.w, RAIL.y + 3.4], 2, P), { tone: "faint" });
  })(),
});
for (const x of [RAIL.x - 4, RAIL.x + RAIL.w]) slab("rent.stop", { x, y: RAIL.y - 1, w: 4, d: RAIL.d + 2, r: 1 }, 0, 4.4, {}, { bevel: 0.4, extra: D([at([x + 2, RAIL.y + RAIL.d / 2, 4.4])], { size: 0.45 }) });
const REST = RENT_POS(M.RENTS.length - 1);
const SLIDER = { x: REST - 5, y: RAIL.y - 1.5, w: 10, d: RAIL.d + 3, r: 1.4 };
solids += 2;
const sliderShape = R.solid(A.slab(SLIDER, 2, 4, { name: "rent.slider" }, 3));
const sliderSvg =
  S(k.slabOf(SLIDER, 2, 4, P, 3, 0.4), { tone: "hi", crease: "lo" }) +
  L(k.lineOnTop([REST, SLIDER.y], [REST, SLIDER.y + SLIDER.d], 6, P), { tone: "mid" }) +
  S(k.cylinder(REST, SLIDER.y + SLIDER.d + 1.6, 1.6, 2.4, 3, P, 16), { tone: "mid" });
const knobShape = R.solid(A.cylinder(REST, SLIDER.y + SLIDER.d + 1.6, 1.6, 2.4, 3, { name: "rent.knob" }));
const toPx = (t) => t.replace(/translate\(([-\d.]+) ([-\d.]+)\)/, "translate($1px,$2px)");
put("rent.slider", [RENT_POS(M.RENTS.length - 1), RAIL.y + RAIL.d / 2, 4], `<g data-part="slider" class="lb-hit" data-act="rent">${sliderSvg}</g>`, [sliderShape, knobShape]);

// ---------- 본 방 카드 꽂이: 비교할 방은 최대 5장 ----------
slab("rack.base", RACK, 0, RACK_H, { tone: "mid" }, {
  bevel: 0.5,
  inner: L(k.sideSeam(RACK, RACK_H / 2, P, 4), { tone: "faint" }),
  extra:
    L(
      Array.from({ length: M.COMPARE_MAX }, (_, i) => k.planOutline({ x: RACK.x + 3, y: SLOT_Y(i) - 0.4, w: RACK.w - 6, d: CARD.d + 0.8, r: 0.5 }, RACK_H, P, 2)).join(""),
      { tone: "lo" },
    ) + D(k.corners(RACK, 2.4).map(([x, y]) => at([x, y, RACK_H])), { size: 0.4 }),
});
const faceY = V[1] > 0 ? CARD.d : 0; // 보이는 쪽 면
for (let i = 0; i < M.COMPARE_MAX; i++) {
  const plan = { x: RACK.x + 4, y: SLOT_Y(i), w: CARD.w, d: CARD.d, r: 0.3 };
  solids++;
  const shape = R.solid(A.slab(plan, RACK_H, CARD.h, { name: `card.${i}` }, 1));
  const fy = plan.y + faceY;
  const z0 = RACK_H;
  const rules = [];
  for (let j = 0; j < 3; j++) {
    const z = z0 + CARD.h - 7 - j * 4.4;
    rules.push(k.segment([plan.x + 7, fy, z], [plan.x + CARD.w - 4 - j * 3, fy, z], P));
  }
  const boxes = [0, 1, 2].map((j) => at([plan.x + 4, fy, z0 + CARD.h - 7 - j * 4.4]));
  const band = k.sideSeam(plan, z0 + CARD.h - 2.6, P, 1);
  const svg =
    `<g class="lb-card" data-card="${i}">` +
    S(k.slabOf(plan, z0, CARD.h, P, 1, 0.2), { tone: "mid", className: "lb-card-body" }) +
    L(band, { tone: "mid", className: "lb-card-band" }) +
    L(rules.join(""), { tone: "mid", free: true }) +
    `<g class="iso-dots lb-checks" data-tone="hi">${boxes.map(([x, y], j) => `<circle data-check="${j}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.1"/>`).join("")}</g>` +
    `</g>`;
  put(`card.${i}`, [plan.x + CARD.w / 2, plan.y + CARD.d / 2, z0 + CARD.h / 2], svg, [shape]);
}

// ---------- 이름판: 새긴 글자 하나와 줄 세 개 ----------
slab("label.plate", LABEL, 0, 1.2, { tone: "mid" }, {
  bevel: 0.3,
  extra:
    k.faceTextSvg(k.topMatrix([LABEL.x + 5, LABEL.y + 6.4], 1.2, P, "x"), "자취선배", { size: 4.2, tone: "mid" }) +
    L([0, 1].map((j) => k.lineOnTop([LABEL.x + 5, LABEL.y + 9.6 + j * 2.6], [LABEL.x + LABEL.w - 8 - j * 10, LABEL.y + 9.6 + j * 2.6], 1.2, P)).join(""), { tone: "lo", free: true }) +
    D(k.corners(LABEL, 2).map(([x, y]) => at([x, y, 1.2])), { size: 0.4 }),
});

// ---------- 순서 정하기와 점검 ----------
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "동네 판 기계. 받침판 위 7×6칸 동네 판의 한 칸에 회사 빌딩이 서 있고, 판 위로 지하철 두 줄과 버스 두 줄의 노선 막대가 지나간다. 오른쪽 통근 시간 다이얼을 돌리면 회사에서 그 시간 안에 닿는 동네 칸이 떠오르며 시간대별 파란색으로 칠해지고, 환승 스위치와 월세 레일이 칸을 걸러 낸다. 칠해진 칸을 누르면 노란 본 방 카드가 꽂이에 꽂히고, 최대 5장을 나란히 비교한다.",
  body: [...statics, ...R.items.map((item) => `<g class="it" data-name="${item.name}">${item.svg}</g>`)],
});

// ---------- 페이지 ----------
const DATA = {
  P,
  lift,
  times: TIMES,
  rent: RENT,
  names: Array.from({ length: M.COLS * M.ROWS }, (_, i) => tileName(i)),
  home: HOME_I,
  // 처음 보이는 그림에도 기록이 있도록: 60분, 환승 1회 안에서 월세가 가장 싼 두 곳
  records: M.reach({ minutes: 60, transfers: 1, rent: null }, TIMES, RENT).filter((i) => i !== HOME_I).sort((a, b) => RENT[a] - RENT[b] || a - b).slice(0, 2),
  minutes: M.MINUTES,
  rents: M.RENTS,
  max: M.COMPARE_MAX,
  maxTransfers: M.MAX_TRANSFERS,
  dial: { x: DIAL.x, y: DIAL.y, knob: DIAL.knob },
  sw: [0, 1, 2].map((t) => SW_POS(t) - SW_POS(1)),
  rentPos: M.RENTS.map((_, i) => RENT_POS(i) - REST),
};
const live = readFileSync(join(HERE, "live.js"), "utf8").replace("= __DATA__;", `= ${JSON.stringify(DATA)};`).replace("= __BAND__;", `= ${M.bandOf.toString()};`);
const CSS = readFileSync(join(HERE, "landing-anatomy.css"), "utf8");

const body =
  `<style>${CSS}</style>` +
  k.plateHtml({
    fig: "Fig 1",
    title: "동네 판",
    hint: "끌어서 통근 시간, 칠해진 칸을 눌러 기록",
    readout: "",
    keys: [
      { mark: "lit", label: "회사 빌딩: 계산이 시작되는 곳" },
      { mark: "blue", label: "칠해진 동네: 짙을수록 가까워요(15분 단위)" },
      { mark: "yellow", label: "본 방 카드: 최대 5장 나란히 비교" },
    ],
    caption:
      "회사에서 출발해 걷기와 노선 막대(지하철 2줄, 버스 2줄)를 따라 한 번만 퍼져 나가면, 동네마다 길찾기를 따로 누르지 않아도 모든 칸의 통근 시간이 한꺼번에 나와요. 다이얼은 그 시간 안의 칸만 칠하고, 환승 스위치와 월세 레일은 조건으로 걸러요. 실제 서비스는 같은 방식으로 전국 버스, 지하철 117만 구간을 따라가요. 판의 시간과 월세는 설명용 예시예요.",
    body: `<div class="iso-stage lb-stage" tabindex="0" role="slider" aria-label="통근 시간 다이얼. 왼쪽, 오른쪽 화살표로 5분씩 바꾸고, T로 환승 횟수, R로 월세 상한, 스페이스로 가장 가까운 칸을 기록해요" aria-valuemin="${M.MINUTES.min}" aria-valuemax="${M.MINUTES.max}" aria-valuenow="${M.MINUTES.start}">${svg}</div><span class="lb-sr" role="status" aria-live="polite" data-status></span>`,
  }) +
  `<section class="lb-compare" aria-label="나란히 비교"><h2>나란히 비교 <span data-count>0/${M.COMPARE_MAX}</span></h2><div class="lb-table" data-table></div></section>`;

const FONT = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">`;
const THEME_PICK = `<script>(()=>{const h=location.hash.slice(1);const t=h==="light"||h==="dark"?h:matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.body.dataset.theme=t;})()</script>`;
let page = k.pageHtml({ title: "동네 판", theme: "dark", body, script: kitScript() + live, width: 680 });
page = page.replace('<html lang="en">', '<html lang="ko">').replace("</head>", `${FONT}</head>`).replace('<body class="iso" data-theme="dark">', `<body class="iso" data-theme="dark">${THEME_PICK}`);
const OUT = join(HERE, "landing-anatomy.html");
writeFileSync(OUT, page);
console.log(`wrote landing-anatomy.html  ${(page.length / 1024).toFixed(0)} KB, ${R.items.length} items, ${solids} solids`);

A.auditOrExit(R, P, {});
