import { expect, test } from '@playwright/test';
import { startDocument } from './helpers';
import { onboardInvoice } from './setup-helpers';

test.describe('the app under /app/', () => {
  test('moves between tools in one shell, and asks before leaving unsaved work', async ({ page }) => {
    await onboardInvoice(page);
    const nav = page.getByRole('navigation', { name: 'App' });
    await expect(nav.getByRole('link', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');

    // Moving within the app keeps the page: no reload, so a value set on the window survives.
    await page.evaluate(() => Object.assign(window, { stillHere: true }));
    await nav.getByRole('link', { name: 'Agreements' }).click();
    await expect(page).toHaveURL(/\/app\/contract\/$/);
    await expect(page.getByRole('button', { name: 'Agreements', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Agreements' })).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => (window as unknown as { stillHere?: boolean }).stillHere)).toBe(true);

    // Unsaved work in an editor: the app asks first.
    await nav.getByRole('link', { name: 'Invoices' }).click();
    // An unregistered seller (the default in onboardInvoice) makes plain invoices.
    await startDocument(page, 'Invoice');
    await page.getByLabel('Client name').fill('Half typed');
    await nav.getByRole('link', { name: 'Home' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Leave this page?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Stay' }).click();
    await expect(page).toHaveURL(/\/app\/invoice\/$/);
    await expect(page.getByLabel('Client name')).toHaveValue('Half typed');
    await nav.getByRole('link', { name: 'Home' }).click();
    await dialog.getByRole('button', { name: 'Leave without saving' }).click();
    await expect(page).toHaveURL(/\/app\/$/);
    await expect(page.getByRole('region', { name: 'Quick actions' })).toBeVisible();
  });

  test('the home searches tools and actions, starts documents, and lists them as recent', async ({ page }) => {
    await onboardInvoice(page);
    await page.goto('/app/');
    await expect(page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening), Asha Rao Consulting$/ })).toBeVisible();
    await page.screenshot({ path: 'e2e-screenshots/app-home.png', fullPage: true });

    // "/" focuses the search; Enter opens the best match.
    await page.keyboard.press('/');
    const search = page.getByRole('searchbox', { name: 'Search tools and actions' });
    await expect(search).toBeFocused();
    await search.fill('quotation');
    await expect(page.getByRole('region', { name: 'Results for “quotation”' }).getByRole('link').first()).toContainText('New quotation');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/app\/invoice\/$/);
    await expect(page.getByRole('heading', { name: 'New quotation' })).toBeVisible();
    await page.getByLabel('Client name').fill('Northwind');
    await page.getByLabel('Description').first().fill('Website redesign');
    await page.getByLabel(/^Rate \(/).first().fill('45000');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved')).toBeVisible();

    // Back home: the draft is in Recent, and opens in the editor.
    await page.getByRole('navigation', { name: 'App' }).getByRole('link', { name: 'Home' }).click();
    const recent = page.getByRole('region', { name: 'Recent' });
    await expect(recent.getByRole('link')).toHaveCount(1);
    await recent.getByRole('link').click();
    await expect(page.getByRole('heading', { name: 'Edit draft' })).toBeVisible();
    await expect(page.getByLabel('Client name')).toHaveValue('Northwind');

    // A quick action starts a new agreement; Ctrl+K from a tool comes back to the search.
    await page.getByRole('navigation', { name: 'App' }).getByRole('link', { name: 'Home' }).click();
    await page.getByRole('region', { name: 'Quick actions' }).getByRole('link', { name: /New mutual NDA/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'New mutual NDA' })).toBeVisible();
    await page.getByRole('navigation', { name: 'App' }).getByRole('link', { name: 'Home' }).click();
    await page.getByRole('navigation', { name: 'App' }).getByRole('link', { name: 'Invoices' }).click();
    await expect(page.getByRole('button', { name: 'Documents' })).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(page).toHaveURL(/\/app\/#search$/);
    await expect(page.getByRole('searchbox', { name: 'Search tools and actions' })).toBeFocused();
  });

  test('old addresses forward into the app, and the tool landing pages open it', async ({ page }) => {
    await onboardInvoice(page);
    await page.goto('/business/#backup');
    await expect(page).toHaveURL(/\/app\/business\/#backup$/);
    await expect(page.getByRole('heading', { name: 'Backup & restore' })).toBeVisible();

    await page.goto('/setup/?step=payments');
    await expect(page).toHaveURL(/\/app\/setup\/\?step=payments$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Getting paid' })).toBeVisible();

    await page.goto('/tools/invoice/');
    await expect(page.getByRole('heading', { level: 1, name: 'Invoice generator' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'App' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Open the invoice generator' }).click();
    await expect(page).toHaveURL(/\/app\/invoice\/$/);
    await expect(page.getByRole('button', { name: 'Documents' })).toBeVisible();
  });

  test('fits a phone screen without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await onboardInvoice(page);
    for (const path of ['/app/', '/app/contract/', '/app/business/']) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'App' })).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.screenshot({ path: 'e2e-screenshots/app-shell-mobile.png', fullPage: true });

    // The sidebar is a drawer behind Menu; a page closes it.
    await page.getByRole('button', { name: 'Menu' }).click();
    const nav = page.getByRole('navigation', { name: 'App' });
    await expect(nav).toBeVisible();
    await page.screenshot({ path: 'e2e-screenshots/app-shell-mobile-menu.png' });
    await nav.getByRole('link', { name: 'Agreements' }).click();
    await expect(page).toHaveURL(/\/app\/contract\/$/);
    await expect(nav).toBeHidden();
  });
});
