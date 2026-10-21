import { expect, type Page } from '@playwright/test';

export interface SetupDetails {
  gst?: 'regular' | 'composition' | 'unregistered';
  name?: string;
  gstin?: string;
  line1?: string;
  city?: string;
  email?: string;
}

/** Waits for a setup step's heading. */
export async function onStep(page: Page, title: string) {
  await expect(page.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible();
}

/** Clicks Continue and waits for the next step. */
export async function continueTo(page: Page, title: string) {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await onStep(page, title);
}

/**
 * Goes through the first-time business setup on the setup page (a tool sends a new Business there), filling only the
 * required fields, and finishes it. Defaults: an unregistered seller in Kolkata.
 */
export async function completeSetup(page: Page, details: SetupDetails = {}) {
  const gst = details.gst ?? 'unregistered';
  await onStep(page, 'Tax registration');
  const status = { regular: /Regular GST registration/, composition: /Composition scheme/, unregistered: /Not registered for GST/ }[gst];
  await page.getByRole('radio', { name: status }).check();
  await continueTo(page, 'Business details');
  await page.getByLabel('Business or personal name').fill(details.name ?? 'Asha Rao Consulting');
  if (gst !== 'unregistered') await page.getByLabel('GSTIN').fill(details.gstin ?? '27AABCT3518Q1ZW');
  await page.getByLabel('Address line 1').fill(details.line1 ?? (gst === 'unregistered' ? '4 Park Street' : '12 Linking Road'));
  await page.getByLabel('City', { exact: true }).fill(details.city ?? (gst === 'unregistered' ? 'Kolkata' : 'Mumbai'));
  await page.getByLabel(/^Email/).fill(details.email ?? 'asha@example.com');
  await continueTo(page, 'Logo and brand colours');
  await continueTo(page, 'Getting paid');
  await continueTo(page, 'Invoice defaults');
  await page.getByRole('button', { name: /^Finish/ }).click();
}

/** Opens the invoice tool for a new Business: through setup and back, ready on the Documents tab. */
export async function onboardInvoice(page: Page, details: SetupDetails = {}) {
  await page.goto('/tools/invoice/');
  await completeSetup(page, details);
  await expect(page).toHaveURL(/\/tools\/invoice\/$/);
  await expect(page.getByRole('button', { name: 'Documents' })).toHaveAttribute('aria-current', 'page');
}
