import { expect, test, type Page } from '@playwright/test';
import { startAgreement } from './contract-helpers';
import { startDocument } from './helpers';
import { databaseNames, fillInvoice, issue, makeLogoPng, openSwitcher, paintsWith, pdfBytes, pdfContent, saveBusinessDetails } from './business-helpers';
import { completeSetup, continueTo, onStep } from './setup-helpers';

const shots = 'e2e-screenshots';

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const BRAND_STEP = '/app/setup/?next=%2Fapp%2Fbusiness%2F&step=brand';

/**
 * Sets up a new Business from /app/business/ through the setup page, with a logo and brand colours from that logo, then
 * opens the brand step again for editing, where the brand theme is offered. Returns the accent.
 */
async function brandedBusiness(page: Page, name: string): Promise<string> {
  await page.getByRole('link', { name: 'Set up this business' }).click();
  await onStep(page, 'Tax registration');
  await page.getByRole('radio', { name: /Not registered for GST/ }).check();
  await continueTo(page, 'Business details');
  await page.getByLabel('Business or personal name').fill(name);
  await page.getByLabel('Address line 1').fill('4 Park Street');
  await page.getByLabel('City', { exact: true }).fill('Kolkata');
  await page.getByLabel(/^Email/).fill('hello@terra.example');
  await continueTo(page, 'Logo and brand colours');
  await page.getByLabel('Logo', { exact: true }).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: await makeLogoPng(page) });
  await expect(page.getByRole('list', { name: 'Colours found in your logo' })).toBeVisible();
  await page.getByRole('button', { name: 'Use my logo colours' }).click();
  const accent = (await page.getByLabel('Accent colour', { exact: true }).inputValue()).toUpperCase();
  expect(accent).toMatch(/^#[0-9A-F]{6}$/);
  await continueTo(page, 'Getting paid');
  await continueTo(page, 'Invoice defaults');
  await page.getByRole('button', { name: 'Finish and open Your business' }).click();
  await expect(page.getByRole('heading', { name: 'This business' })).toBeVisible();
  await page.goto(BRAND_STEP);
  await onStep(page, 'Logo and brand colours');
  return accent;
}

test.describe('an existing user keeps everything', () => {
  test('an old solokit database becomes the first business, named after the profile, with its invoice intact', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    // A page of this site that does not run the app, so the old database exists before SoloKit ever looks at it.
    await page.goto('/manifest.webmanifest');
    const profile = {
      id: 'me',
      name: 'Legacy Studio',
      gstStatus: 'unregistered',
      address: { line1: '1 Old Road', city: 'Pune', country: 'India' },
      email: 'legacy@example.com',
    };
    const invoice = {
      id: 'inv-old',
      number: '2026-27/0001',
      fiscalYear: '2026-27',
      kind: 'invoice',
      status: 'issued',
      issueDate: '2026-10-14',
      seller: profile,
      client: { id: 'c1', name: 'Old Client Pvt Ltd', address: { line1: '2 New Road', city: 'Pune', country: 'India' } },
      currency: 'INR',
      isExport: false,
      placeOfSupplyStateCode: '27',
      reverseCharge: false,
      exemptSupply: false,
      lines: [{ id: 'l1', description: 'Old work', quantity: 1, unit: 'fixed', rate: 100000, gstRate: 0 }],
      themeId: 'classic',
      createdAt: '2026-10-14T09:00:00.000Z',
      updatedAt: '2026-10-14T09:00:00.000Z',
    };
    await page.evaluate(
      ({ profile, invoice }) =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('solokit', 2);
          open.onupgradeneeded = () => {
            for (const name of ['profile', 'clients', 'invoices', 'themes', 'settings', 'contracts']) open.result.createObjectStore(name, { keyPath: 'id' });
          };
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction(['profile', 'invoices'], 'readwrite');
            tx.objectStore('profile').put(profile);
            tx.objectStore('invoices').put(invoice);
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
      { profile, invoice },
    );

    await page.goto('/app/invoice/');
    await expect(page.getByRole('button', { name: 'Documents', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('listitem').filter({ hasText: '2026-27/0001' })).toBeVisible();
    await expect(page).toHaveURL(/\/app\/invoice\/$/);
    await expect(page.getByRole('banner').getByRole('button', { name: /^Business Legacy Studio/ })).toBeVisible();

    // The old database is still the one in use; only the small list of businesses was added.
    expect(await databaseNames(page)).toEqual(['solokit', 'solokit-workspaces']);
    await page.goto('/app/business/');
    await expect(page.getByRole('heading', { name: 'This business' })).toBeVisible();
    await expect(page.locator('#details dl')).toContainText('Legacy Studio');
    await expect(page.locator('#details dl')).toContainText('legacy@example.com');

    await page.reload();
    await expect(page.getByRole('banner').getByRole('button', { name: /^Business Legacy Studio/ })).toBeVisible();
    expect(problems).toEqual([]);
  });
});

test.describe('the business page: logo, brand colours and a brand theme', () => {
  test('a real PNG logo gives brand colours, a brand theme, and an invoice that prints in them', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto('/app/business/');
    await expect(page.getByRole('heading', { level: 1, name: 'Your business' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Set up My business' })).toBeVisible();

    const accent = await brandedBusiness(page, 'Terra Studio');
    // The switcher follows the name typed into the profile, because the business still had its placeholder name.
    await expect(page.getByRole('banner').getByRole('button', { name: /^Business Terra Studio/ })).toBeVisible();

    // The logo's colours were read by the browser itself, from a real image.
    const swatches = page.getByRole('list', { name: 'Colours found in your logo' }).getByRole('listitem');
    expect(await swatches.count()).toBeGreaterThanOrEqual(2);
    await expect(swatches.first()).toContainText(/#[0-9A-F]{6}/);
    await expect(page.getByText('These colours came from your logo.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Readability checks' })).not.toContainText('Fails');
    await page.screenshot({ path: `${shots}/business-brand-flow.png`, fullPage: true });

    await page.getByRole('button', { name: 'Create a Brand theme' }).click();
    await expect(page.getByText('Created the theme "Terra Studio brand" and set it as the theme for new documents.')).toBeVisible();

    // The brand colours survive a reload, with their source.
    await page.reload();
    await expect(page.getByLabel('Accent colour', { exact: true })).toHaveValue(accent);
    await expect(page.getByText(/matches your brand colours/)).toBeVisible();

    await page.goto('/app/invoice/');
    await page.getByRole('button', { name: 'Themes' }).click();
    await expect(page.getByRole('list', { name: 'Themes' }).getByRole('button', { name: /^Terra Studio brand/ })).toContainText('Default');
    await page.getByRole('button', { name: 'Documents', exact: true }).click();
    await startDocument(page, 'Invoice');
    expect(await page.getByLabel('Invoice theme').evaluate((select: HTMLSelectElement) => select.selectedOptions[0]?.textContent)).toBe('Terra Studio brand');
    await fillInvoice(page);
    await issue(page);
    await expect(page.locator('iframe[title="Invoice preview"]')).toBeVisible({ timeout: 30_000 });
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download PDF' }).click()]);
    expect(paintsWith(pdfContent(await pdfBytes(download)), accent)).toBe(true);
    expect(problems).toEqual([]);
  });

  test('a changed logo offers to update an untouched brand theme, and never overwrites an edited one', async ({ page }) => {
    await page.goto('/app/business/');
    await brandedBusiness(page, 'Terra Studio');
    await page.getByRole('button', { name: 'Create a Brand theme' }).click();
    await expect(page.getByText(/^Created the theme/)).toBeVisible();

    // A different colour by hand, saved: the untouched theme is offered an update.
    await page.getByLabel('Accent colour', { exact: true }).fill('#1D4ED8');
    await page.getByRole('button', { name: 'Save and return to Your business' }).click();
    await expect(page.getByRole('heading', { name: 'This business' })).toBeVisible();
    await page.goto(BRAND_STEP);
    await expect(page.getByText(/Your brand colours changed/)).toBeVisible();
    await page.getByRole('button', { name: 'Update brand theme' }).click();
    await expect(page.getByText('Updated "Terra Studio brand" to your new brand colours.')).toBeVisible();

    // Edit the theme by hand in the invoice tool, then change the brand again: only a new theme is offered.
    await page.goto('/app/invoice/');
    await page.getByRole('button', { name: 'Themes' }).click();
    await page.getByRole('list', { name: 'Themes' }).getByRole('button', { name: /^Terra Studio brand/ }).click();
    await page.getByLabel('Font').selectOption('poppins');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Changes saved.')).toBeVisible();

    await page.goto(BRAND_STEP);
    await page.getByLabel('Accent colour', { exact: true }).fill('#7C2D12');
    await page.getByRole('button', { name: 'Save and return to Your business' }).click();
    await expect(page.getByRole('heading', { name: 'This business' })).toBeVisible();
    await page.goto(BRAND_STEP);
    await expect(page.getByText(/you edited/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update brand theme' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Create a new Brand theme' }).click();
    await expect(page.getByText(/Created the theme "Terra Studio brand 2"/)).toBeVisible();
  });
});

test.describe('several businesses', () => {
  test('a second business is separate, switching is announced, and switching back finds the first as it was', async ({ page }) => {
    await page.goto('/app/business/');
    await saveBusinessDetails(page, { name: 'First Co' });
    await page.goto('/app/invoice/');
    await startDocument(page, 'Invoice');
    await fillInvoice(page);
    const number = await issue(page);
    await page.getByRole('button', { name: 'Documents', exact: true }).click();
    await expect(page.getByRole('listitem').filter({ hasText: number })).toBeVisible();

    // Add a business from the switcher.
    const trigger = await openSwitcher(page);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: /^First Co/ })).toHaveAttribute('aria-current', 'true');
    await page.getByRole('link', { name: '+ Add a business' }).click();
    await expect(page).toHaveURL(/\/app\/business\/#add$/);
    await expect(page.getByRole('heading', { name: 'Add a business' })).toBeFocused();
    await page.getByLabel('Business name').fill('Second Co');
    await page.getByRole('button', { name: 'Create business' }).click();
    // A new business goes straight to its own setup, and comes back to Your business.
    await expect(page).toHaveURL(/\/app\/setup\/\?next=%2Fapp%2Fbusiness%2F$/);
    await expect(page.getByRole('banner').getByRole('button', { name: /^Business Second Co/ })).toBeVisible();
    await saveBusinessDetails(page, { name: 'Second Co', line1: '9 Hill Road', city: 'Pune' });

    // Separate data: the invoice list of the second business is empty.
    await page.goto('/app/invoice/');
    await expect(page.getByRole('banner').getByRole('button', { name: /^Business Second Co/ })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: number })).toHaveCount(0);
    await page.goto('/app/business/');
    await expect(page.locator('#details dl')).toContainText('9 Hill Road');
    await page.goto('/app/invoice/');
    await expect(page.getByRole('button', { name: 'Documents', exact: true })).toBeVisible();

    // Back to the first one with the keyboard.
    const open = await openSwitcher(page);
    await expect(page.getByRole('button', { name: /^Second Co/ })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('button', { name: /^First Co/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(open).toBeFocused();
    await expect(open).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('status').filter({ hasText: 'Now working in First Co' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Documents', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('listitem').filter({ hasText: number })).toBeVisible();

    // The choice is remembered across a reload; Escape closes the menu and returns focus.
    await page.reload();
    await expect(page.getByRole('banner').getByRole('button', { name: /^Business First Co/ })).toBeVisible();
    const again = await openSwitcher(page);
    await page.keyboard.press('Escape');
    await expect(again).toBeFocused();
    await expect(again).toHaveAttribute('aria-expanded', 'false');
    expect((await databaseNames(page)).filter((name) => name.startsWith('solokit-ws-'))).toHaveLength(1);
  });

  test('every tool sends a new business to the one setup, comes back, and changes go through setup too', async ({ page }) => {
    // The first tool opened sends the new business to setup, naming the tool, and setup brings it back there.
    await page.goto('/app/contract/');
    await expect(page).toHaveURL(/\/app\/setup\/\?next=%2Fapp%2Fcontract%2F$/);
    await expect(page.getByText(/Before you open the Contract and NDA generator/)).toBeVisible();
    await completeSetup(page, { name: 'Shared Co', line1: '5 Mill Road', city: 'Surat', email: 'legal@shared.example' });
    await expect(page).toHaveURL(/\/app\/contract\/$/);
    await expect(page.getByRole('button', { name: 'Agreements' })).toHaveAttribute('aria-current', 'page');

    await startAgreement(page, 'Freelance services');
    const party = page.getByRole('group', { name: /^Party 1:/ });
    await expect(party.getByLabel(/: full name$/)).toHaveValue('Shared Co');
    await expect(party.getByLabel('Address line 1')).toHaveValue('5 Mill Road');
    await expect(party.getByLabel('Email for notices')).toHaveValue('legal@shared.example');

    // The invoice tool asks nothing: setup already has all it needs. It has no profile form of its own.
    await page.goto('/app/invoice/');
    await expect(page.getByRole('button', { name: 'Documents', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Business or personal name')).toHaveCount(0);

    // Its Business details link opens setup for editing and comes back to the tool.
    await page.getByRole('link', { name: 'Business details' }).click();
    await expect(page).toHaveURL(/\/app\/setup\/\?next=%2Fapp%2Finvoice%2F$/);
    await page.getByRole('navigation', { name: 'Setup steps' }).getByRole('button', { name: /^Business details/ }).click();
    await page.getByLabel(/^Email/).fill('accounts@shared.example');
    await page.getByRole('button', { name: 'Save and return to Invoice generator' }).click();
    await expect(page).toHaveURL(/\/app\/invoice\/$/);
    await page.goto('/app/business/');
    await expect(page.locator('#details dl')).toContainText('accounts@shared.example');
  });

  test('a business is deleted only after a warning that names what goes and its name typed in', async ({ page }) => {
    await page.goto('/app/business/');
    await saveBusinessDetails(page, { name: 'Keep Co' });
    await page.goto('/app/business/#add');
    await page.getByLabel('Business name').fill('Doomed Co');
    await page.getByRole('button', { name: 'Create business' }).click();
    await saveBusinessDetails(page, { name: 'Doomed Co' });
    await page.goto('/app/invoice/');
    await startDocument(page, 'Invoice');
    await fillInvoice(page);
    await issue(page);

    await page.goto('/app/business/#businesses');
    await expect(page.getByRole('heading', { name: 'Your businesses' })).toBeFocused();
    const list = page.getByRole('list', { name: 'Your businesses' });
    await list.getByRole('button', { name: 'Delete Doomed Co' }).click();
    const confirm = page.getByRole('group', { name: /Delete .Doomed Co. for good/ });
    await expect(confirm).toBeFocused();
    await expect(confirm).toContainText('1 invoice or quote');
    await expect(confirm).toContainText('from this device');
    const forever = confirm.getByRole('button', { name: /forever/ });
    await expect(forever).toBeDisabled();
    await confirm.getByLabel(/Type the business name/).fill('doomed');
    await expect(forever).toBeDisabled();
    await page.screenshot({ path: `${shots}/business-delete-confirm.png`, fullPage: true });
    await confirm.getByLabel(/Type the business name/).fill('Doomed Co');
    await expect(forever).toBeEnabled();
    await forever.click();
    await expect(page.getByText('Deleted "Doomed Co" from this device. Now showing another business.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your businesses' })).toBeFocused();
    await expect(list.getByText('Doomed Co')).toHaveCount(0);
    await expect(page.getByRole('banner').getByRole('button', { name: /^Business Keep Co/ })).toBeVisible();

    // The data is really gone from the browser, and the last business cannot be deleted.
    expect((await databaseNames(page)).filter((name) => name.startsWith('solokit-ws-'))).toEqual([]);
    await expect(list.getByRole('button', { name: 'Delete Keep Co' })).toBeDisabled();
    await expect(page.getByText(/your only business/)).toBeVisible();
  });

  test('a backup restores into a new business and leaves the current one alone', async ({ page }) => {
    await page.goto('/app/business/');
    await saveBusinessDetails(page, { name: 'Source Co' });
    await page.goto('/app/invoice/');
    await startDocument(page, 'Invoice');
    await fillInvoice(page);
    const number = await issue(page);

    await page.goto('/app/business/#backup');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup' }).click()]);
    const backupPath = await download.path();

    await page.getByLabel('Backup file').setInputFiles(backupPath);
    const summary = page.getByRole('region', { name: 'Restore this backup?' });
    await expect(summary).toContainText('"Source Co" now holds');
    await expect(summary).toContainText('Restoring as a new business deletes nothing');
    await expect(summary.getByRole('button', { name: 'Restore as a new business' })).toBeVisible();
    await expect(summary.getByRole('button', { name: 'Yes, replace "Source Co"' })).toBeVisible();
    await page.screenshot({ path: `${shots}/business-restore-choice.png`, fullPage: true });
    await summary.getByRole('button', { name: 'Restore as a new business' }).click();
    await expect(page.getByText('Backup restored as a new business')).toBeVisible();
    await page.getByRole('region', { name: 'Restore from a backup' }).getByRole('button', { name: 'Switch to Source Co (restored)' }).click();
    await expect(page.getByRole('banner').getByRole('button', { name: 'Business Source Co (restored)' })).toBeVisible();

    // Two businesses now: the copy is told apart by its name.
    await openSwitcher(page);
    await expect(page.getByRole('group', { name: 'Businesses' }).getByRole('button')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await page.goto('/app/invoice/');
    await expect(page.getByRole('listitem').filter({ hasText: number })).toBeVisible();
  });
});

test.describe('light, dark, desktop and phone', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const [label, size] of [
      ['desktop', { width: 1280, height: 900 }],
      ['mobile', { width: 390, height: 844 }],
    ] as const) {
      test(`the business page, the switcher and the brand colours in ${scheme} on ${label}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize(size);
        await page.goto('/app/business/');
        await expect(page.getByRole('heading', { name: 'Set up My business' })).toBeVisible();
        expect(await noOverflow(page)).toBe(true);
        await page.screenshot({ path: `${shots}/business-fresh-${scheme}-${label}.png`, fullPage: true });

        await brandedBusiness(page, 'Terra Studio Design Collective With A Long Name');
        expect(await noOverflow(page)).toBe(true);
        await page.screenshot({ path: `${shots}/business-${scheme}-${label}.png`, fullPage: true });
        await page.getByRole('region', { name: 'Brand colours' }).scrollIntoViewIfNeeded();
        await page.getByRole('region', { name: 'Brand colours' }).screenshot({ path: `${shots}/business-brand-colours-${scheme}-${label}.png` });

        await openSwitcher(page);
        expect(await noOverflow(page)).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `${shots}/business-switcher-open-${scheme}-${label}.png` });
        await page.keyboard.press('Escape');

        await page.goto('/app/business/#businesses');
        await expect(page.getByRole('heading', { name: 'Your businesses' })).toBeVisible();
        expect(await noOverflow(page)).toBe(true);
        await page.screenshot({ path: `${shots}/business-manage-${scheme}-${label}.png`, fullPage: true });

        await page.goto('/app/contract/');
        await expect(page.getByRole('button', { name: 'Agreements' })).toBeVisible();
        expect(await noOverflow(page)).toBe(true);
        await page.goto('/');
        expect(await noOverflow(page)).toBe(true);
      });
    }
  }
});
