import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { expect, type Download, type Page } from '@playwright/test';
import { completeSetup } from './setup-helpers';

/** Every flate-compressed stream in a PDF, decompressed and joined, so drawing colours can be looked for. */
export function pdfContent(data: Buffer): string {
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
export function paintsWith(content: string, hex: string): boolean {
  const wanted = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (const match of content.matchAll(/(\d+(?:\.\d+)?) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?) (?:rg|RG|scn|SCN)/g)) {
    const found = [match[1], match[2], match[3]].map((value) => Math.round(Number(value) * 255));
    if (found.every((value, index) => value === wanted[index])) return true;
  }
  return false;
}

export async function pdfBytes(download: Download): Promise<Buffer> {
  return readFile(await download.path());
}

/**
 * A real PNG made by the browser's own canvas: a transparent background, a big terracotta mark and a smaller teal one.
 * Returns the file contents, ready for `setInputFiles`.
 */
export async function makeLogoPng(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 120;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#C2410C';
    context.fillRect(20, 20, 180, 80);
    context.fillStyle = '#0F766E';
    context.fillRect(220, 40, 60, 40);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  return Buffer.from(base64, 'base64');
}

/**
 * Sets up the current Business through the setup page and comes back to /app/business/. Starts from wherever the page is:
 * already on the setup page (adding a business goes there), or anywhere else. Leaves the page on /app/business/.
 */
export async function saveBusinessDetails(page: Page, details: { name: string; line1?: string; city?: string; email?: string }) {
  if (!new URL(page.url()).pathname.startsWith('/app/setup/')) await page.goto('/app/setup/?next=%2Fapp%2Fbusiness%2F');
  await completeSetup(page, { gst: 'unregistered', ...details });
  await expect(page).toHaveURL(/\/app\/business\/$/);
  await expect(page.getByRole('heading', { name: 'This business' })).toBeVisible();
}

/** The business switcher in the app's sidebar. On a phone the sidebar is a drawer, so this opens the Menu first. */
export async function openSwitcher(page: Page) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click();
  const trigger = page.getByRole('complementary', { name: 'SoloKit app' }).getByRole('button', { name: /^Business\b/ });
  await trigger.click();
  return trigger;
}

export async function fillInvoice(page: Page) {
  await page.getByLabel('Client name').fill('Local Client');
  await page.getByLabel('Address line 1', { exact: true }).fill('9 Lake Road');
  await page.getByLabel('City', { exact: true }).fill('Kolkata');
  await page.getByLabel('Description').first().fill('Design work');
  await page.getByLabel('Quantity').first().fill('2');
  await page.getByLabel(/^Rate \(/).first().fill('2500');
}

export async function issue(page: Page): Promise<string> {
  const number = await page.getByLabel('Invoice number').inputValue();
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  await expect(page.getByRole('heading', { name: number })).toBeVisible();
  return number;
}

/** Names of the IndexedDB databases this origin has. */
export async function databaseNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name ?? '').sort());
}
