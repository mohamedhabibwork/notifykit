# Architecture

The core contains only Web Platform APIs and generic contracts. SDK-backed providers live in individual entrypoints and dynamically load their optional peer dependency at creation time. `native` deliberately preserves provider-specific send options and responses. The manager owns named, lazy provider instances and closes only initialized providers.
