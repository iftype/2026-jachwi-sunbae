const webpack = require('webpack');
const fs = require('node:fs');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const path = require('node:path');
const packageVersion = require('../package.json').version;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const { createBoundaryAssets } = require('./admin-boundary-assets.cjs');

// 파일만 배포 산출물에 복사한다. HTML이나 초기 JS에서 다운로드하지 않는다.
class AdminBoundaryAssetsPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('AdminBoundaryAssets', (compilation) => {
      const sourcePath = path.resolve(__dirname, '../data/admin-dongs.geojson');
      compilation.fileDependencies.add(sourcePath);
      compilation.hooks.processAssets.tap(
        {
          name: 'AdminBoundaryAssets',
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          const assets = createBoundaryAssets(fs.readFileSync(sourcePath));
          const files = {};
          for (const kind of ['emd', 'lio', 'sig']) {
            const legalPath = path.resolve(__dirname, `../data/legal-${kind}.geojson`);
            compilation.fileDependencies.add(legalPath);
            const source = fs.readFileSync(legalPath);
            const hash = crypto.createHash('sha256').update(source).digest('hex').slice(0, 12);
            const filename = `legal-${kind}.${hash}.geojson`;
            files[kind] = filename;
            compilation.emitAsset(`boundaries/${filename}`, new webpack.sources.RawSource(source));
            compilation.emitAsset(`boundaries/${filename}.gz`, new webpack.sources.RawSource(zlib.gzipSync(source)));
          }
          compilation.emitAsset(
            'boundaries/legal-manifest.json',
            new webpack.sources.RawSource(JSON.stringify({ files })),
          );
          for (const [filename, content] of [
            ...assets.partitions.flatMap((part) => [
              [part.filename, part.source],
              [`${part.filename}.gz`, part.gzip],
            ]),
            [assets.filename, assets.source],
            [`${assets.filename}.gz`, assets.gzip],
            ['manifest.json', assets.manifest],
          ])
            compilation.emitAsset(`boundaries/${filename}`, new webpack.sources.RawSource(content));
        },
      );
    });
  }
}

const createPlugins = ({ isProduction, buildEnvironment }) => [
  new AdminBoundaryAssetsPlugin(),
  new webpack.DefinePlugin({
    __API_BASE_URL__: JSON.stringify(buildEnvironment.apiBaseUrl),
    __MAP_PROVIDER_MODE__: JSON.stringify(buildEnvironment.mapProviderMode),
    __NAVER_MAP_CLIENT_ID__: JSON.stringify(buildEnvironment.naverMapClientId),
    __POSTHOG_PROJECT_TOKEN__: JSON.stringify(buildEnvironment.posthogProjectToken),
    __POSTHOG_HOST__: JSON.stringify(buildEnvironment.posthogHost),
    __APP_VERSION__: JSON.stringify(buildEnvironment.appVersion ?? packageVersion),
    __APP_ENVIRONMENT__: JSON.stringify(buildEnvironment.appEnvironment),
    __ENABLE_MSW__: JSON.stringify(buildEnvironment.isMockingEnabled),
    __COMMUTE_DATA_SOURCE__: JSON.stringify(buildEnvironment.commuteDataSource),
    __ADMIN_BOUNDARY_BASE_URL__: JSON.stringify(buildEnvironment.boundaryBaseUrl),
  }),
  new HtmlWebpackPlugin({
    template: './index.html',
    filename: 'index.html',
    inject: true,
  }),
  ...(isProduction
    ? [
        new MiniCssExtractPlugin({
          filename: '[name].[contenthash].css',
          chunkFilename: '[name].[contenthash].css',
        }),
      ]
    : []),
  new BundleAnalyzerPlugin({
    analyzerMode: process.env.ANALYZE === 'true' ? 'static' : 'disabled',
    reportFilename: 'bundle-report.html',
    openAnalyzer: false,
  }),
];

module.exports = { createPlugins };
