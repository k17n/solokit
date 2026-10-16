# Themes and Backup Implementation Plan (Plan 3C-3 of 3)

**Goal:** Theme picker/editor with live PDF preview and per-invoice theme, backup download and restore screens with an honest unencrypted-file warning, dark/mobile checks, and browser tests.

**Approach (test first, small commits):**

1. `inspectBackup` in `packages/tools/invoice` (backup.ts): validates a backup file's shape (version, collections, invoice/client/theme record shapes) and returns a summary of what it holds. `restoreBackup` uses it, so bad files are rejected before the atomic `importAll`.
2. `themeEditing.ts` (web, pure): sample invoice for previews, unique copy names, normalised hex input, warnings from `validateTheme`.
3. `ThemesScreen`: list of 6 presets (read-only) plus my themes; edit accent/text/background/font of the selected theme; contrast warnings; live preview via `usePdfPreview`/`PdfPreview`; Save as my theme, Save changes (rename), Duplicate, Delete (two-step), Set as default (settings).
4. Theme flow gaps: the editor falls back to the default (then Classic) when an invoice or the settings point to a deleted theme, so the select never shows an empty value; deleting the default theme resets it.
5. `BackupScreen`: download (createBackup only when the click happens), last-backup indicator, unencrypted warning, restore from file with validation, summary, explicit confirmation, errors. `InvoiceList` shows an `isBackupDue` banner. The non-persistent-storage warning mentions downloading a backup. App gets "Themes" and "Backup & restore" nav buttons.
6. Playwright screenshots (light/dark, desktop/390px) reviewed by eye; fix layout defects.
7. e2e: theme create/use then issued PDF check; backup then restore into a fresh context. Offline create/download is already covered in `invoice.spec.ts`.
8. README status and privacy copy updated so claims are true.

Constraints as in earlier plans: plain nav buttons with `aria-current`, two-step inline confirms, no `window.confirm`, honest copy, commit trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
