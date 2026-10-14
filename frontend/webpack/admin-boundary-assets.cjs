const crypto = require('node:crypto');
const zlib = require('node:zlib');

const createBoundaryAssets = (source) => {
  const geojson = JSON.parse(source.toString('utf8'));
  if (geojson.type !== 'FeatureCollection' || !geojson.features?.length)
    throw new Error('행정동 원본 형식을 확인해주세요.');
  const dates = [...new Set(geojson.features.map((feature) => feature.properties.baseDate))];
  if (dates.length !== 1 || !/^\d{8}$/.test(dates[0])) throw new Error('행정동 기준일을 확인해주세요.');
  const version = dates[0];
  const hash = crypto.createHash('sha256').update(source).digest('hex').slice(0, 12);
  const filename = `admin-dongs.${version}.${hash}.geojson`;
  return {
    filename,
    source,
    gzip: zlib.gzipSync(source),
    manifest: JSON.stringify({ version, file: filename }),
  };
};

module.exports = { createBoundaryAssets };
