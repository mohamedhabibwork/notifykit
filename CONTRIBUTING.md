# Contributing to NotifyKit

Thanks for contributing. NotifyKit treats runtime support and public TypeScript inference as product features, so every change should preserve both.

## Local setup

```sh
git clone https://github.com/mohamedhabibwork/notifykit.git
cd notifykit
npm ci
npm run verify
```

`npm run verify` runs formatting, linting, TypeScript checks, tests, and the production build.

## Making a change

1. Create a focused branch from `main`.
2. Keep provider-specific fields under `native`; do not add them to the common message model.
3. Add or update runtime tests and compile-time type tests when public behavior or inference changes.
4. Run `npm run format` and `npm run verify`.
5. Open a pull request using the provided template.

## Provider rules

- Do not import a provider SDK from the runtime-neutral core.
- Keep provider SDKs optional peer dependencies and load them only in their provider driver.
- Preserve upstream responses under `result.native` and original provider errors under `cause` or `native`.
- Never write credentials, tokens, or secrets to logs, errors, fixtures, or documentation.
- Keep the public extension contract usable without importing internal modules.

## Commit and pull-request expectations

Use concise imperative commit subjects, such as `fix: classify Telegram rate limits`. Pull requests should explain the user-visible change, testing performed, and any provider/runtime limitations.

By contributing, you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
