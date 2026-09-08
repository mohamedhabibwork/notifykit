import { createNotificationManager, createNotifier } from '../src/index.js';

const telegram = createNotifier({ type: 'telegram', botToken: 'token' });
void telegram.then((notifier) =>
  notifier.send({ to: { chatId: 1 }, notification: { body: 'ok' }, native: { parse_mode: 'HTML' } }),
);
void telegram.then((notifier) =>
  notifier.send({
    to: { chatId: 1 },
    notification: { body: 'ok' },
    // @ts-expect-error FCM options are never valid Telegram-native options.
    native: { android: { priority: 'high' } },
  }),
);
const fcm = createNotifier({
  type: 'fcm',
  credential: { projectId: 'project', clientEmail: 'service@example.com', privateKey: 'private-key' },
});
void fcm.then(async (notifier) => {
  const token = await notifier.native()?.getAccessToken();
  const expiresAt = token?.expiresAt;
  void expiresAt;
  await notifier.send({
    to: { token: 'device-token' },
    native: { apns: { payload: { aps: { mutableContent: true } } } },
  });
});
const manager = createNotificationManager({
  providers: {
    alerts: { type: 'telegram', botToken: 'token' },
    mail: { type: 'email', transport: { type: 'smtp', host: 'localhost', port: 25 } },
  },
  default: 'alerts',
});
void manager
  .provider('alerts')
  .then((notifier) => notifier.send({ to: { chatId: '1' }, notification: { body: 'ok' } }));
void manager
  .provider('mail')
  .then((notifier) => notifier.send({ to: 'user@example.com', notification: { title: 'ok', body: 'ok' } }));
