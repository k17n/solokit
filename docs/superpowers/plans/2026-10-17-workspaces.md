# Business workspaces - Stage A (data and platform layer)

Date: 2026-10-17. Branch: feat/workspaces. UI wording is "Business"; code says `workspace`.

Goal: a Business is the top-level container. Its details (name, address, tax ids, logo, brand colours) are entered once and reused by every tool. Each Business has its own data. Brand colours are suggested from the uploaded logo. Stage B builds the screens (switcher, create, rename, delete, progressive onboarding). Signature images are out of scope.

## Decisions

1. **One IndexedDB database per Business.** Isolation is physical: no query can leak across Businesses, and deleting one is `deleteDatabase`. The existing `solokit` database becomes the first Business, with no copying, so nothing can be lost in the migration.
2. **Registry** is a small separate database `solokit-workspaces` (v1; stores `workspaces` and `meta`). It lists `{id, name, createdAt, updatedAt, dbName, archivedAt?}` and holds the current id. The current id is also kept in `localStorage` (try/catch) as a synchronous convenience. If IndexedDB is unavailable or the registry cannot be opened, the registry falls back to memory and the first Business still points at `solokit` (or a memory store), so the app keeps working.
3. **Lazy, idempotent default.** `ensureDefault()` runs inside one readwrite transaction that creates the workspace with the fixed id `default` only if the registry is empty. Two tabs racing produce one row. Its `dbName` is the legacy `solokit` (fresh installs too: the database is created on first use anyway). Its name comes from the saved profile's business name, else "My business". New Businesses get id from an injected generator and `dbName = solokit-ws-<id>`.
4. **Delete.** Close our open store, then `deleteDatabase` (a `blocked` event is not an error by itself: other tabs close on `versionchange`; we wait up to a timeout, then fail with `StorageBlockedError`), then remove the registry row, then fix up current. Refuses to delete or archive the last active Business. Other tabs are told through a `BroadcastChannel`; a store that is still open elsewhere closes itself on `versionchange`, but would silently recreate an empty database on its next write, so the web provider reacts to the "removed" message by switching away.
5. **Profile package `@solokit/profile`** owns `BusinessProfile` (renamed from `SellerProfile`), `Address`, `BankDetails`, `Issue`, normalisation, validation, the profile repository, the colour maths (`contrastRatio`), `PROFILE_REQUIREMENTS` / `missingFields`, brand colour extraction and `suggestBrandTheme`. Callers import from it directly; `@solokit/tool-invoice` no longer re-exports these. The record keeps id `me` in the `profile` collection (no data migration); new `schemaVersion` plus `migrateProfile()` upgrade old records on read.
6. **Brand colours** are pure functions over RGBA pixels: median cut (deterministic, no random seeding), transparent pixels dropped, near-white, near-black and low-saturation pixels excluded from accent choice. `suggestBrandTheme` adjusts lightness minimally until text/background >= 4.5, accent/background >= 3 and white-on-accent >= 4.5 (so it passes `validateTheme` for every layout). `extractPaletteFromDataUrl` is a thin canvas wrapper that returns `null` when canvas is unavailable.
7. **Backup**: the file is the existing snapshot plus an optional `workspace: {name}` header (format version stays 1; old readers ignore the key, old files restore fine). `restoreIntoNewWorkspace` creates a Business, imports into its fresh database and rolls the Business back if the import fails.
8. **Web provider**: `WorkspaceProvider` resolves the current Business and mounts the existing `StoreProvider` (keyed by workspace id) over that Business's store, so `useStore()` keeps working. `useWorkspaces()` exposes the list and actions; `useStorage()` is the current Business's store state. Loaders for invoice and contract use it; nothing else changes.

## Tasks (test first, small commits)

1. Storage: `close()` on the IndexedDB store; workspace registry (`workspaces.ts`) with memory fallback, migration, create/rename/archive/delete, current id, backup header; tests with fake-indexeddb.
2. `@solokit/profile` package: move model, normalise, validate, repository, `contrastRatio`; schema version and migration; update all callers and tests.
3. `PROFILE_REQUIREMENTS` and `missingFields`.
4. Brand colours: palette, `suggestBrandTheme`, `extractPaletteFromDataUrl`; cross-check with the invoice `validateTheme`.
5. Backup header and `restoreIntoNewWorkspace`.
6. Web `WorkspaceProvider`, hooks, loaders; test; full suite twice, typecheck, build, e2e.

## Cross-tab and blocked handling

- Stores and the registry close their connection on `versionchange`, so one tab never blocks another's upgrade or delete.
- A delete that stays blocked past the timeout fails loudly and leaves the registry row in place.
- Registry changes are broadcast (`solokit-workspaces` channel); the provider reloads the list on any message.
- Known limit: a tab that still has the deleted Business open can recreate an empty database before it processes the broadcast. The registry row is gone, so the Business stays deleted from the user's point of view and the stray empty database is cleaned up on the next `delete`/startup sweep (not implemented in Stage A; documented for Stage B).
