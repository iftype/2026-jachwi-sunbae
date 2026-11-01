// 동네 판의 진짜 계산. 빌드와 페이지가 같은 모듈을 쓴다(페이지에는 문자열로 넣는다).
// 판은 7 × 6 칸의 동네다. 회사 칸에서 출발해 걷기와 노선 막대를 따라가며
// 칸마다 "환승 k회까지 허용할 때 걸리는 가장 짧은 시간"을 한 번에 구한다.
// 동네마다 길찾기를 따로 누르지 않고, 회사에서 거꾸로 한 번 퍼져 나가는 계산이다.

export const COLS = 7;
export const ROWS = 6;
export const HOME = [2, 2]; // 회사 칸 [열, 행]

// 노선 막대. along "x"는 행 사이 틈(gap 행 r과 r+1 사이)을, "y"는 열 사이 틈을 따라간다.
// perTile: 한 칸 가는 데 드는 분, wait: 타기 전 걷기와 기다림.
export const LINES = [
  { id: "A", kind: "subway", along: "x", gap: 1, perTile: 6, wait: 10 },
  { id: "B", kind: "subway", along: "y", gap: 1, perTile: 6, wait: 10 },
  { id: "C", kind: "bus", along: "x", gap: 3, perTile: 7, wait: 8 },
  { id: "D", kind: "bus", along: "y", gap: 5, perTile: 7, wait: 8, span: [3, 5] },
];

export const WALK = 40; // 이웃 동네까지 걸어서
export const MAX_TRANSFERS = 2;
export const MINUTES = { min: 10, max: 90, step: 5, start: 60 }; // 랜딩 문구의 "60분"
export const RENTS = [45, 50, 55, 60, 65, 70, null]; // 만원, null은 상한 없음
export const COMPARE_MAX = 5; // 비교표는 최대 5개

// span: 노선이 지나는 칸 범위(along 방향). 없으면 판 끝에서 끝까지.
const spanOf = (line) => line.span ?? [0, (line.along === "x" ? COLS : ROWS) - 1];
const serves = (line, c, r) => {
  const [a, b] = spanOf(line);
  return line.along === "x" ? (r === line.gap || r === line.gap + 1) && c >= a && c <= b : (c === line.gap || c === line.gap + 1) && r >= a && r <= b;
};

// times[i][k]: 칸 i까지 환승 k회 이하로 가는 최단 분. 탈 수 없으면 Infinity.
export function solve() {
  const n = COLS * ROWS;
  const idx = (c, r) => r * COLS + c;
  // 상태: (칸, 탄 노선 -1이면 걷는 중, 탑승 횟수). 탑승 횟수 0..MAX_TRANSFERS+1
  const B = MAX_TRANSFERS + 2;
  const L = LINES.length + 1;
  const key = (i, l, b) => (i * L + (l + 1)) * B + b;
  const best = new Float64Array(n * L * B).fill(Infinity);
  const queue = [];
  const push = (t, i, l, b) => {
    const k = key(i, l, b);
    if (t >= best[k] - 1e-9) return;
    best[k] = t;
    queue.push([t, i, l, b]);
  };
  push(0, idx(...HOME), -1, 0);
  while (queue.length) {
    queue.sort((a, b) => b[0] - a[0]);
    const [t, i, l, b] = queue.pop();
    if (t > best[key(i, l, b)] + 1e-9) continue;
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    if (l < 0) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) push(t + WALK, idx(nc, nr), -1, b);
      }
      LINES.forEach((line, li) => {
        if (serves(line, c, r) && b + 1 < B) push(t + line.wait, i, li, b + 1);
      });
    } else {
      const line = LINES[l];
      push(t, i, -1, b); // 내리기
      // 같은 정류장의 맞은편 칸(틈 건너편)으로는 바로 옮겨 간다.
      const across = line.along === "x" ? [c, r === line.gap ? line.gap + 1 : line.gap] : [c === line.gap ? line.gap + 1 : line.gap, r];
      push(t, idx(...across), l, b);
      const steps = line.along === "x" ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
      for (const [dc, dr] of steps) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && serves(line, nc, nr)) push(t + line.perTile, idx(nc, nr), l, b);
      }
    }
  }
  const times = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let k = 0; k <= MAX_TRANSFERS; k++) {
      let m = Infinity;
      for (let b = 0; b <= k + 1; b++) m = Math.min(m, best[key(i, -1, b)]);
      row.push(Math.round(m));
    }
    times.push(row);
  }
  return times;
}

// 설명용 월세(만원). 회사에서 멀수록 싸지고, 칸마다 조금씩 다르다.
export function rents() {
  return Array.from({ length: COLS * ROWS }, (_, i) => {
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    const far = Math.abs(c - HOME[0]) + Math.abs(r - HOME[1]);
    const wobble = ((i * 37) % 7) - 3;
    return Math.max(36, 72 - far * 6 + wobble);
  });
}

// 시간대 띠: 칠해지는 색의 짙기. 15분 단위.
export const bandOf = (minutes) => Math.min(6, Math.max(1, Math.ceil(minutes / 15)));

export function reach({ minutes, transfers, rent }, times, rentOf) {
  const out = [];
  times.forEach((row, i) => {
    const t = row[transfers];
    if (t <= minutes && (rent == null || rentOf[i] <= rent)) out.push(i);
  });
  return out;
}
