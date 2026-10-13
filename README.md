# SoloKit

Free, local-first tools for freelancers, consultants and solopreneurs. Everything runs in the browser, works offline, and keeps your data on your device. India (GST) comes first; other countries are coming soon.

## Status

- Done: monorepo, money/numbering/amount-in-words primitives, India GST/TDS engine.
- Next: storage, design system and app shell, then the invoice generator UI.

## Layout

- `packages/core` country-agnostic primitives (integer-paise money, amount in words, invoice numbering)
- `packages/tax-engines` `TaxEngine` interface, country list, India GST engine
- `docs/ideas.md` backlog of tool ideas
- `docs/superpowers/specs` design specs
- `docs/superpowers/plans` implementation plans

## Develop

    npm install -g pnpm
    pnpm install
    pnpm test
    pnpm typecheck

Tax rates and thresholds are data (`packages/tax-engines/src/in/rules.ts`) with an "as of" date. They are not tax advice; verify with a chartered accountant.
