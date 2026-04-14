# ORM Decision: Electron + SQLite

## Compared Options

### Drizzle + better-sqlite3
- SQL-first and explicit schema control
- Lightweight runtime with minimal abstraction
- Great fit for Electron main-process execution

### Prisma + SQLite
- Strong developer ergonomics and generated client
- Heavier runtime/tooling for desktop bundling
- More setup for binary compatibility in packaged builds

## Decision

Use `better-sqlite3` as the primary runtime driver for this migration phase, with SQL repositories in Electron main process.

## Why

- Keeps desktop runtime small and deterministic.
- Works reliably in packaged Windows builds.
- Supports transactional order and payment writes with minimal overhead.
- Allows incremental introduction of Drizzle later if stronger schema tooling is required.
