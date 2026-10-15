const { topology } = require('topojson-server');
const { feature } = require('topojson-client');
const { presimplify, simplify } = require('topojson-simplify');

const ringsOf = (geometry) => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates);
const arcRingsOf = (geometry) => (geometry.type === 'Polygon' ? [geometry.arcs] : geometry.arcs);
const signedArea = (ring) =>
  ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length];
    const origin = ring[0];
    return sum + (point[0] - origin[0]) * (next[1] - origin[1]) - (next[0] - origin[0]) * (point[1] - origin[1]);
  }, 0);
// 좌표 양자화 없이 전국의 공유 arc를 같은 임계값으로 단순화한다.
const simplifyBoundaryLevels = (geojson) => {
  const weighted = presimplify(topology({ dongs: geojson }), (triangle) => {
    const scaleX = 111320 * Math.cos((triangle[0][1] * Math.PI) / 180);
    const scaleY = 111320;
    const [a, b, c] = triangle;
    return (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) * scaleX * scaleY) / 2;
  });
  const levels = {};
  for (const [level, minArea] of [
    ['overview', 5000],
    ['medium', 1500],
  ]) {
    // 등급별 복사: 한 등급에서 작은 링을 보호해도 다른 등급의 가중치는 바꾸지 않는다.
    const copy = { ...weighted, arcs: weighted.arcs.map((arc) => arc.map((point) => [...point])) };
    for (;;) {
      const decoded = feature(simplify(copy, minArea), copy.objects.dongs);
      let repaired = false;
      decoded.features.forEach((item, index) => {
        ringsOf(item.geometry).forEach((polygon, pi) =>
          polygon.forEach((ring, ri) => {
            const original = ringsOf(geojson.features[index].geometry)[pi][ri];
            const originalArea = signedArea(original);
            const area = signedArea(ring);
            const unique = new Set(ring.map((point) => point.join(','))).size;
            if (unique >= 3 && area !== 0 && Math.sign(area) === Math.sign(originalArea)) return;
            const arcs = arcRingsOf(copy.objects.dongs.geometries[index])[pi][ri];
            for (const id of arcs)
              for (const point of copy.arcs[id < 0 ? ~id : id]) {
                if (point[2] !== Infinity) {
                  point[2] = Infinity;
                  repaired = true;
                }
              }
          }),
        );
      });
      if (repaired) continue;
      levels[level] = decoded.features.map((item, index) =>
        ringsOf(item.geometry).map((polygon, pi) =>
          polygon.map((ring, ri) => {
            const original = ringsOf(geojson.features[index].geometry)[pi][ri];
            const indices = new Map(original.map((point, i) => [point.join(','), i]));
            return ring.map((point) => {
              const result = indices.get(point.join(','));
              if (result === undefined) throw new Error('단순화 경계에 원본에 없는 좌표가 있습니다.');
              return result;
            });
          }),
        ),
      );
      break;
    }
  }
  return geojson.features.map((item, index) => ({
    ...item,
    lod: { overview: levels.overview[index], medium: levels.medium[index] },
  }));
};

module.exports = { simplifyBoundaryLevels };
