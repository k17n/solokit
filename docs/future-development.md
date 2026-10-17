# Future development

Status as of 2026-10-16: the invoice tool (editor, live PDF preview, themes, backup and restore) is merged to main. This file holds decisions and ideas that are not yet planned in detail. Tool ideas live in `ideas.md`.

## 1. Next tools (in suggested order)

Demand evidence is circumstantial: vendor pages, blogs and Product Hunt, not real Reddit or X threads. Check r/IndianFreelancers and r/developersIndia before committing.

1. **Quote / estimate generator.** Done 2026-10-16 as a document type inside the invoice tool (see `docs/superpowers/plans/2026-10-16-quotes-and-numbering.md`). Reuses the invoice editor, themes, PDF and storage. "Convert to invoice" button. No local-first, no-signup competitor found (Refrens, Ozydo and Ownly all need accounts).
2. **Payment tracker with reminders.** Record payments against invoices, mark overdue, generate WhatsApp/email reminder text. Late payment is the most repeated pain (a PayPal survey cited 61% of Indian freelancers unpaid at least once; vendor-reported). Automatic sending is a paid server feature.
3. **TDS and advance-tax tracker.** Log TDS per invoice, compare with Form 26AS, show advance-tax due dates. No free local tool found.
4. Lower priority: hourly-rate / project-pricing calculators (Harvest and SoloStack already offer free ones).

Sources: Peerlist (late payments, invoice clarity), Taxbuddy and Business Standard (26AS, 194J), Wisemonk (export payment window and LUT), Product Hunt listings.

## 2. Agentic layer over the tools

Feasible. The domain logic is already pure, typed and validated, so it can be exposed as tools. The agent calls the GST engine and never does tax maths itself.

Example asks: draft an invoice from a sentence, list who owes money, draft reminders for overdue invoices, convert a quote to an invoice, summarise billing and TDS for a quarter.

Where the model runs:

| Option | Privacy | Cost | Quality |
|---|---|---|---|
| In browser (WebLLM, Chrome built-in Gemini Nano) | Data stays on device | Free | Limited, heavy download |
| User's own API key | Data goes to the provider | User pays | Strong |
| Our server (paid tier) | Data goes through us | We charge | Strong |

Default to on-device; keep the others opt-in. The privacy page must then say exactly what is sent.

Safety rules:
- The agent drafts; a human confirms anything irreversible (issuing assigns a legal number; cancelling cannot be cleanly undone).
- Show the exact action before running it.
- Treat client-supplied text (emails, PDFs) as data, never instructions.
- Keep an audit log so actions can be reviewed and undone.

Suggested path: finish quotes and payment tracking first; build a small typed action layer over the domain functions (useful on its own; include it in the quote tool's plan); add a chat box with draft-and-confirm behind the user's own API key; offer on-device and hosted models later. Do not ship it as an autopilot: small models make form-filling mistakes.

## 3. Licence and monetisation (decision pending)

- True open source cannot forbid commercial use. To stop others monetising the code, use a source-available licence: PolyForm Shield (blocks competing products, allows internal use), PolyForm Noncommercial (blocks all commercial use) or Business Source License (converts to open source later). MIT/Apache gives maximum adoption but anyone can fork and sell it.
- Not legal advice. Pick one, then add `LICENSE`, a README section, the `license` field in each package.json, and a note that the SoloKit name and logo are not licensed. Fonts stay under their own OFL licences (`THIRD_PARTY_LICENSES.txt`). If outside pull requests are accepted, ask contributors to assign rights so relicensing stays possible.
- Pricing model, open-core style: the local-first tools stay free; paid features are those that need a server. Local code shipped to the browser cannot be gated.
  - Gateable: cloud sync and storage (encrypted), a synced brand kit (logo, colours, fonts, themes across devices and team), hosted invoice links on a custom domain, email sending and reminders, payment links, e-invoice IRN, team accounts.
  - Not gateable: anything that only runs in the browser, such as local themes and logos.
- Two-repo plan (decided 2026-10-17): this public repo holds the free app plus a small contract, `@solokit/platform`, with free defaults for entitlements, sync, sharing, messaging, payments, signing and UI slots. A separate private repo holds the server and the paid UI and supplies a plugin through a build-time alias or an authenticated runtime import. The public repo never imports from the private one. See `extension-points.md`. Built so far: the contract, free defaults, hidden slots in the invoice and agreement viewers, and a Plans placeholder that stays off (`SHOW_UPSELL`). Not built: any server, account, payment or network code.
- Paid server code must live in a separate private repo or package. If the server code is in a public repo, the paywall is only a promise.
- Needed before any paid tier: backend (Supabase or Cloudflare Workers/D1/R2), optional sign-in (the app stays usable without an account), an entitlements table fed by payment webhooks (Razorpay or Stripe), a `useEntitlement` hook (done, backed by the free default), a `CloudDataStore` behind the existing `DataStore` interface, and end-to-end encryption design. The privacy page currently says nothing is sent and must be updated.
- Model to learn from: HextaUI (MIT free core, paid Pro blocks served from a token-protected registry URL).

## 4. Open backlog from reviews

- No warning when leaving the editor with unsaved changes.
- Proforma invoices share the tax-invoice number series.
- The PDF export declaration mentions a LUT even when the profile has no LUT number (the editor warns).
- Onboarding Back button loses typed data.
- LogoField has no processing state or race handling; no focus management after onboarding.
- StoreProvider leaks a store on double effect and has no open timeout; a blocked IndexedDB upgrade silently falls back to memory.
- PDF: line-table header not repeated on continuation pages; amounts of Rs 1 crore or more can overflow fixed columns; no per-line Taxable column when both discount and tax apply.
- Invoice HSN/SAC not required on regular B2B lines; the SAC list is a short unverified helper.
- The logo data URL is duplicated in every invoice snapshot.
- Legal review of the reverse-charge wording.
- Site mono font to Geist Mono (JetBrains Mono lacks the rupee glyph).
- Lighthouse and accessibility audit, a headed-Chrome look at the PDF preview, and a hosting decision.
