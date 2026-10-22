import { expect, test } from '@playwright/test';
import { completeSetup, continueTo, onStep } from './setup-helpers';

const shots = 'e2e-screenshots';

test.describe('first run: the business setup before any tool', () => {
  test('Get started on the home page runs the setup, then lists the tools to open', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('main').getByRole('link', { name: 'Get started' }).click();
    await expect(page).toHaveURL(/\/app\/setup\/\?next=%2Fapp%2F%3Fwelcome%3D1$/);
    await expect(page.getByText(/When you finish, you will see the tools you can use/)).toBeVisible();
    await completeSetup(page, { name: 'Meera Iyer Studio' });

    await expect(page).toHaveURL(/\/app\/\?welcome=1$/);
    await expect(page.getByText('Meera Iyer Studio is set up')).toBeVisible();
    const ready = page.getByRole('region', { name: 'Your tools' });
    await expect(ready.getByRole('link')).toHaveCount(2);
    await page.screenshot({ path: `${shots}/app-home.png`, fullPage: true });

    // Get started again, as a returning visitor: straight to the tools, no setup and no welcome.
    await page.goto('/');
    await page.getByRole('banner').getByRole('link', { name: 'Get started' }).click();
    await expect(page).toHaveURL(/\/app\/$/);
    await expect(page.getByText('Meera Iyer Studio is set up')).toHaveCount(0);
    await ready.getByRole('link', { name: /Invoice generator/ }).click();
    await expect(page).toHaveURL(/\/app\/invoice\/$/);
    await expect(page.getByRole('button', { name: 'Documents' })).toHaveAttribute('aria-current', 'page');
  });

  test('a new visitor is sent from the tool to setup, sets up an unregistered business step by step, and is brought back', async ({ page }) => {
    await page.goto('/app/invoice/');
    await expect(page).toHaveURL(/\/app\/setup\/\?next=%2Fapp%2Finvoice%2F$/);
    await onStep(page, 'Tax registration');
    await expect(page.getByText(/Before you open the Invoice generator/)).toBeVisible();
    await page.screenshot({ path: `${shots}/onboarding-status.png`, fullPage: true });

    await page.getByRole('radio', { name: /Not registered for GST/ }).check();
    await expect(page.getByText('Check your turnover limit')).toBeVisible();
    await continueTo(page, 'Business details');
    await expect(page.getByLabel('GSTIN')).toHaveCount(0);

    await page.getByLabel('Business or personal name').fill('Ravi Kumar Design');
    await page.getByLabel('Address line 1').fill('4 Park Street');
    await page.getByLabel('City', { exact: true }).fill('Kolkata');
    await page.getByLabel(/^Email/).fill('ravi@example.com');
    await page.screenshot({ path: `${shots}/onboarding-profile-unregistered.png`, fullPage: true });
    await continueTo(page, 'Logo and brand colours');
    await continueTo(page, 'Getting paid');
    await continueTo(page, 'Invoice defaults');
    await page.getByRole('button', { name: 'Finish and open Invoice generator' }).click();

    await expect(page).toHaveURL(/\/app\/invoice\/$/);
    await expect(page.getByRole('button', { name: 'Documents' })).toHaveAttribute('aria-current', 'page');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Documents' })).toBeVisible();
    await expect(page).toHaveURL(/\/app\/invoice\/$/);

    // The tool has no profile form of its own; its link opens the same setup, for editing.
    await page.getByRole('link', { name: 'Business details' }).click();
    await page.getByRole('navigation', { name: 'Setup steps' }).getByRole('button', { name: /^Business details/ }).click();
    await expect(page.getByLabel('Business or personal name')).toHaveValue('Ravi Kumar Design');
    await page.screenshot({ path: `${shots}/profile-after-reload.png`, fullPage: true });
    await page.getByRole('link', { name: 'Back to Invoice generator without saving' }).click();
    await expect(page).toHaveURL(/\/app\/invoice\/$/);
  });

  test('a regular seller is told what is wrong with the GSTIN, and the state fills in from a valid one', async ({ page }) => {
    await page.goto('/app/setup/');
    await page.getByRole('radio', { name: /Regular GST registration/ }).check();
    await continueTo(page, 'Business details');

    await page.getByLabel('Business or personal name').fill('Asha Rao Consulting');
    await page.getByLabel('GSTIN').fill('27AAPFU0939F1ZX');
    await page.getByLabel('Address line 1').fill('12 Linking Road');
    await page.getByLabel('City', { exact: true }).fill('Mumbai');
    await page.getByLabel(/^Email/).fill('asha@example.com');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByText('GSTIN check character does not match')).toBeVisible();
    await expect(page.getByLabel('GSTIN')).toBeFocused();
    await page.screenshot({ path: `${shots}/profile-gstin-error.png`, fullPage: true });

    await page.getByLabel('GSTIN').fill('27aapfu0939f1zv');
    await expect(page.getByLabel(/^State/)).toHaveValue('27');
    await continueTo(page, 'Logo and brand colours');
    await continueTo(page, 'Getting paid');
    await continueTo(page, 'Invoice defaults');
    await page.getByRole('button', { name: 'Finish setup' }).click();
    await expect(page).toHaveURL(/\/app\/\?welcome=1$/);

    await page.goto('/app/business/');
    await expect(page.locator('#details dl')).toContainText('GSTIN 27AAPFU0939F1ZV');
  });

  test('bank details must be complete once started', async ({ page }) => {
    await page.goto('/app/setup/');
    await page.getByRole('radio', { name: /Not registered for GST/ }).check();
    await continueTo(page, 'Business details');
    await page.getByLabel('Business or personal name').fill('Ravi Kumar');
    await page.getByLabel('Address line 1').fill('4 Park Street');
    await page.getByLabel('City', { exact: true }).fill('Kolkata');
    await page.getByLabel(/^Email/).fill('ravi@example.com');
    await continueTo(page, 'Logo and brand colours');
    await continueTo(page, 'Getting paid');
    await page.getByLabel('Bank name').fill('State Bank of India');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByLabel('Account holder name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('IFSC')).toHaveAttribute('aria-invalid', 'true');
  });

  test('setup reopens offline once the site has been visited', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.goto('/app/invoice/');
    await onStep(page, 'Tax registration');
    // Reload until the service worker controls the page, so the cache is warm and used.
    for (let i = 0; i < 5; i++) {
      if (await page.evaluate(() => navigator.serviceWorker.controller !== null)) break;
      await page.reload();
    }
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await context.setOffline(true);
    await page.goto('/app/invoice/');
    await onStep(page, 'Tax registration');
    await page.screenshot({ path: `${shots}/tool-offline.png`, fullPage: true });
  });

  test('works on a phone-sized screen without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/setup/');
    await page.getByRole('radio', { name: /Regular GST registration/ }).check();
    await continueTo(page, 'Business details');
    await page.screenshot({ path: `${shots}/profile-mobile.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
