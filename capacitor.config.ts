import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.yatribus.app',
  appName: 'YatriBus',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    Geolocation: {
      // Respect battery life and explicitly granted fine location permissions
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    },
    // Route fetch/XHR through Capacitor's native HTTP bridge on Android.
    // This avoids relying solely on WebView networking during an active
    // foreground location-sharing session.
    CapacitorHttp: {
      enabled: true,
    },
  },
  android: {
    useLegacyBridge: true,
    buildOptions: {
      keystorePath: undefined, // Debug build uses Android debug keystore
    },
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  }
};

export default config;
