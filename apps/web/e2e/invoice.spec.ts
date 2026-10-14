import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Page } from '@playwright/test';

const shots = 'test-results';

async function pdfText(download: Download): Promise<string> {
  const path = await download.path();
  const data = new Uint8Array(await readFile(path));
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  let text = '';
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n';
  }
  await task.destroy();
  return text;
}

const squash = (text: string) => text.replace(/\s+/g, '');

async function onboard(page: Page, kind: 'regular' | 'unregistered') {
  await page.goto('/tools/invoice/');
  if (kind === 'regular') {
    await page.getByRole('radio', { name: /Regular GST registration/ }).check();
  } else {
    await page.getByRole('radio', { name: /Not registered for GST/ }).check();
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Business or personal name').fill('Asha Rao Consulting');
  if (kind === 'regular') {
    await page.getByLabel('GSTIN').fill('27AABCT3518Q1ZW');
    await page.getByLabel('Address line 1').fill('12 Linking Road');
    await page.getByLabel('City').fill('Mumbai');
  } else {
    await page.getByLabel('Address line 1').fill('4 Park Street');
    await page.getByLabel('City').fill('Kolkata');
  }
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('button', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');
}

async function fillClient(page: Page, client: { name: string; line1: string; city: string; state?: string; country?: string }) {
  await page.getByLabel('Client name').fill(client.name);
  await page.getByLabel('Address line 1', { exact: true }).fill(client.line1);
  await page.getByLabel('City', { exact: true }).fill(client.city);
  if (client.state) await page.getByLabel('State', { exact: true }).selectOption({ label: client.state });
  if (client.country) await page.getByLabel('Country', { exact: true }).fill(client.country);
}

async function fillItem(page: Page, item: { description: string; quantity: string; rate: string }) {
  await page.getByLabel('Description').first().fill(item.description);
  await page.getByLabel('Quantity').first().fill(item.quantity);
  await page.getByLabel(/^Rate \(/).first().fill(item.rate);
}

async function issueAndDownload(page: Page): Promise<{ number: string; text: string }> {
  const number = await page.getByLabel('Invoice number').inputValue();
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  await expect(page.getByRole('heading', { name: number })).toBeVisible();
  await expect(page.getByText('Issued', { exact: true })).toBeVisible();
  await expect(page.locator('iframe[title="Invoice preview"]')).toBeVisible({ timeout: 30_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download PDF' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^(Tax-Invoice|Invoice|Bill-of-Supply)-/);
  return { number, text: await pdfText(download) };
}

test.describe('invoices in a real browser', () => {
  test('a regular seller creates, previews, issues and downloads an invoice', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await onboard(page, 'regular');
    await page.getByRole('button', { name: 'Create your first invoice' }).click();
    await fillClient(page, { name: 'Northwind Traders', line1: '4 MG Road', city: 'Pune', state: 'Maharashtra' });
    await fillItem(page, { description: 'Consulting', quantity: '24', rate: '3000' });
    await expect(page.getByText('₹84,960.00').first()).toBeVisible();

    await page.getByRole('button', { name: 'Show preview' }).click();
    await expect(page.locator('iframe[title="Invoice preview"]')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${shots}/invoice-editor-desktop.png`, fullPage: true });

    const number = await page.getByLabel('Invoice number').inputValue();
    await page.getByRole('button', { name: 'Issue invoice' }).click();
    await expect(page.getByRole('heading', { name: number })).toBeVisible();
    await expect(page.getByText('Issued', { exact: true })).toBeVisible();
    await expect(page.locator('iframe[title="Invoice preview"]')).toBeVisible({ timeout: 30_000 });
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download PDF' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^Tax-Invoice-/);
    const text = squash(await pdfText(download));
    for (const expected of ['Northwind Traders', 'Consulting', '84,960.00', 'GSTIN', number]) expect(text).toContain(squash(expected));

    await page.getByRole('button', { name: 'Back to invoices' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: number })).toContainText('₹84,960.00');
    await page.reload();
    await expect(page.getByRole('listitem').filter({ hasText: number })).toContainText('₹84,960.00');
    expect(problems).toEqual([]);
  });

  test('an unregistered seller sees no GST fields and the PDF carries no GSTIN', async ({ page }) => {
    await onboard(page, 'unregistered');
    await page.getByRole('button', { name: 'Create your first invoice' }).click();
    await expect(page.getByLabel('Place of supply')).toHaveCount(0);
    await fillClient(page, { name: 'Local Client', line1: '9 Lake Road', city: 'Kolkata' });
    await fillItem(page, { description: 'Design work', quantity: '1', rate: '5000' });
    const { text } = await issueAndDownload(page);
    expect(squash(text)).toContain('5,000.00');
    expect(text).not.toContain('GSTIN');
  });

  test('an export invoice is issued in a foreign currency', async ({ page }) => {
    await onboard(page, 'regular');
    await page.getByRole('button', { name: 'Create your first invoice' }).click();
    await page.getByLabel('Client is outside India (export)').check();
    await page.getByLabel('Currency').selectOption('USD');
    await fillClient(page, { name: 'Acme Inc', line1: '1 Market Street', city: 'San Francisco', country: 'United States' });
    await fillItem(page, { description: 'Software services', quantity: '1', rate: '1234.56' });
    const { text } = await issueAndDownload(page);
    expect(squash(text)).toContain('1,234.56');
    expect(text).toMatch(/USD|\$/);
  });

  test('an invoice can be duplicated and the original cancelled', async ({ page }) => {
    await onboard(page, 'unregistered');
    await page.getByRole('button', { name: 'Create your first invoice' }).click();
    await fillClient(page, { name: 'Local Client', line1: '9 Lake Road', city: 'Kolkata' });
    await fillItem(page, { description: 'Design work', quantity: '1', rate: '5000' });
    const first = await page.getByLabel('Invoice number').inputValue();
    await page.getByRole('button', { name: 'Issue invoice' }).click();
    await expect(page.getByRole('heading', { name: first })).toBeVisible();
    await page.getByRole('button', { name: 'Back to invoices' }).click();

    await page.getByRole('button', { name: `Duplicate ${first}` }).click();
    await expect(page.getByRole('heading', { name: 'Edit draft' })).toBeVisible();
    const second = await page.getByLabel('Invoice number').inputValue();
    expect(second).not.toBe(first);
    await page.getByRole('button', { name: 'Back to invoices' }).click();

    await page.getByRole('button', { name: `Cancel invoice ${first}` }).click();
    await page.getByRole('button', { name: 'Yes, cancel invoice' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: first }).getByText('Cancelled', { exact: true })).toBeVisible();
  });

  test('the editor fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await onboard(page, 'regular');
    await page.getByRole('button', { name: 'Create your first invoice' }).click();
    await expect(page.getByRole('heading', { name: 'New invoice' })).toBeVisible();
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    await page.screenshot({ path: `${shots}/invoice-editor-mobile.png`, fullPage: true });
    expect(fits).toBe(true);
  });

  test('an invoice can be created, issued and downloaded offline', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.goto('/tools/invoice/');
    for (let i = 0; i < 5; i++) {
      if (await page.evaluate(() => navigator.serviceWorker.controller !== null)) break;
      await page.reload();
    }
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await onboard(page, 'unregistered');
    await context.setOffline(true);
    await page.goto('/tools/invoice/');
    await page.getByRole('button', { name: 'Create your first invoice' }).click();
    await fillClient(page, { name: 'Local Client', line1: '9 Lake Road', city: 'Kolkata' });
    await fillItem(page, { description: 'Design work', quantity: '2', rate: '2500' });
    const { text } = await issueAndDownload(page);
    expect(squash(text)).toContain('5,000.00');
  });
});
