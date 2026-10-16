import { readFile } from 'node:fs/promises';
import { expect, type Download, type Locator, type Page } from '@playwright/test';
import JSZip from 'jszip';

export async function pdfText(download: Download): Promise<string> {
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

/** The text of word/document.xml inside a downloaded .docx, after unzipping it. */
export async function docxXml(download: Download): Promise<string> {
  const zip = await JSZip.loadAsync(await readFile(await download.path()));
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('word/document.xml is missing from the .docx');
  return file.async('string');
}

export const squash = (text: string) => text.replace(/\s+/g, '');

export interface PartyDetails {
  name: string;
  line1: string;
  city: string;
  email: string;
  signatory: string;
  title: string;
  state?: string;
}

/** Fills one party's fieldset ("Party 1", "Party 2") on the editor. */
export async function fillParty(page: Page, number: 1 | 2, details: PartyDetails) {
  const group = page.getByRole('group', { name: new RegExp(`^Party ${number}:`) });
  await group.getByLabel(/: full name$/).fill(details.name);
  await group.getByLabel('Address line 1').fill(details.line1);
  await group.getByLabel('City', { exact: true }).fill(details.city);
  if (details.state) await group.getByLabel('State', { exact: true }).selectOption({ label: details.state });
  await group.getByLabel('Email for notices').fill(details.email);
  await group.getByLabel("Signatory's name").fill(details.signatory);
  await group.getByLabel("Signatory's role").fill(details.title);
}

export async function fillJurisdiction(page: Page, city: string, state: string) {
  const section = page.getByRole('region', { name: /Jurisdiction and stamp duty/ });
  await section.getByLabel('City whose courts apply').fill(city);
  await section.getByLabel('State', { exact: true }).selectOption({ label: state });
}

export const FIRST: PartyDetails = {
  name: 'Asha Rao Consulting',
  line1: '12 Linking Road',
  city: 'Mumbai',
  state: 'Maharashtra',
  email: 'asha@example.com',
  signatory: 'Asha Rao',
  title: 'Proprietor',
};

export const SECOND: PartyDetails = {
  name: 'Northwind Traders Private Limited',
  line1: '4 MG Road',
  city: 'Pune',
  state: 'Maharashtra',
  email: 'legal@northwind.example',
  signatory: 'Ravi Menon',
  title: 'Director',
};

export async function startAgreement(page: Page, name: string) {
  const trigger = page.getByRole('button', { name: 'New', exact: true });
  const cards = page.getByRole('group', { name: /^Choose an agreement type/ });
  // The list loads after the page shows, so wait for whichever of the two it turns out to be.
  await trigger.or(cards).first().waitFor();
  if (await trigger.count()) await trigger.click();
  await cards.getByRole('button', { name, exact: false }).first().click();
}

export async function downloadFrom(page: Page, button: Locator): Promise<Download> {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), button.click()]);
  return download;
}

export const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

export async function expectEditorOpen(page: Page, heading: RegExp) {
  await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
}
