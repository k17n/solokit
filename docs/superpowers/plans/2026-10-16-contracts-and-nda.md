# Contract and NDA generator - Stage A (domain and renderers)

Date: 2026-10-16. Branch: `feat/contracts-nda`. Registry slug `contract` (stays `coming-soon` until Stage B ships the UI).

## Goal

Generalised, neutral, plain-English templates for (1) an NDA, mutual or one-way, and (2) a freelance services agreement, with a "Review pack" export so the user can send the document to a lawyer. Fully offline, no AI, no server. Honest "template, not legal advice, have it reviewed" notices everywhere. Stage A has no UI; Stage B builds it.

## Decisions

- **Two packages, like invoice.** `@solokit/tool-contract` (domain: clause library as data, model, validation, document and review-pack builders, repositories, backup checks, stamp-duty data) and `@solokit/tool-contract-export` (renderers: PDF with react-pdf, DOCX with `docx`, review pack). Renderers live apart so the domain stays light and testable without react-pdf. They are named "export" rather than "pdf" because DOCX lives there too.
- **Clause library is typed data**, not code in renderers: `clauses`, `options`, `variables`, `questions`, `assumptions`, `notes`. Templates use `{{variable}}`, `{{a}}`/`{{b}}` (party defined terms), `{{ref:clause-id}}` (cross reference). A missing variable or a reference to an absent clause is an error, never blank text.
- **Storage.** New `contracts` collection in `@solokit/storage` (IndexedDB version 1 -> 2 so existing devices get the new object store). Old backups without `contracts` still restore (they simply clear it). The invoice package's backup checker validates contract records, so `@solokit/tool-invoice` depends on `@solokit/tool-contract` for that one function.
- **Review pack** = agreement + review summary (choices, assumptions, defaults left unchanged, key dates, plain-language per-clause explanation, questions for the lawyer derived from options, notice).
- **No invented law.** Only the Arbitration and Conciliation Act 1996 is named. State-specific stamp duty: data file with `verify` flags and a pointer text, no amounts.
- **No post-term non-compete clause is offered.** A note explains why.

## Tasks (test first, one small commit each)

1. Plan (this file).
2. Storage: `contracts` collection, IndexedDB v2 upgrade test, snapshot and contract tests.
3. Package scaffold, model types, template engine (substitution, conditions, numbering, cross-references).
4. Variables, options, clause library (NDA and services), questions, assumptions, notes; library integrity tests.
5. Validation with per-field issues.
6. Document builder, review summary, key dates, stamp-duty data.
7. Repositories (draft/final lock, duplicate) and backup checks (invoice backup integration, round trip, old backups).
8. Export package: PDF renderer, review pack PDF, DOCX renderer, browser-bundle check.
9. `docs/legal-content-notes.md` (every assumption and default, kept in sync by a test), README and registry notes.
10. Full `pnpm test`, `pnpm typecheck`, `pnpm build`.
