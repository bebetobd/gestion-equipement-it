import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gestionit.app',
  appName: 'Gestion IT',
  webDir: 'dist',
  server: {
    url: 'https://gestion-equipement-it.vercel.app',
    cleartext: true,
  },
  android: {
    buildOptions: {
      releaseType: 'APK',
    },
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#1a6fa6',
      showSpinner: true,
      spinnerColor: '#ffffff',
    },
  },
};

export default config;
