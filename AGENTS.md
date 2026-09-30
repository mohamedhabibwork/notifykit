# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this is

**NotifyKit** (`@mohamedhabibwork/notifykit`) — unified TypeScript notifications (FCM, APNs,
Huawei, web push, SMTP email, Telegram, Slack, custom) with provider-native options preserved
under `native`. Zero runtime dependencies; fetch-based providers need no SDK and SDK-backed
providers load their optional peer only on creation. Node >= 20, Bun, Deno; dual ESM/CJS.

## Layout

- `src/core/` — contracts, errors, utils, dynamic-import helper (leaf layer).
- `src/drivers/<provider>/` — one folder per provider (config, driver, types).
- `src/routing/`, `src/templates/` — pure policy over core.
- `src/testing/` — fake notifier/driver.
- Root `src/*.ts` — composition: index, factory, manager, per-provider facades.
- `tests/` — Vitest suites including `architecture.test.ts` (boundary guard) and
  `peer-dependencies.test.ts` (optional-peer contract).
- `docs/` — markdown guides, shipped in the npm tarball and formatted by oxfmt.

## Commands

```sh
npm ci             # install exactly the lockfile (dev deps only)
npm run verify     # format:check -> lint -> typecheck -> test -> build  (the gate)
npm run lint:fix   # oxlint --fix
npm run format     # oxfmt (also formats docs/*.md)
npm test           # vitest run
```

CI fails on any lint warning (`--deny-warnings`), any formatting diff, or any architecture
violation. Run `npm run verify` before declaring anything done.

## Conventions

- **Formatting is oxfmt, not opinion**: never hand-format; run `npm run format`.
- **Lint**: `.oxlintrc.json` enables correctness/suspicious/perf across typescript, unicorn,
  import, promise plugins. For intentional code, use an inline
  `// oxlint-disable-next-line <rule>` with a reason — never widen the config for one site.
- **Architecture**: `tests/architecture.test.ts` enforces layering (core is provider-free,
  drivers import only core + their own folder, testing never imports drivers). New edges
  require updating the test AND `docs/architecture.md` together.
- **Dependencies**: no runtime dependencies. Provider SDKs are optional peers loaded with
  `importOptional` and must throw `NotificationConfigError` with the install command when
  missing (covered by `tests/peer-dependencies.test.ts`).
- **TypeScript**: this repo uses TypeScript 7 (`tsc` Go port) — `"types": ["node"]` is set in
  tsconfig because TS7 does not auto-include @types. `lib: ["ES2023", "DOM"]`.
- **Docs**: README, `llms.txt`, and `docs/*.md` are part of the deliverable; API changes
  update all three. `createNotificationManager` is synchronous (lazy providers) — do not
  add `await` to it in docs or code.

## Gotchas

- `sendMany` (not `sendBatch`) — native batch when available, else controlled concurrency.
- Middleware is `notifier.use(async (context, next) => ...)` on the notifier.
- The fake notifier records via `notifier.messages()` / `lastMessage()`, plus `failNext()`
  and `setLatency()` for failure/timing simulation.
