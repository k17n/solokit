# Deploying SoloKit on Cloudflare Pages

SoloKit is a static site: `pnpm build` writes everything to `apps/web/out`, and Cloudflare Pages serves that folder. There is no server code. Headers, cache rules and the Content-Security-Policy live in `apps/web/public/_headers`, which the build copies to `apps/web/out/_headers`; Pages reads it on deploy.

Nothing here has been done for you: creating the Cloudflare project, the analytics site and the domain needs your Cloudflare login.

## 1. Create the Pages project

1. Push the repository to GitHub (it can stay private).
2. In the Cloudflare dashboard open **Workers & Pages > Create > Pages > Connect to Git**, authorise GitHub and choose the repository.
3. Build settings:
   - Framework preset: **None** (do not pick Next.js; that preset targets server rendering).
   - Build command: `pnpm install --frozen-lockfile && pnpm build`
   - Build output directory: `apps/web/out`
   - Root directory: leave empty (the repository root; this is a pnpm workspace and the build needs all packages).
4. Environment variables (Settings > Variables and Secrets, add to **Production** and, where noted, **Preview**):

   | Name | Value | Notes |
   | --- | --- | --- |
   | `NODE_VERSION` | `22` | Next.js 16 needs Node 20.9 or newer. |
   | `PNPM_VERSION` | `12.11.2` | Same as `packageManager` in the root `package.json`, which is the pin that matters. If a build says pnpm is missing or the wrong version, this variable (or `corepack enable` in the build command) fixes it. |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain.example` | No trailing slash. Used for the sitemap, `robots.txt` and share previews. Without it they point at a placeholder. Set on Production and Preview. |
   | `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` | the token from step 2 | **Production only.** Leave it unset on Preview so test deployments are not counted. Changing it needs a new build, because it is baked into the pages. |

5. Save and deploy. The first deploy gets a `*.pages.dev` address; check it before adding the domain.

If you change the pnpm or Node version later, change `packageManager` and these variables together.

## 2. Create the analytics site and token

1. **Analytics & Logs > Web Analytics > Add a site**.
2. Enter your hostname (the custom domain, or the `*.pages.dev` one while testing).
3. Choose the manual option (the JavaScript snippet). Copy the token: it is the 32-character value in `data-cf-beacon='{"token": "..."}'`. Paste only the token into `NEXT_PUBLIC_CF_ANALYTICS_TOKEN`; the site adds the script itself.
4. Do **not** also enable the automatic installation ("Enable" on the Pages project, or the one-click setup, which injects the same beacon at Cloudflare's edge). Two beacons would count every visit twice. If it is already on, switch it off (Pages project > **Metrics / Web Analytics** section, or the site's entry under Analytics & Logs; the dashboard labels move around). We load the script from code so that it is off unless a token is configured, and off for visitors who send Do Not Track or Global Privacy Control.

How the site loads it: `apps/web/src/analytics/`. A production build with a token adds one deferred `beacon.min.js` script. Dev, tests and builds without a token send nothing. If the visitor is offline or blocks the script, nothing happens and the app works the same. The code never reads anything on a tool screen and there are no custom events; keep it that way, because the privacy page promises it.

Navigation between pages uses plain links and full page loads (the static export has no client-side router links), so the beacon's default one page view per load is right. The beacon's single-page-app mode is deliberately **not** enabled: it is for sites that change the address without reloading, this one does not, and turning it on without need risks double counts. If client-side navigation (`next/link`, `router.push`) is ever added, revisit this and the service worker's note about stale chunks together.

## 3. Custom domain

1. In the Pages project open **Custom domains > Set up a custom domain** and enter the domain (for example `solokit.example`).
2. If the domain's DNS is on Cloudflare, accept the record it proposes. Otherwise add the CNAME it shows at your DNS provider, or move the domain's nameservers to Cloudflare.
3. Wait for the certificate (usually minutes). HTTPS is required: the service worker and install prompt only work on HTTPS.
4. Set `NEXT_PUBLIC_SITE_URL` to this address and redeploy. Add the same hostname to the Web Analytics site from step 2 if you created it for the `pages.dev` address.
5. Optional: redirect `www` to the bare domain (a Cloudflare redirect rule), and submit `https://your-domain/sitemap.xml` in Google Search Console.

## 4. Reading the numbers

**Analytics & Logs > Web Analytics**, choose the site, then pick the time range (last 7 days, 30 days, or a custom range).

- Overall visitors per day: the main chart shows visitors and page views over time; the range selector sets the granularity (days for ranges up to a few weeks).
- Per tool: add a filter on **Path** with the tool's address, for example `/tools/invoice/` or `/tools/contract/`. The chart and the Top pages table then cover only that tool. Compare tools in the **Top pages** table without filters.
- Other filters: referrer, country, device type, browser.

Limits to keep in mind:

- Visitor counts are estimates from a cookie-free approach: the same person on two devices or two networks counts twice, and a returning visitor on a later day is a new visitor.
- There are no custom events, so you cannot count "invoices created" or "PDFs downloaded", only page views of `/tools/<slug>/`. Opening a tool is the signal you get. The in-tool tabs do not change the address, so they do not appear.
- Sessions in the installed app while offline are not counted (the script cannot load), and visitors with Do Not Track, Global Privacy Control or an ad blocker are not counted either. Treat the figures as a floor.
- Preview deployments are not counted when the token is only set on Production.

## 5. Caching and updates

`_headers` makes pages, `sw.js` and the manifest revalidate on every visit, and caches `/_next/static/*` (fingerprinted) and `/fonts/*` for a year as immutable. This is what lets a new deploy reach visitors: `sw.js` is fetched fresh, notices the new build id, precaches the new site, and replaces the old cache. If you replace a font file, give it a new file name, because fonts are cached as immutable.

`sw.js` must stay at the site root: its scope is the folder it is served from. The test `apps/web/src/headers.test.ts` and the e2e spec `apps/web/e2e/hosting.spec.ts` check this, the headers and that the Content-Security-Policy does not block the app.

`_redirects` is not needed. The export uses trailing slashes (`/privacy/`), and Pages redirects `/privacy` to `/privacy/` by itself. The `404.html` page is served for unknown addresses.

### The Content-Security-Policy

Kept deliberately tight: this site, `blob:` for the PDF preview, `data:` images, and the two analytics hosts. Two looser parts are needed by the app and were found by running the e2e suite under the policy: `'unsafe-inline'` scripts and styles (Next's static export inlines hydration data, and a static host cannot add per-request nonces) and `'wasm-unsafe-eval'` plus `data:` in `connect-src` (the PDF layout code is a WebAssembly module embedded as a data address). Plain `eval` stays blocked. If you add a new third-party host, add it to the policy and to the test, and update the privacy page.

Run `pnpm e2e` after any change to `_headers`: the test server (`apps/web/scripts/serve-with-headers.mjs`) applies the same rules, and `pnpm preview` serves the build the same way on http://localhost:4173.

## 6. Pre-launch checklist

- [ ] `NEXT_PUBLIC_SITE_URL` set to the real address; open `/robots.txt` and `/sitemap.xml` and check they show it.
- [ ] `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` set on Production only; automatic Web Analytics injection is off; after the first visit a page view appears in the dashboard within a few minutes.
- [ ] Visit with Do Not Track on (browser setting) or with a Global Privacy Control extension: `beacon.min.js` must not appear in the Network panel.
- [ ] Open `/privacy/` and read it once: it must still match what the site does (cookie-free counting by Cloudflare Web Analytics, nothing typed is collected).
- [ ] Open an unknown address such as `/nope/`: the 404 page shows.
- [ ] In Chrome DevTools > Application > Service Workers, the worker is active and the site loads with the network switched off (Network > Offline).
- [ ] Create an invoice and a contract on the live site, preview and download both (this exercises the CSP).
- [ ] Licence: the repository is PolyForm Strict (source-available, noncommercial). Decide whether that fits running a public product, and whether the repository should be private before connecting it. See `LICENSE` and the README.
- [ ] Check the footer's tax-rules date and the "not tax or legal advice" wording are current.
- [ ] Add a share image (Open Graph image) if you want previews with a picture; none is included yet.
- [ ] Re-run `pnpm test`, `pnpm typecheck` and `pnpm e2e` on the commit being deployed.

## Deploying from the command line (how the first deploy was done)

The first deploy used Wrangler's direct upload, with no GitHub connection:

1. `npx wrangler login` (approve in the browser; run once per machine).
2. Build with the real address: `NEXT_PUBLIC_SITE_URL=https://solokit-9lh.pages.dev pnpm build` (add `NEXT_PUBLIC_CF_ANALYTICS_TOKEN=<token>` once the analytics site exists; both values are baked in at build time).
3. Run Wrangler from outside the repo, because it refuses to guess a project at a pnpm workspace root:
   `wrangler pages deploy <path to apps/web/out> --project-name solokit --branch main`

Notes:
- The project was created with `wrangler pages project create solokit --production-branch main --force`. `--force` is needed once, because newer Wrangler tries to create a Workers project instead of a Pages project. Later commands do not need it.
- Cloudflare gave the project the address `solokit-9lh.pages.dev` because `solokit.pages.dev` was taken.
- A direct upload does not redeploy when you push to GitHub. To get automatic deploys, connect the GitHub repository to a new Pages project in the dashboard (section 1 above).
- After a deploy, check `/`, a tool page and `/sw.js` return 200, and that the service worker caches all precache files (about 10 seconds on a first visit) before testing offline.
- `/favicon.ico` returns 404 because the site uses `icon.svg`; this is harmless.
