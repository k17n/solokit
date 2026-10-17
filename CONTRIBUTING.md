# Contributing to SoloKit

Thank you for wanting to help. SoloKit is source-available under the [PolyForm Strict License 1.0.0](LICENSE). That licence does not by itself let anyone change or share the code, so contributions need the terms below.

## Contributor licence agreement

By opening a pull request or otherwise sending a contribution (code, text, data, design or translation), you agree that:

1. You wrote it, or you have the right to submit it, and it does not copy code under licences that conflict with these terms.
2. You grant the project owner (Kn1ghtF0x) a perpetual, worldwide, royalty-free, irrevocable licence to use, change, sublicense, relicense and distribute your contribution as part of SoloKit, under any licence the owner chooses, including commercial and proprietary ones.
3. You keep the copyright in your contribution, and you are not paid for it. Nothing here promises revenue sharing or a future paid role.
4. Your contribution is provided as is, without warranty.

If you cannot agree, please do not send a contribution. The owner may ask you to confirm the agreement in the pull request, or to sign it through a bot.

## Before you start

- Open an issue to discuss larger changes first.
- Money, tax and legal content needs extra care: GST rates and thresholds (`packages/tax-engines/src/in/rules.ts`), the SAC list, and contract clause text (`packages/tools/contract`) need a source for any change and an "as of" date, and are reviewed by the owner before merging.
- Paid features are out of scope for this repo: no payments, accounts, servers or hosted services. Changes to `packages/platform` (the extension contract, see `docs/extension-points.md`) need prior agreement because they are versioned.
- Do not add analytics, network calls or anything that sends user data off the device without prior agreement. SoloKit is local-first and its privacy page makes promises.

## Working on the code

    npm install -g pnpm
    pnpm install
    pnpm test
    pnpm typecheck
    pnpm e2e

Write tests first for behaviour changes, keep the existing code style, and keep copy plain and honest.

## Commits and pull requests

- Write short, imperative commit messages that say what changed and why.
- Do not add `Co-Authored-By` or tool-attribution lines to commit messages or pull request descriptions.
- Keep each pull request to one change, and make sure `pnpm test`, `pnpm typecheck` and `pnpm e2e` pass.

## Reporting security problems

Please do not post security problems in public issues. Contact the owner privately with the details.
