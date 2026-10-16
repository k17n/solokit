import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Page } from '@playwright/test';

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

async function onboardRegular(page: Page) {
  await page.goto('/tools/invoice/');
  await page.getByRole('radio', { name: /Regular GST registration/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Business or personal name').fill('Asha Rao Consulting');
  await page.getByLabel('GSTIN').fill('27AABCT3518Q1ZW');
  await page.getByLabel('Address line 1').fill('12 Linking Road');
  await page.getByLabel('City').fill('Mumbai');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('button', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');
}

async function downloadPdf(page: Page): Promise<{ filename: string; text: string }> {
  await expect(page.locator('iframe[title="Invoice preview"]')).toBeVisible({ timeout: 30_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download PDF' }).click()]);
  return { filename: download.suggestedFilename(), text: await pdfText(download) };
}

test('a quotation is issued, converted to an invoice, and the two number series stay separate', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  await onboardRegular(page);

  await page.getByRole('button', { name: 'Create a quotation' }).click();
  await expect(page.getByRole('heading', { name: 'New quotation' })).toBeVisible();
  const quoteNumber = await page.getByLabel('Quotation number').inputValue();
  expect(quoteNumber).toMatch(/^QT\/\d{4}-\d{2}\/0001$/);
  expect(quoteNumber.length).toBeLessThanOrEqual(16);
  await expect(page.getByLabel('Valid until')).not.toHaveValue('');
  await expect(page.getByLabel('Due date')).toHaveCount(0);

  await page.getByLabel('Client name').fill('Northwind Traders');
  await page.getByLabel('Address line 1', { exact: true }).fill('4 MG Road');
  await page.getByLabel('City', { exact: true }).fill('Pune');
  await page.getByLabel('State', { exact: true }).selectOption({ label: 'Maharashtra' });
  await page.getByLabel('Description').first().fill('Consulting');
  await page.getByLabel('Quantity').first().fill('24');
  await page.getByLabel(/^Rate \(/).first().fill('3000');

  await page.getByRole('button', { name: 'Issue quotation' }).click();
  await expect(page.getByRole('heading', { name: quoteNumber })).toBeVisible();
  await expect(page.getByText('Issued', { exact: true })).toBeVisible();
  const quotePdf = await downloadPdf(page);
  expect(quotePdf.filename).toMatch(/^Quotation-QT-/);
  const quoteText = squash(quotePdf.text);
  expect(quoteText).toContain('Quotation');
  expect(quoteText).toContain('Validuntil');
  expect(quoteText).toContain(squash(quoteNumber));
  expect(quoteText).toContain('Thisisanestimate,notataxinvoice.');
  expect(quoteText).not.toContain('TaxInvoice');
  expect(quoteText).toContain('84,960.00');

  await page.getByRole('button', { name: 'Convert to invoice' }).click();
  await expect(page.getByRole('heading', { name: 'Edit draft' })).toBeVisible();
  const invoiceNumber = await page.getByLabel('Invoice number').inputValue();
  expect(invoiceNumber).toMatch(/^\d{4}-\d{2}\/0001$/);
  await expect(page.getByLabel('Client name')).toHaveValue('Northwind Traders');
  await expect(page.getByLabel('Description').first()).toHaveValue('Consulting');
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  await expect(page.getByRole('heading', { name: invoiceNumber })).toBeVisible();
  const invoicePdf = await downloadPdf(page);
  expect(invoicePdf.filename).toMatch(/^Tax-Invoice-/);
  expect(squash(invoicePdf.text)).toContain('TaxInvoice');
  expect(squash(invoicePdf.text)).toContain(squash(invoiceNumber));
  expect(squash(invoicePdf.text)).not.toContain('Validuntil');
  await expect(page.getByText(/Made from quotation/)).toBeVisible();

  await page.getByRole('button', { name: 'Back to invoices' }).click();
  const quoteRow = page.getByRole('listitem').filter({ hasText: quoteNumber });
  await expect(quoteRow).toContainText('Converted');
  await expect(quoteRow).toContainText('Issued');
  const show = page.getByRole('group', { name: 'Show' });
  const rows = page.getByRole('list', { name: 'Invoices' }).getByRole('listitem');
  await show.getByRole('button', { name: 'Quotes' }).click();
  await expect(rows).toHaveCount(1);
  await show.getByRole('button', { name: 'Invoices' }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText(invoiceNumber);

  await page.getByRole('button', { name: 'New quotation' }).click();
  await expect(page.getByLabel('Quotation number')).toHaveValue(quoteNumber.replace(/0001$/, '0002'));
  await page.reload();
  expect(problems).toEqual([]);
});
