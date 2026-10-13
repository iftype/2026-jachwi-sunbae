const path = require('path');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

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
    optimization: isProduction
      ? {
          minimizer: ['...', new CssMinimizerPlugin()],
        }
      : undefined,
    plugins: createPlugins({ isProduction, buildEnvironment }),
    module: {
      rules: createModuleRules(isProduction),
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, '../src'),
      },
    },
    performance: {
      hints: isProduction ? 'error' : false,
      assetFilter: (assetFilename) => /\.(?:js|css)$/.test(assetFilename),
      maxAssetSize: 350 * 1024,
      maxEntrypointSize: 350 * 1024,
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
