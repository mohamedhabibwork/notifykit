# GitHub management

This repository is configured for automated quality checks, security scanning, dependency updates, and npm releases.

## Workflows

| Workflow            | Trigger                                | Purpose                                                                                                         |
| ------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| CI                  | Pushes to `main`, pull requests        | Checks formatting, linting, TypeScript 5.9/6/7, tests, and builds on Node 20/22/24/26.                          |
| Runtime smoke tests | Pushes to `main`, pull requests        | Runs the built fake-notifier smoke test on Bun and Deno.                                                        |
| CodeQL              | Pushes, pull requests, weekly schedule | Scans JavaScript and TypeScript for security problems.                                                          |
| Release             | `v*` tags or manual dispatch           | Verifies the project, publishes to npm, attaches signed provenance, and creates generated GitHub release notes. |
| Dependabot          | Weekly                                 | Opens updates for npm dependencies and GitHub Actions.                                                          |

## Release process

1. Update `package.json` with the intended semantic version.
2. Run `npm run verify` locally.
3. Merge the release commit to `main` and wait for CI, runtime smoke tests, and CodeQL to pass.
4. Create and push an annotated matching tag:

   ```sh
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin vX.Y.Z
   ```

5. Watch the **Release** workflow. It publishes with `npm publish --provenance` and creates a GitHub Release with an automatically generated changelog.
6. Confirm the version on npm and review the generated GitHub release notes.

For a manual run, select the **Release** workflow and provide an existing `v*` tag. The workflow checks out that tag, so its changelog and published package match the selected release.

The release workflow uses the `NPM_TOKEN` repository secret. Rotate the npm token in npm and update the GitHub secret when needed. Never commit a token or copy it into an issue, pull request, or workflow log.

## Recommended repository settings

Configure these in GitHub after the first release:

- Protect `main`: require pull requests and the **CI**, **Runtime smoke tests**, and **CodeQL** checks before merging.
- Restrict force pushes and branch deletion on `main`.
- Enable private vulnerability reporting and Dependabot alerts/security updates.
- Require two-factor authentication for package maintainers in npm.
- Set the `npm` GitHub Actions environment to require review for production releases when multiple maintainers are involved.
