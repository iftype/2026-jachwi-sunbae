// 동네 판을 움직이는 코드. build.mjs가 __DATA__와 __BAND__를 채워 페이지에 넣는다.
const DATA = __DATA__;
const bandOf = __BAND__;
const P = DATA.P;
const stage = document.querySelector(".lb-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const status = document.querySelector("[data-status]");
const pointer = svg.querySelector('[data-part="pointer"]');
const thumb = svg.querySelector('[data-part="thumb"]');
const slider = svg.querySelector('[data-part="slider"]');
const tiles = [...svg.querySelectorAll("[data-tile]")];
const cards = [...svg.querySelectorAll("[data-card]")];
const table = document.querySelector("[data-table]");
const count = document.querySelector("[data-count]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const { min, max, step } = DATA.minutes;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const px = (t) => t.replace(/translate\(([-\d.]+) ([-\d.]+)\)/, "translate($1px,$2px)");
const LIFT = `translate(${DATA.lift[0]}px,${DATA.lift[1]}px)`;

const angleOf = (m) => (-135 + (m / 90) * 270) * (Math.PI / 180);
const pointerAt = (m) => {
  const a = angleOf(m);
  const { x, y, knob } = DATA.dial;
  return lineOnTop([x + Math.sin(a) * 2, y - Math.cos(a) * 2], [x + Math.sin(a) * (knob - 5), y - Math.cos(a) * (knob - 5)], 10, P);
};

const state = { minutes: DATA.minutes.start, transfers: 1, rent: DATA.rents.length - 1, records: DATA.records.slice() };
let shown = state.minutes; // 다이얼이 실제로 가리키는 값(부드럽게 따라간다)
let painted = new Set();

const rentText = (i) => (DATA.rents[i] == null ? "월세 상한 없음" : `월세 ${DATA.rents[i]}만원 이하`);
const passes = (i, m) => {
  const t = DATA.times[i][state.transfers];
  const cap = DATA.rents[state.rent];
  return t <= m && (cap == null || DATA.rent[i] <= cap);
};

// 칸마다 체크리스트 진행: 괜찮음, 주의, 미확인 세 칸. 칸 번호로 정해진 예시 값이다.
const checksOf = (i) => [0, 1, 2].map((j) => ["ok", "warn", "ok", "none", "ok"][(i * 3 + j * 2) % 5]);

function paint(m) {
  const next = new Set();
  tiles.forEach((el) => {
    const i = Number(el.dataset.tile);
    if (passes(i, m)) {
      next.add(i);
      const band = String(bandOf(DATA.times[i][state.transfers]));
      if (el.dataset.band !== band) el.dataset.band = band;
      if (!el.style.transform) el.style.transform = LIFT;
    } else {
      if (el.dataset.band) delete el.dataset.band;
      if (el.style.transform) el.style.transform = "";
    }
  });
  painted = next;
}

function drawRecords() {
  // 기록이 칠해진 칸 밖으로 밀려나도 카드는 그대로 둔다(본 방은 남는다).
  tiles.forEach((el) => {
    const on = state.records.includes(Number(el.dataset.tile));
    if (on !== el.hasAttribute("data-rec")) on ? el.setAttribute("data-rec", "") : el.removeAttribute("data-rec");
  });
  cards.forEach((card, slot) => {
    const i = state.records[slot];
    if (i == null) {
      card.removeAttribute("data-on");
      return;
    }
    card.setAttribute("data-on", "");
    const checks = checksOf(i);
    card.querySelectorAll("[data-check]").forEach((dot, j) => (dot.dataset.state = checks[j]));
  });
  count.textContent = `${state.records.length}/${DATA.max}`;
  const cells = ['<span class="h">동네</span>'];
  const rows = [
    ["통근", (i) => `${DATA.times[i][state.transfers]}분`],
    ["환승", (i) => `${transfersUsed(i)}회`],
    ["월세", (i) => `${DATA.rent[i]}만원`],
    ["체크", (i) => `${checksOf(i).filter((c) => c !== "none").length}/3`],
  ];
  for (let s = 0; s < DATA.max; s++) cells.push(state.records[s] != null ? `<span class="n">${DATA.names[state.records[s]]}</span>` : `<span class="e">빈 칸</span>`);
  for (const [label, fn] of rows) {
    cells.push(`<span class="h">${label}</span>`);
    for (let s = 0; s < DATA.max; s++) cells.push(state.records[s] != null ? `<span>${fn(state.records[s])}</span>` : `<span class="e">-</span>`);
  }
  table.innerHTML = cells.join("");
}
// 허용한 환승 안에서 가장 빠른 길이 실제로 몇 번 갈아타는지
const transfersUsed = (i) => {
  const row = DATA.times[i];
  for (let k = 0; k <= state.transfers; k++) if (row[k] === row[state.transfers]) return k;
  return state.transfers;
};

function text() {
  return `${Math.round(state.minutes)}분, 환승 ${state.transfers}회까지, ${rentText(state.rent)} → 동네 ${painted.size}곳, 비교 ${state.records.length}/${DATA.max}`;
}
function report(extra) {
  const t = extra ?? text();
  if (readout.textContent !== t) readout.textContent = t;
  stage.setAttribute("aria-valuenow", String(Math.round(state.minutes)));
  stage.setAttribute("aria-valuetext", t);
}
function drawControls() {
  thumb.style.transform = px(translateAlong(P, [DATA.sw[state.transfers], 0, 0]));
  slider.style.transform = px(translateAlong(P, [DATA.rentPos[state.rent], 0, 0]));
}

// ---------- 움직임: 다이얼은 지수 따라가기, 그 사이 칸은 시간 순서대로 칠해진다 ----------
let frame = 0, last = 0, visible = false, touring = !still.matches, clock = 0, idleTimer = 0;
const TOUR = [30, 45, 60, 75, 90, 60];
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) {
    clock += dt;
    state.minutes = TOUR[Math.floor(clock / 2.8) % TOUR.length];
  }
  shown = still.matches ? state.minutes : shown + (state.minutes - shown) * (1 - Math.exp(-dt / 0.35));
  if (Math.abs(state.minutes - shown) < 0.05) shown = state.minutes;
  pointer.setAttribute("d", pointerAt(shown));
  paint(shown);
  report();
  const settled = !touring && shown === state.minutes;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
function hold() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (still.matches) return;
    touring = true;
    clock = 0;
    run();
  }, 6000);
}
function setMinutes(m) {
  hold();
  state.minutes = clamp(Math.round(m / step) * step, min, max);
  run();
}
function cycleTransfers() {
  hold();
  state.transfers = (state.transfers + 1) % (DATA.maxTransfers + 1);
  drawControls();
  paint(shown);
  drawRecords();
  report();
  announce(`환승 ${state.transfers}회까지`);
  run();
}
function cycleRent() {
  hold();
  state.rent = (state.rent + 1) % DATA.rents.length;
  drawControls();
  paint(shown);
  report();
  announce(rentText(state.rent));
  run();
}
function toggleRecord(i) {
  hold();
  const at = state.records.indexOf(i);
  if (at >= 0) state.records.splice(at, 1);
  else if (state.records.length >= DATA.max) {
    report(`비교는 최대 ${DATA.max}개까지예요`);
    return;
  } else state.records.push(i);
  drawRecords();
  report();
  announce(at >= 0 ? `${DATA.names[i]} 기록을 뺐어요` : `${DATA.names[i]}를 기록했어요`);
}
const announce = (t) => (status.textContent = t);

// ---------- 입력 ----------
let drag = null;
stage.addEventListener("pointerdown", (e) => {
  drag = { x: e.clientX, from: state.minutes, moved: false, target: e.target };
});
stage.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const box = svg.getBoundingClientRect();
  const dx = e.clientX - drag.x;
  if (Math.abs(dx) > 4) drag.moved = true;
  if (drag.moved) setMinutes(drag.from + (dx / box.width) * 160);
});
const end = () => {
  if (drag && !drag.moved) {
    const hit = drag.target.closest?.("[data-tile], [data-act]");
    if (hit?.dataset.act === "transfer") cycleTransfers();
    else if (hit?.dataset.act === "rent") cycleRent();
    else if (hit?.dataset.tile != null && painted.has(Number(hit.dataset.tile))) toggleRecord(Number(hit.dataset.tile));
  }
  drag = null;
};
stage.addEventListener("pointerup", end);
stage.addEventListener("pointercancel", () => (drag = null));
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowUp") setMinutes(state.minutes + step);
  else if (e.key === "ArrowLeft" || e.key === "ArrowDown") setMinutes(state.minutes - step);
  else if (e.key === "Home") setMinutes(min);
  else if (e.key === "End") setMinutes(max);
  else if (e.key === "t" || e.key === "T") cycleTransfers();
  else if (e.key === "r" || e.key === "R") cycleRent();
  else if (e.key === " " || e.key === "Enter") {
    const next = [...painted].filter((i) => !state.records.includes(i)).sort((a, b) => DATA.times[a][state.transfers] - DATA.times[b][state.transfers])[0];
    if (next != null) toggleRecord(next);
  } else if (e.key === "Escape") {
    hold();
    state.records = [];
    drawRecords();
    report();
  } else return;
  e.preventDefault();
});
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);
still.addEventListener?.("change", () => {
  if (still.matches) touring = false;
});

drawControls();
pointer.setAttribute("d", pointerAt(shown));
paint(shown);
drawRecords();
report();
