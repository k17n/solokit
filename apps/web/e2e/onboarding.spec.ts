import { expect, test } from '@playwright/test';

const shots = 'e2e-screenshots';

test.describe('first run of the invoice tool', () => {
  test('a new visitor sets up an unregistered business and it is still there after a reload', async ({ page }) => {
    await page.goto('/tools/invoice/');
    await expect(page.getByRole('heading', { name: 'Set up your business' })).toBeVisible();
    await page.screenshot({ path: `${shots}/onboarding-status.png`, fullPage: true });

    await page.getByRole('radio', { name: /Not registered for GST/ }).check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Check your turnover limit')).toBeVisible();
    await expect(page.getByLabel('GSTIN')).toHaveCount(0);

    await page.getByLabel('Business or personal name').fill('Ravi Kumar Design');
    await page.getByLabel('Address line 1').fill('4 Park Street');
    await page.getByLabel('City').fill('Kolkata');
    await page.screenshot({ path: `${shots}/onboarding-profile-unregistered.png`, fullPage: true });
    await page.getByRole('button', { name: 'Save and continue' }).click();

    await expect(page.getByRole('button', { name: 'Documents' })).toHaveAttribute('aria-current', 'page');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Documents' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Set up your business' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByLabel('Business or personal name')).toHaveValue('Ravi Kumar Design');
    await page.screenshot({ path: `${shots}/profile-after-reload.png`, fullPage: true });
  });

  test('a regular seller is told what is wrong with the GSTIN, and the state fills in from a valid one', async ({ page }) => {
    await page.goto('/tools/invoice/');
    await page.getByRole('radio', { name: /Regular GST registration/ }).check();
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByLabel('Business or personal name').fill('Asha Rao Consulting');
    await page.getByLabel('GSTIN').fill('27AAPFU0939F1ZX');
    await page.getByLabel('Address line 1').fill('12 Linking Road');
    await page.getByLabel('City').fill('Mumbai');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByText('GSTIN check character does not match')).toBeVisible();
    await expect(page.getByLabel('GSTIN')).toBeFocused();
    await page.screenshot({ path: `${shots}/profile-gstin-error.png`, fullPage: true });

    await page.getByLabel('GSTIN').fill('27aapfu0939f1zv');
    await expect(page.getByLabel('State')).toHaveValue('27');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByRole('button', { name: 'Documents' })).toBeVisible();

    await page.getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByLabel('GSTIN')).toHaveValue('27AAPFU0939F1ZV');
  });

  test('bank details must be complete once started', async ({ page }) => {
    await page.goto('/tools/invoice/');
    await page.getByRole('radio', { name: /Not registered for GST/ }).check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Business or personal name').fill('Ravi Kumar');
    await page.getByLabel('Address line 1').fill('4 Park Street');
    await page.getByLabel('City').fill('Kolkata');
    await page.getByLabel('Bank name').fill('State Bank of India');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByLabel('Account holder name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('IFSC')).toHaveAttribute('aria-invalid', 'true');
  });

  test('the tool page reopens offline once the site has been visited', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.goto('/tools/invoice/');
    // Reload until the service worker controls the page, so the cache is warm and used.
    for (let i = 0; i < 5; i++) {
      if (await page.evaluate(() => navigator.serviceWorker.controller !== null)) break;
      await page.reload();
    }
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await expect(page.getByRole('heading', { name: 'Set up your business' })).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Set up your business' })).toBeVisible();
    await page.screenshot({ path: `${shots}/tool-offline.png`, fullPage: true });
  });

  test('works on a phone-sized screen without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tools/invoice/');
    await page.getByRole('radio', { name: /Regular GST registration/ }).check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.screenshot({ path: `${shots}/profile-mobile.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
