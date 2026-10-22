# UX review and user journey breakdown

Reviewed 2026-10-21 on branch `ui-ux-improvements`, by walking the app in a browser at 1366px and 390px wide and reading the screen code under `apps/web/src`. The aim is a map to plan UX work from, not a fix list for one release.

## Who it is for

A freelancer, consultant or one-person business in India. Their job is: get paid (quote, invoice, chase), and protect themselves (NDA, services agreement). They are not accountants, often on a phone, and arrive from a search like "GST invoice generator free".

## The journey at a glance

| # | Stage | Where | What the person wants | How it goes today | Friction |
|---|---|---|---|---|---|
| 1 | Discover | `/` | "Is this free, safe, and does it do GST?" | Strong hero, trust strip, a live GST calculator, tool cards | Medium: the hero mock promises features that do not exist |
| 2 | Pick a tool | `/#tools`, header | Get to the invoice fast | "Create an invoice" CTA works; header CTA "Open a tool" only scrolls to the grid | Low |
| 3 | Set up the business | `/tools/invoice/` first run | Make the first invoice | GST status step, then the full profile form (about 25 fields) | **High** |
| 4 | Create the first document | Invoice editor | Fill in client and amount, see the total | One long form; items are last; totals and preview are empty until valid | **High** |
| 5 | Issue and send | Viewer | Get a PDF to the client | PDF download only | Medium |
| 6 | Get paid | — | Know who has paid and who owes | Not supported: status is draft, issued or cancelled | **High (gap)** |
| 7 | Repeat work | List, editor | Bill the same client again, convert a quote | Saved clients, duplicate, convert to invoice all work | Low |
| 8 | Agreements | `/tools/contract/` | An NDA before a project starts | Good: asks only for missing fields, can skip, sectioned editor | Low |
| 9 | Look after data | Backup tab, `/business/` | Not lose everything | Backup reminder after 30 days, restore on a fresh device | Medium: backup lives in three places |
| 10 | Several businesses | Header switcher, `/business/` | Keep two businesses apart | Works on desktop | Medium: switcher hidden on phones |

## Stage by stage

### 1. Discover (home page)

Works well
- Clear promise: "Paperwork for one-person businesses", free, no login, data stays on the device.
- The live GST example (`ReceiptDemo`) proves the core value in one interaction.
- "Coming soon" tools are listed separately, so the ready ones stand out.

Problems
- **The hero mock oversells.** `AppFrame` shows "Billed this quarter ₹4,86,200", "Paid / Sent" statuses, "Quick actions ⌘K", a sidebar app with Recent items and "Getting started 2 of 5". None of these exist. People who sign up for that and land on a long form feel misled. Either build the cheap ones (paid status, a getting-started checklist) or redraw the mock to match the real product.
- On a phone the mock collapses to just the calculator, which is good, but the page is very long (about 4,700px) before the footer; the "Local-first" section repeats the trust strip.
- The footer lists 4 coming-soon tools and 6 coming-soon countries: more "soon" than "ready" in the footer.

### 2. Pick a tool

- Header CTA "Open a tool" goes to `/#tools`, the same as the "Tools" link. Once someone has data, the CTA could be "New invoice" or resume where they left off.
- **On phones under 768px the header nav is hidden** (`SiteHeader.module.css`, `.nav { display: none }`) and there is no menu button. "Your business" and "Privacy" are unreachable except from the footer.
- No "recent documents" or "continue" entry point anywhere outside each tool.

### 3. Set up the business (biggest drop-off risk)

What happens on first visit to the invoice tool:
1. "How are you registered for GST?" three radio cards, then Continue.
2. "Your business details": the full `ProfileForm`, which **asks the GST question again** at the top, then name, GSTIN, PAN, UDYAM, full address, contact, website, logo, four brand colours, six bank fields, UPI, number prefix, LUT, default notes and terms. About 25 fields on one page before any value is delivered.

Problems
- The GST status is asked twice.
- Only name, address, city, state and GSTIN (if registered) are required (`PROFILE_REQUIREMENTS.invoice`), but the screen does not separate required from optional; it looks like a lot of work.
- The contract tool already has the better pattern: `RequiredFieldsStep` asks only for what is missing and offers "Skip for now". The invoice tool uses that compact step only when a profile already exists.
- "Already use SoloKit? Restore a backup" is a ghost button below the form, easy to miss for a returning user on a new device.

Direction
- Use `RequiredFieldsStep` for the invoice first run too (status plus 4 to 6 fields), drop people straight into the editor, and offer the rest (logo, bank, UPI, brand) later as a "Finish your profile" checklist, which is also what the hero mock already promises.
- Ask for bank or UPI at the moment it pays off: on the first issue, "Add how clients pay you so it prints on the invoice".

### 4. Create the first document (invoice editor)

What happens: pick Tax invoice, Quotation or Proforma, then one long form: Client (9 fields) → Invoice details → Supply (export, place of supply, reverse charge, exempt) → Payment (TDS, advance) → Notes, terms, theme → **Items** → Save draft / Issue. The right column shows "Totals: Fill in the details above to see the totals" and a hidden preview.

Works well
- Kinds are explained ("The usual order is Quotation → Invoice").
- Numbers are automatic, saved clients are offered, the error summary appears at the top and fields are marked.
- An unsaved-changes guard protects work.

Problems
- **Items, the thing being billed, come last**, after advanced tax options most freelancers never touch (reverse charge, exempt supply, export, TDS, advance).
- **No feedback while typing.** Totals and the preview stay empty until the form is valid, so the person never sees the GST split that the home page showed them. The preview is hidden by default.
- Place of supply is required and not filled from the client's state; the client's state is optional. Two state pickers for one fact.
- The error summary is not in screen order and its items are not links to the fields.
- On phones, totals and preview sit below the Issue button, after about 4,000px of form. No sticky total.
- A brand new client needs address line 1 and city before issuing, even when the person only wants a quick quotation.

Direction
- Reorder: Client → Items → Dates → "More options" (supply, TDS, advance, notes, theme) collapsed by default with a summary line.
- Compute totals from whatever is valid so far; show the preview by default on wide screens; a sticky total bar with the Issue button on phones.
- Default place of supply to the client's state (or the seller's state), and edit it under More options.
- Make error-summary items links, in screen order.

### 5. Issue and send

- The viewer offers download PDF, duplicate, cancel, convert. There is no share step: no `navigator.share`, no "copy email text", no WhatsApp. For an Indian freelancer, sending on WhatsApp or email is the real next step.
- There is no "what next" after issuing (for example "Download and send to Kite Labs", "Mark as sent").

Direction: an "Issued" success state with Download PDF, Share (Web Share API with the PDF file, works offline and keeps data local), and a prefilled email draft via `mailto:`.

### 6. Get paid (missing)

- `InvoiceStatus` is `draft | issued | cancelled`. There is no paid, part-paid or overdue, no outstanding total, no list sorted by due date. The home page mock shows "Paid" and "Billed this quarter", so people expect it.
- This is the step that brings people back every week, and it can stay fully local.

Direction: add Mark as paid (date, amount, method), an Overdue badge from the due date, and a small summary strip on the list (outstanding, overdue, paid this month).

### 7. Repeat work

Works well: saved clients, duplicate, convert quotation or proforma to invoice with links between them, kind filter.
Gaps: no search, no sort by client or date, no per-client view.

### 8. Agreements (contract tool)

The best journey in the product today:
- A clear "Template, not legal advice" note, three kinds with plain explanations and a "Not sure?" line.
- Only missing profile fields are asked, with "Skip for now"; it does not block someone who already has agreements.
- A numbered, sectioned editor, a review step, PDF, Word and a review pack.

Gaps: no link between an agreement and the invoices for the same client (for example "Start an invoice for this client" after a services agreement is final).

### 9. Look after data (backup)

- Backup appears as a tab in the invoice tool, a tab in the contract tool and a section on `/business/`. Same screen, three entry points, slightly different words. Make `/business/` the single home and let the tool tabs link there.
- The 30-day reminder only shows in the invoice list. A site-wide, dismissible reminder would protect contract-only users too.
- The "Your browser is not saving data" warning is good; keep it.

### 10. Your business and several businesses

- `/business/` is one very long page (about 5,400px): the full profile, backup and restore, and the business list. The in-page links ("This business", "Backup & restore", "Your businesses") help, but split sections or real tabs would be easier.
- The invoice tool also has a "Profile" tab with the same form; two places to edit one thing.
- On phones the header nav is hidden; check that the switcher is reachable and usable at 390px (it collapses to a static panel under 640px).

## Cross-cutting issues

1. **Navigation state is not in the URL.** Inside the tools, list, editor, viewer and tabs are React state (`View` in `InvoiceApp.tsx` and `ContractApp.tsx`). The browser Back button leaves the tool, a refresh returns to the list, and a document cannot be bookmarked. Use query or hash routes (`?doc=…&mode=edit`), which work with the static export.
2. **Page chrome is heavy inside tools.** Every tool screen repeats a big eyebrow, H1 and tagline (about 250px) above the tabs, and the full marketing footer (with the big "SoloKit" wordmark) below. Once someone is working, a compact tool header and a slim footer would give the form more room.
3. **Inline styles in screens** (`style={{ display: 'grid', gap: '1.5rem' }}`, `fontSize: '1.5rem'` headings) in `Onboarding`, `RequiredFieldsStep`, `InvoiceEditor` and others: spacing and type drift between screens. Move to shared layout primitives in `packages/ui` (Stack, PageSection, SectionHeading).
4. **Mobile.** No header menu; long single-column forms with no sticky actions; the preview is far below. Phones are likely the main device for this audience.
5. **Feedback and delight.** Saving and issuing give little confirmation. A short toast and a clear success state after issuing would help.
6. **Empty and loading states** are plain text ("Opening your invoices…"). Skeletons that match the final layout would feel faster.

## Suggested priorities

Ranked by impact on the first invoice and on coming back.

**P0: get to the first invoice fast**
1. Compact invoice onboarding (reuse `RequiredFieldsStep`; ask GST status once; everything else later).
2. Editor reorder: Client → Items → Dates → collapsed "More options".
3. Live totals and preview while typing; sticky total and Issue on phones.
4. Place of supply defaults from the client's state.
5. Mobile header menu.

**P1: bring people back**
6. Paid, part-paid and overdue status, plus a summary strip on the list.
7. Issued success state with Share and email draft.
8. URL-based navigation inside tools (Back button, refresh, bookmarks).
9. A "Finish your profile" checklist (logo, bank or UPI, brand theme) to replace the long form.

**P2: polish and consistency**
10. One home for backup on `/business/`; a site-wide backup reminder.
11. Compact tool header and slim footer on tool pages.
12. Layout primitives in `packages/ui` to replace inline styles.
13. Bring the home page mock in line with what exists, or build the parts it shows.
14. Search and sort in the document list; cross-links between agreements and invoices for the same client.

## Metrics to watch

Cloudflare Web Analytics only counts page views, so most of these need a privacy-safe, aggregate event (or are checked by hand in usability sessions):
- Time from landing on `/tools/invoice/` to the first issued invoice (target: under 3 minutes).
- Share of first-run visitors who finish setup.
- Share of issued invoices later marked paid (once paid status exists).
- Return visits per week per device.

## Update: setup first, then the app (2026-10-21)

Done on this branch:
- One business setup before any tool, at `/setup/`, in five steps (tax registration, business details, then optional logo and brand colours, payment details, invoice defaults). Tools no longer have their own profile form.
- "Get started" (home page hero and header) opens `/app/`, the app home. A new visitor is sent through setup first and lands back on `/app/` with a welcome; a returning visitor goes straight there. The app home shows the business, what is saved in each ready tool, a backup reminder, and the tools coming soon.

## Site or SPA: recommendation

Keep two halves, and make the second one a proper app:

| | Marketing site | The app |
|---|---|---|
| Pages | `/`, `/privacy/`, one landing page per tool (`/tools/invoice/` content for search) | `/app/` and everything under it |
| Rendering | Static HTML, indexed by search engines | Client-rendered, `noindex`, works offline |
| Chrome | Big hero, marketing footer | Compact app shell: sidebar or top bar with Home, Invoices, Agreements, Business, and the business switcher; slim footer |
| Navigation | Normal page loads | Client-side routes inside one shell, so the database, providers and switcher stay open and moving between tools is instant |

Why not one or the other:
- **Everything as one SPA** hurts the pages people find through search ("GST invoice generator free"): they need real HTML with content, fast first paint and no JavaScript wall. It also makes the first visit heavier.
- **Everything as separate pages (today)** reopens IndexedDB and every provider on each page load, cannot keep state between tools, and makes each tool page do two jobs at once: landing page (large hero, marketing footer) and workspace. The Back button and refresh also lose the place inside a tool, because list, editor and viewer are not URLs.

How to get there from here, in small steps:
1. **Done:** `/app/` as the app home behind "Get started".
2. **Done:** the tools moved into the app as `/app/invoice/` and `/app/contract/`, inside a shared app layout (`app/app/layout.tsx`) with the compact shell. Next.js keeps the layout mounted on client navigation, so providers and the database stay open. Links inside the app ask before leaving unsaved work.
3. Next: give each view a URL that works with the static export: `/app/invoice/?doc=<id>&mode=edit`, `/app/invoice/?new=quote`. Back, refresh and bookmarks then work.
4. **Done:** `/tools/invoice/` and `/tools/contract/` are landing pages again for search: what the tool does and a button into the tool in the app. Screenshots and an FAQ can follow.
5. **Done:** setup and Your business moved under the app shell (`/app/setup/`, `/app/business/`); the old addresses forward there.

Why a path and not a subdomain (`app.trysolokit.com`): everything is stored in the browser per origin, so a subdomain would start every existing user with an empty app unless their data is migrated across. Revisit only if the marketing site moves to another stack or accounts and server sync arrive.

This keeps search traffic, gives a fast app feel, and fits the current static export and offline service worker without a server.

## Update: website and SaaS app (2026-10-22)

- `/` is the website only: its header has Tools, How it works, Privacy and Get started, and nothing that reads a business.
- `/app/` is a SaaS-style app with a sidebar (business switcher, search with Ctrl/⌘+K, Home, Invoices, Agreements, Your business, coming soon) that becomes a drawer behind Menu on phones.
- The app home is a dashboard: a greeting, a search for tools and actions, quick actions that start a document, the five latest documents, the tools with what is saved in each, and the backup reminder.
- Tools open at a screen from a link (`?new=<kind>`, `?doc=<id>`), which the home's actions and Recent list use. This is the first part of step 3 above (URLs for every view); edit and view screens still do not change the address as you move inside a tool.
