# SoloKit

Free, local-first tools for freelancers, consultants and solopreneurs. Everything runs in the browser, works offline, and keeps your data on your device; the service worker precaches the whole site at build time so it is fully usable offline. India (GST) comes first; other countries are coming soon.

## Status

- Done: monorepo, core primitives, India GST/TDS engine, design system, app shell, tool registry, local storage layer, installable offline site.
- Done: invoice editor with live PDF preview, issuing, PDF download, and the invoice list (duplicate, cancel).
- Next: invoice themes and the backup export and restore screens.

## Layout

- `apps/web` the website (Next.js, static export, installable PWA)
- `packages/core` country-agnostic primitives (integer-paise money, amount in words, invoice numbering)
- `packages/tax-engines` `TaxEngine` interface, country list, India GST engine
- `packages/ui` design tokens and shared components (header, footer, buttons, form fields, radio cards, notices)
- `packages/registry` the list of tools; drives the home page, tool routes and footer
- `packages/storage` `DataStore` interface with IndexedDB and in-memory adapters
- `packages/tools/invoice` the invoice tool's domain logic: data model, validation, document builder, themes, saved data, backup
- `packages/tools/invoice-pdf` renders invoices to PDF in the browser (six layouts, bundled fonts, UPI QR); fonts are built with `pnpm --filter @solokit/web fonts`
- `docs/ideas.md` backlog of tool ideas
- `docs/superpowers/specs` design specs
- `docs/superpowers/plans` implementation plans

## Develop

    npm install -g pnpm
    pnpm install
    pnpm dev          # http://localhost:3000
    pnpm test
    pnpm typecheck
    pnpm build        # static site in apps/web/out
    pnpm preview      # http://localhost:4173 (serves apps/web/out; try the offline mode here)
    pnpm e2e          # builds, then runs the browser tests (uses the Chrome installed on your machine)

The service worker is stamped with the list of built files after `next build` and only registers in production builds, so test offline behaviour with `pnpm build` then `pnpm preview`.

Add a tool by creating its package under `packages/tools/` and adding one entry to `packages/registry/src/tools.ts`.

Tax rates and thresholds are data (`packages/tax-engines/src/in/rules.ts`) with an "as of" date. They are not tax advice; verify with a chartered accountant.
