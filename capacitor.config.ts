import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.yatribus.app',
  appName: 'YatriBus',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    Geolocation: {
      // Respect battery life and explicitly granted fine location permissions
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    },
  },
  android: {
    useLegacyBridge: true,
    buildOptions: {
      keystorePath: undefined, // Debug build uses Android debug keystore
    },
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  }
};

export default config;
