import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts', fcm: 'src/fcm.ts', huawei: 'src/huawei.ts',
    webpush: 'src/webpush.ts', email: 'src/email.ts', telegram: 'src/telegram.ts',
    apns: 'src/apns.ts', custom: 'src/custom.ts', testing: 'src/testing.ts',
  },
  format: ['esm'], target: 'es2022', dts: true, clean: true, splitting: false,
});
