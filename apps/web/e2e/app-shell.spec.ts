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
    await expect(page.getByRole('region', { name: 'Ready to use' })).toBeVisible();
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
      await expect(page.getByRole('navigation', { name: 'App' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.screenshot({ path: 'e2e-screenshots/app-shell-mobile.png', fullPage: true });
  });
});
