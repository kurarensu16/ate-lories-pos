# Desktop Local POS: Updated Tech Stack and Architecture

## Updated Tech Stack (Electron + SQLite)

- **App shell:** Electron
- **Frontend UI:** React + TypeScript + Vite
- **Styling/UI:** Tailwind CSS, clsx, tailwind-merge, lucide-react
- **Routing:** react-router-dom
- **Client state:** zustand
- **Server/cache state:** @tanstack/react-query
- **Charts/reporting UI:** recharts
- **Local database:** SQLite (single local `.db` file)
- **DB access layer:** Drizzle ORM or Prisma (pick one)
- **Electron SQLite driver:** better-sqlite3 (recommended for POS speed)
- **Validation:** zod (recommended)
- **Packaging/build:** electron-builder (or electron-forge)

## Target Architecture

### 1) Process Layout

- **Electron Main Process**
  - Manages app lifecycle and window creation
  - Initializes database and runs migrations
  - Hosts secure IPC handlers (`ipcMain.handle`)
  - Handles backup/export jobs

- **Electron Preload**
  - Exposes a safe API to the renderer with `contextBridge`
  - Prevents direct Node access from the UI

- **Renderer (React App)**
  - Runs POS, dashboard, menu, and reports screens
  - Calls `window.api.*` from preload, not SQLite directly
  - Uses React Query and Zustand for data flow/state

### 2) Data Flow

`React UI -> Preload API -> IPC -> Main Process Services -> SQLite`

This keeps file system and database operations out of the browser layer.

### 3) Suggested Module Structure

- `main/db/` - connection, migrations, seed (optional)
- `main/services/` - orders, payments, menu, inventory logic
- `main/ipc/` - IPC channel handlers and contracts
- `renderer/src/features/` - feature-based UI modules
- `shared/types/` - shared DTOs/types between main and renderer

## Local-First Data and Operations

- Store the DB file under Electron user data path (`app.getPath('userData')`)
- Add scheduled local backups (daily) and manual export/import
- Keep receipts/logs local; add printer integration as needed
- Use local staff authentication table (PIN/password), no cloud auth required
- Run fully offline by default
- Keep cloud sync as a future optional feature

## Security Baseline

- `contextIsolation: true`
- `nodeIntegration: false`
- Strict preload API surface (allowlist only)
- Parameterized queries via ORM/query builder
- Keep secrets out of renderer/client-exposed environment variables

## Deployment Model

- Ship as a Windows installer (`.exe`) with bundled Electron app
- On first run: create SQLite DB and apply migrations automatically
- No cloud hosting required for core operation
- Optional LAN/shared-server sync can be phase 2

## Recommended Implementation Phases (High-Level)

1. Add Electron shell and preload bridge around existing React/Vite app
2. Introduce SQLite + ORM and migrate core entities (users, menu, orders)
3. Replace Supabase-dependent flows with local services via IPC
4. Add backup/export/restore and basic operational tooling
5. Package installer and run pilot in real cashier workflow
