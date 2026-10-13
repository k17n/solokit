# SoloKit: Platform and Invoice Generator (India MVP): Design

Date: 2026-10-13
Status: Draft for review

## 1. Goal

Build an extendable, ilovepdf-style suite of free tools for solopreneurs, freelancers and consultants. Tools share logic, components and services, and the suite can grow toward Zoho/Odoo-style breadth. The first tool is an **invoice generator compatible with Indian taxation**. Other countries are shown as "Coming soon".

Working brand name: **SoloKit** (single config value; repo stays `free-tools`).

## 2. Principles

- **Local-first, offline-capable.** All data lives on the user's device (IndexedDB). The app is a PWA. No accounts, no server in Phase 1.
- **Storage behind an interface**, so an optional cloud-sync adapter can be added later without rewriting tools.
- **Everything shared is a package.** A new tool is one folder plus one registry entry.
- **Money is integer paise**, never floats.
- **Tax rules are data**, with an "as of" date, behind a `TaxEngine` interface. Countries are plugins.

Roadmap: Phase 1 local-only; Phase 2 optional sync (ideally end-to-end encrypted or user's own Drive); Phase 3 server-dependent paid features (payment links, email, reminders, e-invoice IRN).

## 3. Architecture

Monorepo (pnpm workspaces + Turborepo), TypeScript, Next.js with static export.

```
apps/web/               Next.js static export, PWA, home grid + one route per tool
packages/
  ui/                   design system: tokens, components, Footer
  core/                 money, dates, numbering, validation, amount-in-words
  storage/              Storage interface + IndexedDB adapter
  pdf/                  client-side PDF export (shared)
  tax-engines/          TaxEngine interface; `in` implemented
  tools/invoice/        the invoice tool
docs/
```

The home page grid, routing, nav and per-tool SEO pages are generated from a **tool registry**. Each tool gets its own statically generated, indexable page.

## 4. Invoice generator (India MVP)

### 4.1 Seller types (chosen first during onboarding)
| Seller type | Document | Tax on invoice |
|---|---|---|
| Regular GST | Tax Invoice | CGST+SGST or IGST |
| Composition | Bill of Supply with mandatory composition declaration | None collected |
| Unregistered | Plain Invoice (optional note "Not registered under GST") | None |
| Exempt supplies (registered) | Bill of Supply | None |

Onboarding order: GST status, then goods or services, then details. The form hides fields that do not apply (GSTIN, HSN/SAC, place of supply, reverse charge are Regular-only). Unregistered is the simplest path. An informational threshold note says registration may become mandatory above turnover limits ("verify with your CA").

### 4.2 Core features
- **Seller profile** (saved once, reused across tools): name, address, state, GST status, GSTIN, PAN, optional UDYAM, logo, bank details, UPI ID.
- **Clients:** saved list with GSTIN, address, state.
- **Line items:** description, HSN/SAC (searchable list), quantity and **billing unit** (hours, days, fixed fee, retainer, items), rate, discount, GST slab (0/5/12/18/28).
- **GST engine:** GSTIN format and checksum validation, place of supply, CGST+SGST vs IGST, reverse-charge flag, round-off, amount in words in rupees (lakh/crore).
- **Consultant features:** optional **TDS** line (user-entered %, 10% suggested for professional fees) with net payable; **milestone/advance** invoicing (% of project, advance received); **export of services** (foreign currency such as USD/EUR/GBP, zero-rated under LUT with LUT number, optional reference INR value).
- **Numbering:** financial-year series (e.g. `2026-27/0001`), kept within the 16-character GST limit.
- **Output:** live preview, PDF download, UPI QR on the invoice.
- **Persistence:** invoices and clients in IndexedDB; JSON backup/restore from day one with a visible "last backed up" indicator.

### 4.3 Themes and logo
- **Theme = small JSON of design tokens**, one code path for presets and custom themes.
- **6 standard presets (read-only):** Classic, Modern, Minimal, Bold, Consultant, Formal. Each defines a fixed layout, table style and logo position.
- **Customisation is colour-only:** accent, text and background colours (plus a font pick from the bundled set, see 4.4). Layout is not user-editable. Users start from a preset, tweak colours with a live preview, and **Save as my theme**. They can duplicate, rename, delete and set a default, and override the theme per invoice.
- **Contrast check:** the colour picker warns on low text contrast.
- **Logo:** upload PNG/JPG/SVG/WebP via drag-and-drop or picker; resized and compressed in-browser (max about 600px wide); fit/size control; transparency preserved; previewed on light and dark backgrounds; stored as a blob once in the seller profile (shared by all tools). No logo falls back to a styled business-name wordmark.
- **One renderer** produces both the on-screen preview and the PDF so they match.
- Themes are included in the JSON backup.

### 4.4 Fonts (invoice documents)
- **Google Fonts only; no user font uploads** (avoids licensing issues).
- **Small bundled set** in three groups: **sans-serif, serif, monospace**. Candidate list, confirmed in the implementation plan after a licence and glyph check: Sans: Inter, Poppins; Serif: Lora, Merriweather; Mono: JetBrains Mono, IBM Plex Mono.
- **Latin character set only** (Latin + the rupee sign U+20B9, which Google places in latin-ext, so fonts are subset explicitly). Every bundled font must contain ₹. Indian-script fonts are out of scope for now.
- **Self-hosted and cached by the service worker** (offline, and no requests to Google's servers, which also avoids GDPR exposure).
- Ship each font's licence text (`THIRD_PARTY_LICENSES`), keep copyright notices, do not rename modified fonts, and check Reserved Font Names per font. All candidates are OFL or Apache 2.0, which permit PDF embedding and bundling.
- A "browse all Google Fonts" online picker is a possible future enhancement, not in this scope.

### 4.5 Out of scope
E-invoice IRN, e-way bill, email sending, payment collection, other countries (country picker shows "Coming soon"), Indian-script fonts, user-uploaded fonts, layout editing, theme sharing/import-export as standalone files (may follow).

## 5. Brand and visual direction (site UI)
- **Palette:** deep ink navy `#0B1B3A` base, emerald `#10B981` primary/success, warm amber `#F5B54A` highlight, warm off-white `#FAF8F4` background. Dark mode via the same tokens.
- **Site fonts:** Bricolage Grotesque (headlines), Geist or Inter (UI), JetBrains Mono (amounts and invoice numbers). These are separate from the invoice font set and also bundled.
- **Look:** paper-like cards with subtle grain, tool tiles with small illustrated icons, trust strip: "Free · No signup · Works offline · Your data stays on your device".
- **Footer:** dark navy with a giant cropped wordmark and an emerald-to-amber gradient glow; columns for Tools, Countries and Company; "Made in India" line; privacy badge; animated "Back to top".

## 6. Testing and quality
- Vitest unit tests: tax engine (intra/inter-state, slabs, round-off, reverse charge, export/LUT, TDS), numbering, amount-in-words, GSTIN validation, money arithmetic.
- Playwright smoke test: fill form, PDF downloads, reload, data persists.
- Verification that every bundled font renders ₹ in the PDF.
- Lighthouse performance, accessibility and PWA/offline checks.
- Tax rates and thresholds live in a data file with an "as of" date; the UI carries a "verify with your CA" note.

## 7. Open items resolved in the implementation plan
- Final bundled font list (licence and ₹ glyph verification).
- PDF rendering approach (single layout used for both preview and PDF).
- HSN/SAC dataset source and size.
- Hosting target (GitHub Pages, Netlify or Cloudflare Pages).
