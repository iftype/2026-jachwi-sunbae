const path = require('path');

const { loadLocalEnv, readBuildEnvironment } = require('./build-environment.cjs');
const { createModuleRules } = require('./webpack-rules.cjs');
const { createPlugins } = require('./webpack-plugins.cjs');

module.exports = (_env, argv) => {
  loadLocalEnv();
  const isProduction = argv.mode === 'production';
  const isMockingEnabled = process.env.ENABLE_MSW === 'true';
  const proxyTarget =
    !isProduction && (!isMockingEnabled || process.env.USE_REAL_COMMUTE_API === 'true')
      ? process.env.DEV_API_PROXY_TARGET
      : undefined;
  const buildEnvironment = readBuildEnvironment({ isProduction, proxyTarget });
  const isBrowserTestHarness = process.env.BROWSER_TEST_HARNESS === 'true';

  return {
    mode: isProduction ? 'production' : 'development',
    entry: isBrowserTestHarness ? './src/app/test-browser/main.tsx' : './src/main.tsx',
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    },
    devtool: isProduction ? 'hidden-source-map' : 'eval-cheap-module-source-map',
    output: {
      path: path.resolve(__dirname, '../dist'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProduction ? '[name].[contenthash].js' : '[name].js',
      assetModuleFilename: isProduction ? 'assets/[name].[contenthash][ext]' : 'assets/[name][ext]',
      publicPath: '/',
      clean: true,
    },
    plugins: createPlugins({ isProduction, buildEnvironment }),
    module: {
      rules: createModuleRules(isProduction),
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, '../src'),
        // 지도 마커 HTML(`renderToStaticMarkup`)만 쓰므로 그 함수가 든 legacy 서버 렌더러만 싣는다.
        // `react-dom/server.browser`는 스트리밍 렌더러까지 함께 불러 지도 화면마다 gzip 약 55KB가 따라왔다.
        // react-dom이 이 파일을 옮기면 빌드가 경로 오류로 멈춘다.
        'react-dom/server$': path.join(
          path.dirname(require.resolve('react-dom/package.json')),
          'cjs',
          `react-dom-server-legacy.browser.${isProduction ? 'production' : 'development'}.js`,
        ),
      },
    },
    performance: {
      hints: isProduction ? 'error' : false,
      assetFilter: (assetFilename) => /\.js$/.test(assetFilename),
      // PR(#714~#717)과 Mac UI 작업본 중 최대 main은 360 KiB(gzip 115 KiB, Mac 측정)다.
      // 여기에 5%를 더하고 5 KiB 단위로 올려 380 KiB로 정한다.
      maxAssetSize: 380 * 1024,
      maxEntrypointSize: 380 * 1024,
    },
    devServer: {
      proxy: proxyTarget
        ? [
            {
              context: ['/api'],
              target: proxyTarget,
              changeOrigin: true,
              on: {
                proxyReq: (proxyReq) => proxyReq.removeHeader('origin'),
              },
            },
          ]
        : [],
      static: {
        directory: path.join(__dirname, '../public'),
      },
      port: buildEnvironment.devServerPort,
      open: false,
      hot: true,
      historyApiFallback: true,
      client: {
        overlay: true,
      },
    },
  };
};
