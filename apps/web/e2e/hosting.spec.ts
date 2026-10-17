import { expect, test, type Page } from '@playwright/test';
import { FIRST, SECOND, fillJurisdiction, fillParty, gotoContract, startAgreement } from './contract-helpers';

// The e2e server applies out/_headers (scripts/serve-with-headers.mjs), so these run under the real Cloudflare Pages
// headers and Content-Security-Policy.

function watchViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/content security policy|refused to/i.test(message.text())) violations.push(message.text());
  });
  page.on('pageerror', (error) => violations.push(error.message));
  return violations;
}

test.describe('hosting headers', () => {
  test('pages carry the security headers and revalidate; build output is cached for a year', async ({ request }) => {
    const home = await request.get('/');
    expect(home.headers()['x-frame-options']).toBe('DENY');
    expect(home.headers()['x-content-type-options']).toBe('nosniff');
    expect(home.headers()['content-security-policy']).toContain('https://static.cloudflareinsights.com');
    expect(home.headers()['cache-control']).toBe('public, max-age=0, must-revalidate');

    const sw = await request.get('/sw.js');
    expect(sw.headers()['cache-control']).toBe('no-cache');
    expect(sw.headers()['content-type']).toContain('javascript');

    const html = await (await request.get('/')).text();
    const chunk = html.match(/\/_next\/static\/[^"']+\.js/)?.[0];
    expect(chunk).toBeTruthy();
    expect((await request.get(chunk!)).headers()['cache-control']).toContain('immutable');
  });

  test('the service worker registers at the root and controls the whole site', async ({ page }) => {
    const violations = watchViolations(page);
    await page.goto('/');
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toBe('http://localhost:4180/');
    expect(violations).toEqual([]);
  });

  test('the pages, the 404 page and a PDF preview load without any policy violation', async ({ page }) => {
    const violations = watchViolations(page);
    for (const path of ['/', '/privacy/', '/business/', '/tools/invoice/', '/tools/rate-calculator/']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
    }
    const missing = await page.goto('/no-such-page/');
    expect(missing?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'That page does not exist' })).toBeVisible();

    await gotoContract(page);
    await startAgreement(page, 'Mutual NDA');
    await fillParty(page, 1, FIRST);
    await fillParty(page, 2, SECOND);
    await page.getByLabel('Purpose of sharing the information').fill('evaluating a possible website redesign project');
    await fillJurisdiction(page, 'Mumbai', 'Maharashtra');
    await page.getByRole('button', { name: 'Show preview' }).click();
    await expect(page.locator('iframe[title="Agreement preview"]'), violations.join(' | ')).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(1000);
    expect(violations).toEqual([]);
  });

  test('sends nothing to Cloudflare in a build without a token, and the policy would allow the beacon', async ({ page }) => {
    const contacted: string[] = [];
    await page.route(/cloudflareinsights\.com/, (route) => {
      contacted.push(route.request().url());
      return route.fulfill({ contentType: 'text/javascript', body: 'window.__beaconLoaded = true;' });
    });
    const violations = watchViolations(page);
    await page.goto('/privacy/');
    await page.waitForTimeout(500);
    expect(contacted).toEqual([]);

    // What the component adds in a production build with a token; here it proves the policy lets it load.
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.defer = true;
      script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
      script.setAttribute('data-cf-beacon', '{"token":"0123456789abcdef0123456789abcdef"}');
      document.body.appendChild(script);
    });
    await expect.poll(() => page.evaluate(() => (window as unknown as { __beaconLoaded?: boolean }).__beaconLoaded)).toBe(true);
    expect(violations).toEqual([]);
  });

  test('robots.txt and sitemap.xml are served', async ({ request }) => {
    expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap:');
    expect(await (await request.get('/sitemap.xml')).text()).toContain('/tools/invoice/');
  });
});
