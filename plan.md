# Electron + SQLite Migration Plan (Ate Lorie's POS)

## Goal
Migrate the current React + Vite POS app into a local desktop app using Electron and SQLite, with no required cloud hosting.

## Scope
- Keep existing UI and business workflows
- Add Electron desktop shell
- Replace cloud-dependent data paths with local SQLite services
- Maintain secure architecture (renderer isolated from DB/file system)
- Package as Windows installer

## Phase 1: Foundation (Electron Shell)
- Add Electron main process and preload script
- Keep current React/Vite renderer as frontend
- Configure secure defaults:
  - `contextIsolation: true`
  - `nodeIntegration: false`
- Create IPC bridge for renderer <-> main communication
- Confirm app boots in desktop window

**Deliverable:** Working Electron app loading existing POS UI.

## Phase 2: Local Database Setup (SQLite)
- Choose DB layer (`better-sqlite3` + Drizzle/Prisma)
- Define initial schema for core tables:
  - users/staff
  - menu_items
  - orders
  - order_items
  - payments
- Add migration workflow and seed script
- Store DB in Electron user data path

**Deliverable:** Local SQLite DB with migrations and initial seed data.

## Phase 3: Data Access Layer
- Implement DB services in Electron main process:
  - menu service
  - orders service
  - payments service
  - reporting queries
- Expose service methods via IPC handlers
- Keep renderer using typed API calls through preload

**Deliverable:** Core POS operations reading/writing local SQLite.

## Phase 4: Replace Cloud Dependencies
- Identify Supabase-dependent flows and map to local services
- Replace auth approach with local staff login (PIN/password)
- Remove/disable cloud-only env/config paths
- Validate all key screens:
  - Dashboard
  - POS checkout
  - Menu management
  - Order history

**Deliverable:** Fully local app behavior without required cloud backend.

## Phase 5: Reliability and Operations
- Add local backup + restore:
  - scheduled daily backup
  - manual export/import
- Add error logging and recoverability checks
- Add basic data integrity checks (transactions, constraints)

**Deliverable:** Ops-ready local desktop POS with backup strategy.

## Phase 6: Packaging and Pilot
- Configure app packaging (`electron-builder` or `electron-forge`)
- Generate Windows installer (`.exe`)
- Run pilot/UAT with real cashier workflow
- Fix pilot issues and finalize release checklist

**Deliverable:** Installable production-ready desktop app.

## Security Baseline
- Renderer has no direct DB or Node access
- All sensitive operations handled in main process
- Strict IPC allowlist
- Input validation for IPC payloads
- Secrets never exposed to renderer

## Testing Checklist
- App starts offline
- Login works locally
- CRUD menu items works
- Create/order/pay flow works
- Reports load from SQLite
- Backup and restore works
- Installer upgrade preserves DB

## Suggested Timeline (Estimate)
- Phase 1: 1-2 days
- Phase 2: 1-2 days
- Phase 3: 2-4 days
- Phase 4: 2-4 days
- Phase 5: 1-2 days
- Phase 6: 1-2 days

Total: ~8-16 working days (depending on feature complexity and testing depth).