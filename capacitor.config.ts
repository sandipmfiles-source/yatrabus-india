import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.yatrabus.app',
  appName: 'YatraBus India',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false
  },
  plugins: {
    Geolocation: {
      permissions: ['location', 'coarseLocation']
    },
    LocalNotifications: {
      iconColor: '#0e5a36'
    }
  }
};

export default config;
