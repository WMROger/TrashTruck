const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add resolver configuration to handle problematic modules
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.alias = {
  ...config.resolver.alias,
  // Fix lodash resolution issue
  'lodash': require.resolve('lodash'),
};

// Enable symlinks
config.resolver.symlinks = false;

// Add platforms
config.resolver.platforms = ['ios', 'android', 'web', 'native'];

// Web-specific configurations for better font loading
if (process.env.EXPO_PLATFORM === 'web') {
  // Ensure web assets are handled properly
  config.transformer = {
    ...config.transformer,
    assetPlugins: ['expo-asset/tools/hashAssetFiles'],
  };
}

module.exports = config;
