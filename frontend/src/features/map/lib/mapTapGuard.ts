/** SDK가 드래그나 핀치 종료 뒤 보내는 click을 위치 선택으로 처리하지 않는다. */
export const createMapTapGuard = (now: () => number = () => performance.now()) => {
  const pointers = new Map<number, { x: number; y: number }>();
  let blockedUntil = 0;
  let moved = false;
  const block = () => {
    moved = true;
    blockedUntil = now() + 400;
  };
  return {
    start: (id: number, x: number, y: number) => {
      if (pointers.size === 0) moved = false;
      pointers.set(id, { x, y });
      if (pointers.size > 1) block();
    },
    move: (id: number, x: number, y: number) => {
      const start = pointers.get(id);
      if (start && Math.hypot(x - start.x, y - start.y) > 8) block();
    },
    end: (id: number, cancelled = false) => {
      if (cancelled || moved) block();
      pointers.delete(id);
    },
    block,
    allowsTap: () => pointers.size <= 1 && !moved && now() >= blockedUntil,
    reset: () => {
      pointers.clear();
      moved = false;
    },
  };
};
