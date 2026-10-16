import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { expect, test, type Download, type Page } from '@playwright/test';
import { startDocument } from './helpers';

const shots = 'e2e-screenshots';
const squash = (text: string) => text.replace(/\s+/g, '');

/** Every flate-compressed stream in a PDF, decompressed and joined, so drawing colours can be looked for. */
function pdfContent(data: Buffer): string {
  const text = data.toString('latin1');
  const parts: string[] = [];
  const pattern = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const start = match.index + match[0].length;
    const end = text.indexOf('endstream', start);
    if (end < 0) break;
    try {
      parts.push(inflateSync(data.subarray(start, end)).toString('latin1'));
    } catch {
      // Fonts and images are not always flate streams; skip anything that does not inflate.
    }
    pattern.lastIndex = end;
  }
  return parts.join('\n');
}

/** True when the PDF paints with this #RRGGBB colour (as a fill or stroke). */
function paintsWith(content: string, hex: string): boolean {
  const wanted = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (const match of content.matchAll(/(\d+(?:\.\d+)?) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?) (?:rg|RG|scn|SCN)/g)) {
    const found = [match[1], match[2], match[3]].map((value) => Math.round(Number(value) * 255));
    if (found.every((value, index) => value === wanted[index])) return true;
  }
  return false;
}

async function pdfBytes(download: Download): Promise<Buffer> {
  return readFile(await download.path());
}

async function onboard(page: Page) {
  await page.goto('/tools/invoice/');
  await page.getByRole('radio', { name: /Not registered for GST/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Business or personal name').fill('Asha Rao Consulting');
  await page.getByLabel('Address line 1').fill('4 Park Street');
  await page.getByLabel('City').fill('Kolkata');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('button', { name: 'Documents' })).toHaveAttribute('aria-current', 'page');
}

async function fillInvoice(page: Page) {
  await page.getByLabel('Client name').fill('Local Client');
  await page.getByLabel('Address line 1', { exact: true }).fill('9 Lake Road');
  await page.getByLabel('City', { exact: true }).fill('Kolkata');
  await page.getByLabel('Description').first().fill('Design work');
  await page.getByLabel('Quantity').first().fill('2');
  await page.getByLabel(/^Rate \(/).first().fill('2500');
}

async function issue(page: Page): Promise<string> {
  const number = await page.getByLabel('Invoice number').inputValue();
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  await expect(page.getByRole('heading', { name: number })).toBeVisible();
  return number;
}

test.describe('themes', () => {
  test('a custom theme is created, set as default, used on an invoice, and shows in the issued PDF', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await onboard(page);

    await page.getByRole('button', { name: 'Themes' }).click();
    await expect(page.getByRole('button', { name: 'Themes' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('list', { name: 'Themes' }).getByRole('button')).toHaveCount(6);
    await page.getByRole('list', { name: 'Themes' }).getByRole('button', { name: /^Modern/ }).click();
    await page.getByLabel('Accent colour', { exact: true }).fill('#7C2D12');
    await page.getByLabel('Font').selectOption('poppins');
    await page.getByLabel('Theme name').fill('Rust');
    await expect(page.locator('iframe[title="Invoice preview"]')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${shots}/themes-desktop.png`, fullPage: true });
    await page.getByRole('button', { name: 'Save as my theme' }).click();
    await expect(page.getByRole('list', { name: 'Themes' }).getByRole('button', { name: /^Rust/ })).toHaveAttribute('aria-current', 'true');
    await page.getByRole('button', { name: 'Set as default' }).click();
    await expect(page.getByRole('list', { name: 'Themes' }).getByRole('button', { name: /^Rust/ })).toContainText('Default');

    await page.reload();
    await page.getByRole('button', { name: 'Themes' }).click();
    await expect(page.getByRole('list', { name: 'Themes' }).getByRole('button', { name: /^Rust/ })).toContainText('Default');

    await page.getByRole('button', { name: 'Documents' }).click();
    await startDocument(page, 'Invoice');
    expect(await page.getByLabel('Invoice theme').evaluate((select: HTMLSelectElement) => select.selectedOptions[0]?.textContent)).toBe('Rust');
    await fillInvoice(page);
    await issue(page);
    await expect(page.locator('iframe[title="Invoice preview"]')).toBeVisible({ timeout: 30_000 });
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download PDF' }).click()]);
    const content = pdfContent(await pdfBytes(download));
    expect(paintsWith(content, '#7C2D12')).toBe(true);
    expect(paintsWith(content, '#047857')).toBe(false);
    expect(problems).toEqual([]);
  });
});

test.describe('backup and restore', () => {
  test('a backup downloaded on one device restores the invoice on a fresh one', async ({ page, browser }) => {
    await onboard(page);
    await startDocument(page, 'Invoice');
    await fillInvoice(page);
    const number = await issue(page);

    await page.getByRole('button', { name: 'Backup & restore' }).click();
    await expect(page.getByText(/not encrypted/i)).toBeVisible();
    await expect(page.getByText('Never backed up on this device.')).toBeVisible();
    await page.screenshot({ path: `${shots}/backup-desktop.png`, fullPage: true });
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^solokit-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const backupPath = await download.path();
    const backup = JSON.parse(await readFile(backupPath, 'utf8')) as { collections: { invoices: { number: string }[] } };
    expect(backup.collections.invoices.map((invoice) => invoice.number)).toEqual([number]);
    await expect(page.getByText(/Last backup:/)).toBeVisible();
    await page.getByRole('button', { name: 'Documents' }).click();
    await expect(page.getByText('Back up your invoices')).toHaveCount(0);

    const fresh = await browser.newContext();
    try {
      const other = await fresh.newPage();
      await other.goto('http://localhost:4180/tools/invoice/');
      await expect(other.getByRole('heading', { name: 'Set up your business' })).toBeVisible();
      await other.getByRole('button', { name: /restore a backup/i }).click();

      await other.getByLabel('Backup file').setInputFiles(backupPath);
      const summary = other.getByRole('region', { name: 'Restore this backup?' });
      await expect(summary).toContainText('Asha Rao Consulting');
      await expect(summary).toContainText('1 invoice');
      await other.screenshot({ path: `${shots}/restore-confirm.png`, fullPage: true });
      await other.getByRole('button', { name: /^Yes, replace/ }).click();

      await expect(other.getByRole('listitem').filter({ hasText: number })).toBeVisible();
      await other.reload();
      await expect(other.getByRole('listitem').filter({ hasText: number })).toBeVisible();
      await other.getByRole('button', { name: 'Backup & restore' }).click();
      await expect(other.getByText(/Last backup:/)).toBeVisible();
    } finally {
      await fresh.close();
    }
  });

  test('a file that is not a backup is refused and nothing is lost', async ({ page }, testInfo) => {
    await onboard(page);
    await page.getByRole('button', { name: 'Backup & restore' }).click();
    await page.getByLabel('Backup file').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":"world"}') });
    await expect(page.getByText(/not a SoloKit backup/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Yes, replace/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByLabel('Business or personal name')).toHaveValue('Asha Rao Consulting');
    expect(testInfo.errors).toEqual([]);
  });
});

test.describe('light, dark and phone screenshots', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const [label, size] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 800 }]] as const) {
      test(`editor, themes and backup in ${scheme} on ${label}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize(size);
        await onboard(page);
        await startDocument(page, 'Invoice');
        await expect(page.getByRole('heading', { name: 'New invoice' })).toBeVisible();
        await page.screenshot({ path: `${shots}/shot-editor-${scheme}-${label}.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

        await page.getByRole('button', { name: 'Themes' }).click();
        await expect(page.locator('iframe[title="Invoice preview"]')).toBeVisible({ timeout: 30_000 });
        await page.getByLabel('Text colour', { exact: true }).fill('#EEEEEE');
        await expect(page.getByText(/hard to read/)).toBeVisible();
        await page.screenshot({ path: `${shots}/shot-themes-${scheme}-${label}.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

        await page.getByRole('button', { name: 'Backup & restore' }).click();
        await page.getByLabel('Backup file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from('nope') });
        await expect(page.getByText(/not valid JSON/)).toBeVisible();
        await page.screenshot({ path: `${shots}/shot-backup-${scheme}-${label}.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    }
  }
});
