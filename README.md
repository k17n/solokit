# SoloKit

Free, local-first tools for freelancers, consultants and solopreneurs. Everything runs in the browser, works offline, and keeps your data on your device; the service worker precaches the whole site at build time so it is fully usable offline. India (GST) comes first; other countries are coming soon.

## Status

- Done: monorepo, core primitives, India GST/TDS engine, design system, app shell, tool registry, local storage layer, installable offline site.
- Done: invoice editor with live PDF preview, issuing, PDF download, and the invoice list (kind badge and filter, duplicate, cancel).
- Done: invoice themes (six presets, your own colours and font, default and per-invoice choice) and the backup and restore screens (unencrypted JSON file, reminder after 30 days, restore on a fresh device).
- Done: quotations and proforma invoices inside the invoice tool, each with its own number series (tax invoices keep theirs), a validity date on quotations, and Convert to invoice. A quotation is an estimate, not a tax invoice, and carries no tax-invoice wording.
- Done: contract and NDA generator at /tools/contract/. Mutual and one-way NDAs and a freelance services agreement, a numbered editor (parties, key terms, optional clauses, jurisdiction and stamp duty note, review), PDF, editable Word and a Review pack for a lawyer, final/reopen, backups that carry agreements. Your details come from the shared business profile and saved clients; a new Business is asked only for name, address and email, and you can skip that and type them. A template, not legal advice.
- Done: Business workspaces at /business/. Each Business is a separate local database (the existing data became the first one); the site header has a switcher, and Your business holds the details every tool shares (name, address, tax ids, logo, payments, defaults), brand colours suggested from the logo with a one-click brand theme, backup and restore per Business (restore as a new Business is the default when the device has data), and rename, archive and delete (delete erases a Business from this device only, after typing its name). Each tool asks only for the profile fields it needs and does not have yet. See `docs/superpowers/plans/2026-10-17-workspaces.md`.
- Next: more tools and countries.

## Licence

SoloKit is **source-available**, not open source. The code is public so you can read it, learn from it and try it, under the [PolyForm Strict License 1.0.0](LICENSE).

- Allowed: read the code, and run it for noncommercial purposes (personal use, study, hobby projects, charities, schools, public bodies).
- Not allowed: distributing it, changing it or building new works from it, or using it commercially, without written permission from the copyright holder.
- The names SoloKit and its logo are not licensed. Do not use them for other products or services.
- Bundled fonts and third-party libraries keep their own licences (see `apps/web/public/fonts/invoice/THIRD_PARTY_LICENSES.txt`).

This is not legal advice. To ask for permission, such as a commercial licence, open an issue or contact the owner.

See [CONTRIBUTING.md](CONTRIBUTING.md) before sending a pull request.

## Layout

- `apps/web` the website (Next.js, static export, installable PWA)
- `packages/core` country-agnostic primitives (integer-paise money, amount in words, invoice numbering)
- `packages/tax-engines` `TaxEngine` interface, country list, India GST engine
- `packages/ui` design tokens and shared components (header, footer, buttons, form fields, radio cards, notices)
- `packages/registry` the list of tools; drives the home page, tool routes and footer
- `packages/storage` `DataStore` interface with IndexedDB and in-memory adapters, and the Business (workspace) registry
- `packages/profile` the Business profile shared by all tools: model, validation, saved record, what each tool needs from it, and brand colour extraction from a logo
- `packages/tools/invoice` the invoice tool's domain logic: data model, validation, document builder, themes, saved data, backup
- `packages/tools/invoice-pdf` renders invoices to PDF in the browser (six layouts, bundled fonts, UPI QR); fonts are built with `pnpm --filter @solokit/web fonts`
- `packages/tools/contract` the contract tool's domain logic: clause library as data, model, validation, document and review-pack builders, saved data, stamp-duty pointers
- `packages/tools/contract-export` renders agreements to PDF, Review pack PDF and editable DOCX in the browser (reuses the invoice fonts and themes)
- `docs/legal-content-notes.md` every legal assumption and default in the contract templates, for a lawyer's review
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
