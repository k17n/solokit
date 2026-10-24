import { expect, test, type Page } from '@playwright/test';
import { startDocument } from './helpers';
import { onboardInvoice } from './setup-helpers';

const shots = 'test-results';

async function onboardRegular(page: Page) {
  await onboardInvoice(page, { gst: 'regular' });
}

async function fillDocument(page: Page, client: string) {
  await page.getByLabel('Client name').fill(client);
  await page.getByLabel('Address line 1', { exact: true }).fill('4 MG Road');
  await page.getByLabel('City', { exact: true }).fill('Pune');
  await page.getByLabel('State', { exact: true }).selectOption({ label: 'Maharashtra' });
  await page.getByLabel('Description').first().fill('Consulting');
  await page.getByLabel('Quantity').first().fill('24');
  await page.getByLabel(/^Rate \(/).first().fill('3000');
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('the Documents page: one New control, three distinct kinds, filters with counts', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  await onboardRegular(page);

  const nav = page.getByRole('navigation', { name: 'Invoice tool' });
  await expect(nav.getByRole('button')).toHaveText(['Documents', 'Themes', 'Backup & restore']);

  // First run: the three kinds are shown directly, with the usual order.
  await expect(page.getByRole('heading', { name: 'Start your first document' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tax invoice' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quotation', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Proforma invoice' })).toBeVisible();
  await expect(page.getByText('Quotation → Invoice')).toBeVisible();

  // A quotation, issued.
  await startDocument(page, 'Quotation');
  await expect(page.getByRole('heading', { name: 'New quotation' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Document kind' })).toContainText('Send a price offer before the work');
  await fillDocument(page, 'Northwind Traders');
  await page.getByRole('button', { name: 'Issue quotation' }).click();
  await expect(page.getByRole('region', { name: 'About this quotation' })).toContainText('Valid until');
  await page.getByRole('button', { name: 'Back to documents' }).click();

  // The chooser is a keyboard-friendly disclosure.
  const trigger = page.getByRole('button', { name: 'New', exact: true });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Tax invoice' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Quotation', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: 'Choose a document type' })).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // A proforma that is issued, and an invoice that stays a draft, to fill the list.
  await startDocument(page, 'Proforma invoice');
  await expect(page.getByRole('heading', { name: 'New proforma invoice' })).toBeVisible();
  await fillDocument(page, 'Contoso Ltd');
  await page.getByRole('button', { name: 'Issue proforma invoice' }).click();
  await page.getByRole('button', { name: 'Back to documents' }).click();

  await startDocument(page, 'Tax invoice');
  await fillDocument(page, 'Fabrikam');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Draft saved')).toBeVisible();
  await page.getByRole('button', { name: 'Back to documents' }).click();

  const filters = page.getByRole('group', { name: 'Filter by type' });
  await expect(filters.getByRole('button')).toHaveText(['All3', 'Invoices1', 'Quotations1', 'Proformas1']);
  const rows = page.getByRole('list', { name: 'Documents' }).getByRole('listitem');
  await expect(rows).toHaveCount(3);
  await filters.getByRole('button', { name: /^Proformas/ }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute('data-kind', 'proforma');
  await expect(rows.first().getByRole('button').first()).toHaveAccessibleName(/^Convert to tax invoice/);

  // Quotation to invoice and back to the list: the quotation shows where it went.
  await filters.getByRole('button', { name: /^All/ }).click();
  await rows.filter({ hasText: 'Northwind' }).getByRole('button', { name: /^Convert to invoice/ }).click();
  await expect(page.getByRole('heading', { name: 'Edit draft' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await expect(rows.filter({ hasText: 'Northwind' }).getByRole('button', { name: /^Open invoice/ })).toContainText('Invoiced');
  expect(problems).toEqual([]);
});

for (const scheme of ['light', 'dark'] as const) {
  for (const [label, size] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 800 }]] as const) {
    test(`documents page and editors in ${scheme} on ${label}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize(size);
      await onboardRegular(page);
      await expect(page.getByRole('heading', { name: 'Start your first document' })).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
      await page.screenshot({ path: `${shots}/docs-empty-${scheme}-${label}.png`, fullPage: true });

      await startDocument(page, 'Quotation');
      await fillDocument(page, 'Northwind Traders With A Rather Long Company Name Pvt Ltd');
      await page.screenshot({ path: `${shots}/editor-quote-${scheme}-${label}.png`, fullPage: true });
      expect(await noOverflow(page)).toBe(true);
      await page.getByRole('button', { name: 'Issue quotation' }).click();
      await expect(page.getByRole('region', { name: 'About this quotation' })).toBeVisible();
      await page.screenshot({ path: `${shots}/viewer-quote-${scheme}-${label}.png`, fullPage: true });
      expect(await noOverflow(page)).toBe(true);
      await page.getByRole('button', { name: 'Back to documents' }).click();

      await startDocument(page, 'Proforma invoice');
      await page.screenshot({ path: `${shots}/editor-proforma-${scheme}-${label}.png`, fullPage: true });
      await fillDocument(page, 'Contoso Ltd');
      await page.getByRole('button', { name: 'Issue proforma invoice' }).click();
      await page.getByRole('button', { name: 'Back to documents' }).click();

      await startDocument(page, 'Tax invoice');
      await page.getByRole('button', { name: 'Change type' }).click();
      await page.screenshot({ path: `${shots}/editor-invoice-change-type-${scheme}-${label}.png`, fullPage: true });
      await page.getByRole('group', { name: 'Change document type' }).getByRole('button', { name: 'Tax invoice', exact: true }).click();
      await fillDocument(page, 'Fabrikam');
      await page.screenshot({ path: `${shots}/editor-invoice-${scheme}-${label}.png`, fullPage: true });
      expect(await noOverflow(page)).toBe(true);
      await page.getByRole('button', { name: 'Issue invoice' }).click();
      await expect(page.getByRole('heading', { name: /\d{4}-\d{2}\/0001/ })).toBeVisible();
      await page.getByRole('button', { name: 'Back to documents' }).click();

      await expect(page.getByRole('list', { name: 'Documents' })).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
      await page.screenshot({ path: `${shots}/docs-list-${scheme}-${label}.png`, fullPage: true });

      await page.getByRole('button', { name: 'New', exact: true }).click();
      await expect(page.getByRole('group', { name: 'Choose a document type' })).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
      await page.screenshot({ path: `${shots}/docs-chooser-${scheme}-${label}.png`, fullPage: true });
    });
  }
}
