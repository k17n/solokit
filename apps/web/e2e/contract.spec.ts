import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { FIRST, SECOND, docxXml, downloadFrom, fillJurisdiction, fillParty, noOverflow, pdfText, squash, startAgreement } from './contract-helpers';

const shots = 'test-results';

async function fillNda(page: Page) {
  await fillParty(page, 1, FIRST);
  await fillParty(page, 2, SECOND);
  await page.getByLabel('Purpose of sharing the information').fill('evaluating a possible website redesign project');
  await fillJurisdiction(page, 'Mumbai', 'Maharashtra');
}

async function createMutualNda(page: Page) {
  await page.goto('/tools/contract/');
  await expect(page.getByRole('heading', { name: 'Start your first agreement' })).toBeVisible();
  await startAgreement(page, 'Mutual NDA');
  await expect(page.getByRole('heading', { level: 2, name: 'New mutual nda' })).toBeVisible();
  await fillNda(page);
}

async function fillServices(page: Page) {
  await fillParty(page, 1, FIRST);
  await fillParty(page, 2, SECOND);
  await fillJurisdiction(page, 'Mumbai', 'Maharashtra');
  const terms = page.getByRole('region', { name: /Key terms/ });
  await terms.getByLabel(/^Services/).fill('Design a five-page marketing website\nSet up the contact form');
  await terms.getByLabel(/^Deliverables/).fill('Figma design files\nResponsive HTML and CSS');
  await terms.getByRole('radio', { name: /Fees per milestone/ }).check();
  await terms.getByRole('button', { name: 'Add a milestone' }).click();
  await terms.getByLabel('Milestone name').fill('Design approved');
  await terms.getByLabel('Amount (INR)').fill('40000');
  await terms.getByLabel('Due when').fill('on approval of the designs');
  await terms.getByRole('button', { name: 'Add a milestone' }).click();
  await terms.getByLabel('Milestone name').nth(1).fill('Site live');
  await terms.getByLabel('Amount (INR)').nth(1).fill('80000');
  await terms.getByLabel('Due when').nth(1).fill('on launch');
}

test.describe('contracts in a real browser', () => {
  test('creates a mutual NDA, previews it and downloads the PDF, Word file and review pack', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await createMutualNda(page);

    await page.getByRole('button', { name: 'Show preview' }).click();
    await expect(page.locator('iframe[title="Agreement preview"]')).toBeVisible({ timeout: 45_000 });

    const pdf = await downloadFrom(page, page.getByRole('button', { name: 'Download PDF' }));
    expect(pdf.suggestedFilename()).toBe('Mutual-NDA-with-Northwind-Traders-Private-Limited.pdf');
    const text = squash(await pdfText(pdf));
    for (const expected of [
      'Mutual Non-Disclosure Agreement',
      'Asha Rao Consulting',
      'Northwind Traders Private Limited',
      'evaluating a possible website redesign project',
      'Signed for and on behalf of Asha Rao Consulting',
      'Signature',
      'Ravi Menon',
      'Director',
      'Mumbai',
    ]) {
      expect(text).toContain(squash(expected));
    }

    const docx = await downloadFrom(page, page.getByRole('button', { name: 'Download Word' }));
    expect(docx.suggestedFilename()).toMatch(/\.docx$/);
    const xml = await docxXml(docx);
    expect(xml).toContain('Asha Rao Consulting');
    expect(xml).toContain('Northwind Traders Private Limited');

    const pack = await downloadFrom(page, page.getByRole('button', { name: 'Download review pack' }));
    expect(pack.suggestedFilename()).toMatch(/-Review-Pack\.pdf$/);
    expect(squash(await pdfText(pack))).toContain(squash('Questions for your lawyer'));

    const packDocx = await downloadFrom(page, page.getByRole('button', { name: 'Review pack as Word' }));
    expect(await docxXml(packDocx)).toContain('Questions for your lawyer');
    expect(problems).toEqual([]);
  });

  test('a services agreement with milestones prints the schedule and the milestone amounts', async ({ page }) => {
    await page.goto('/tools/contract/');
    await startAgreement(page, 'Freelance services');
    await fillServices(page);
    const text = squash(await pdfText(await downloadFrom(page, page.getByRole('button', { name: 'Download PDF' }))));
    for (const expected of ['Freelance Services Agreement', 'Schedule 1', 'Design a five-page marketing website', 'Milestone 1: Design approved', 'INR 40,000', 'Milestone 2: Site live', 'INR 80,000', 'Total of the milestones: INR 1,20,000']) {
      expect(text).toContain(squash(expected));
    }
  });

  test('a draft survives a reload, is finalised, and can be reopened', async ({ page }) => {
    await createMutualNda(page);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved')).toBeVisible();
    await page.reload();
    const row = page.getByRole('listitem').filter({ hasText: 'Mutual NDA with Northwind Traders Private Limited' });
    await expect(row).toContainText('Draft');
    await row.getByRole('button', { name: /^Open / }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Edit draft' })).toBeVisible();
    await expect(page.getByLabel('Purpose of sharing the information')).toHaveValue('evaluating a possible website redesign project');

    await page.getByRole('button', { name: 'Finalise agreement' }).click();
    await expect(page.getByText(/Its wording is locked/)).toBeVisible();
    await page.getByRole('button', { name: 'Yes, finalise' }).click();
    await expect(page.getByText('This agreement is final')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Questions for your lawyer' })).toBeVisible();

    await page.getByRole('button', { name: 'Back to agreements' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Northwind' })).toContainText('Final');
    await page.getByRole('button', { name: /^Reopen / }).click();
    await page.getByRole('button', { name: 'Yes, reopen' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Edit draft' })).toBeVisible();
  });

  test('shows what is missing and focuses the first problem', async ({ page }) => {
    await page.goto('/tools/contract/');
    await startAgreement(page, 'One-way NDA');
    await page.getByRole('button', { name: 'Finalise agreement' }).click();
    await expect(page.getByText(/Fix \d+ things before you finalise or download/)).toBeVisible();
    await expect(page.getByLabel('Disclosing Party: full name')).toBeFocused();
    await expect(page.getByLabel('Disclosing Party: full name')).toHaveAttribute('aria-invalid', 'true');
  });

  test('asks before a tab click throws away typing, and a very long purpose reaches the PDF in full', async ({ page }) => {
    await createMutualNda(page);
    const words = Array.from({ length: 640 }, (_, index) => `w${String(index + 1).padStart(4, '0')}`);
    await page.getByLabel('Purpose of sharing the information').fill(words.join(' '));
    await page.getByRole('button', { name: 'Backup & restore' }).click();
    await expect(page.getByText('You have changes that are not saved.')).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByLabel('Purpose of sharing the information')).toHaveValue(words.join(' '));
    const text = await pdfText(await downloadFrom(page, page.getByRole('button', { name: 'Download PDF' })));
    const found = new Set(text.match(/\bw\d{4}\b/g) ?? []);
    expect([...found].sort()).toEqual(words);
    expect(squash(text)).toContain(squash('Prepared from a SoloKit template. A template is not legal advice.'));
    await page.getByRole('button', { name: 'Backup & restore' }).click();
    await page.getByRole('button', { name: 'Leave without saving' }).click();
    await expect(page.getByRole('button', { name: 'Download backup' })).toBeVisible();
  });

  test('a backup carries the agreements and a restore brings them back', async ({ page }) => {
    await createMutualNda(page);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved')).toBeVisible();
    await page.getByRole('button', { name: 'Back to agreements' }).click();
    await page.getByRole('button', { name: 'Backup & restore' }).click();
    const download = await downloadFrom(page, page.getByRole('button', { name: 'Download backup' }));
    const path = await download.path();
    const backup = JSON.parse(await readFile(path, 'utf8')) as { collections: { contracts: { title: string }[] } };
    expect(backup.collections.contracts).toHaveLength(1);

    await page.getByRole('button', { name: 'Agreements' }).click();
    await page.getByRole('button', { name: /^Delete draft / }).click();
    await page.getByRole('button', { name: 'Yes, delete draft' }).click();
    await expect(page.getByRole('heading', { name: 'Start your first agreement' })).toBeVisible();

    await page.getByRole('button', { name: 'Backup & restore' }).click();
    await page.getByLabel('Backup file').setInputFiles(path);
    const summary = page.getByRole('region', { name: 'Restore this backup?' });
    await expect(summary).toContainText('1 agreement');
    await summary.getByRole('button', { name: 'Yes, replace my data' }).click();
    await page.getByRole('button', { name: 'Agreements' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Mutual NDA with Northwind' })).toBeVisible();
  });

  test('an agreement can be created and downloaded offline', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.goto('/tools/contract/');
    for (let i = 0; i < 5; i++) {
      if (await page.evaluate(() => navigator.serviceWorker.controller !== null)) break;
      await page.reload();
    }
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await context.setOffline(true);
    await page.goto('/tools/contract/');
    await startAgreement(page, 'Mutual NDA');
    await fillNda(page);
    const text = squash(await pdfText(await downloadFrom(page, page.getByRole('button', { name: 'Download PDF' }))));
    expect(text).toContain(squash('Mutual Non-Disclosure Agreement'));
    const docx = await downloadFrom(page, page.getByRole('button', { name: 'Download Word' }));
    expect(await docxXml(docx)).toContain('Northwind Traders Private Limited');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved')).toBeVisible();
  });
});

test.describe('contracts on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('has no horizontal overflow, and the preview opens in its own tab', async ({ page }) => {
    await createMutualNda(page);
    expect(await noOverflow(page)).toBe(true);
    await page.getByRole('button', { name: 'Show preview' }).click();
    const link = page.getByRole('link', { name: 'Open preview in a new tab' });
    await expect(link).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('iframe[title="Agreement preview"]')).toHaveCount(0);
    expect(await link.getAttribute('href')).toMatch(/^blob:/);
    expect(await noOverflow(page)).toBe(true);
    await page.getByRole('button', { name: 'Back to agreements' }).click();
    await page.getByRole('button', { name: 'Leave without saving' }).click();
    await expect(page.getByRole('heading', { name: 'Start your first agreement' })).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
  });
});

for (const scheme of ['light', 'dark'] as const) {
  for (const [label, viewport] of [
    ['desktop', { width: 1280, height: 800 }],
    ['mobile', { width: 390, height: 844 }],
  ] as const) {
    test(`screenshots ${scheme} ${label}`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: scheme, viewport });
      const page = await context.newPage();
      await page.goto('/tools/contract/');
      await expect(page.getByRole('heading', { name: 'Start your first agreement' })).toBeVisible();
      await page.screenshot({ path: `${shots}/contract-empty-${scheme}-${label}.png` });
      await startAgreement(page, 'Freelance services');
      await fillServices(page);
      await page.getByRole('button', { name: 'Save draft' }).click();
      await expect(page.getByText('Draft saved')).toBeVisible();
      await page.locator('#sec-parties').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${shots}/contract-editor-${scheme}-${label}.png` });
      await page.locator('#sec-terms').screenshot({ path: `${shots}/contract-terms-${scheme}-${label}.png` });
      await page.getByRole('button', { name: 'Show preview' }).click();
      await expect(page.getByRole('link', { name: 'Open preview in a new tab' })).toBeVisible({ timeout: 45_000 });
      await page.locator('#sec-review').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${shots}/contract-preview-${scheme}-${label}.png` });
      await page.getByRole('button', { name: 'Back to agreements' }).click();
      await page.getByRole('button', { name: 'New', exact: true }).click();
      await page.screenshot({ path: `${shots}/contract-chooser-${scheme}-${label}.png` });
      await page.keyboard.press('Escape');
      await page.screenshot({ path: `${shots}/contract-list-${scheme}-${label}.png` });
      expect(await noOverflow(page)).toBe(true);
      await context.close();
    });
  }
}
