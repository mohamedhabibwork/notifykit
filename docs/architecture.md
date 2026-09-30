# Architecture

The core contains only Web Platform APIs and generic contracts. SDK-backed providers live in individual entrypoints and dynamically load their optional peer dependency at creation time. `native` deliberately preserves provider-specific send options and responses. The manager owns named, lazy provider instances and closes only initialized providers.

## Layers

Dependencies point one way, bottom-up:

| Layer                            | Contents                                                   | May depend on                |
| -------------------------------- | ---------------------------------------------------------- | ---------------------------- |
| `src/core/`                      | Contracts, errors, utils, dynamic-import helper            | itself only                  |
| `src/drivers/<provider>/`        | One folder per provider (config, driver, types)            | core + its own folder        |
| `src/routing/`, `src/templates/` | Pure policy over core                                      | core only                    |
| `src/testing/`                   | Fake driver/provider for consumers                         | core + itself, never drivers |
| `src/*.ts` (root)                | Composition: index, factory, manager, per-provider facades | anything                     |

These rules are enforced by `tests/architecture.test.ts`: it walks every file under `src/`,
resolves each relative import, and fails when a layer reaches outside its boundary. If a
legitimate new edge is needed, widen the allow-list in the test and this document together —
never bypass the test with an absolute import.

### Adding a provider

1. Create `src/drivers/<name>/` with `config.ts`, `driver.ts`, `types.ts`.
2. Load the SDK with `importOptional` from core so the package stays an optional peer dependency.
3. Add a facade `src/<name>.ts` and wire it into `src/factory.ts`.
4. `npm run check` — the architecture test proves the driver folder stayed self-contained.

## Clean-code toolchain

Linting and formatting are enforced by oxlint and oxfmt:

| Command                | What it does                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `npm run lint`         | `oxlint --deny-warnings --report-unused-disable-directives` — fails on any warning |
| `npm run lint:fix`     | Auto-fix what oxlint can                                                           |
| `npm run format`       | `oxfmt` — canonical formatting for every source file                               |
| `npm run format:check` | CI gate for formatting                                                             |
| `npm run verify`       | format:check → lint → typecheck → test → build                                     |

The lint config (`.oxlintrc.json`) enables the `correctness`, `suspicious`, and `perf` categories
across the `typescript`, `unicorn`, `import`, and `promise` plugins, plus targeted rules:
`no-unused-vars` (with `_`-prefix opt-out), `no-console` (allowing `warn`/`error` only),
`prefer-node-protocol`, `no-array-reduce`, `no-require-imports`, `import/no-duplicates`,
`promise/no-nesting`, and `promise/always-return`. Tests and scripts get a narrower rule set via
`overrides`. Anything intentionally outside the rules is marked inline with a reason
(`// oxlint-disable-next-line <rule> -- why`) rather than a blanket exclusion.
