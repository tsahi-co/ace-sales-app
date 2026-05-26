const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    const shimsDir = path.resolve(__dirname, 'src/webshims');
    const shims = {
      'expo-local-authentication': path.join(shimsDir, 'LocalAuthShim.ts'),
      'expo-secure-store': path.join(shimsDir, 'SecureStoreShim.ts'),
      'expo-notifications': path.join(shimsDir, 'NotificationsShim.ts'),
      '@react-native-async-storage/async-storage': path.join(shimsDir, 'AsyncStorageShim.ts'),
    };
    if (shims[moduleName]) {
      return { filePath: shims[moduleName], type: 'sourceFile' };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
