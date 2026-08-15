import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.mobstudios.gravitymobile',
  appName: 'Gravity Mobile',
  webDir: 'apps/mobile/dist',
  android: {
    path: 'apps/mobile/android',
  },
  server: {
    cleartext: true,
  },
}

export default config
