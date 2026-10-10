// Monorepo Metro setup, same as nouzl_mobile's apps: watch the workspace root
// so edits in packages/* hot reload, and resolve node_modules from this app
// and the hoisted root. Hierarchical lookup stays on: react-native-reanimated
// needs its own nested semver (see nouzl_mobile apps/customer/metro.config.js).
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './src/global.css' });
