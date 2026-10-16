import type { Page } from '@playwright/test';

/**
 * Starts a new document of the named kind from the Documents page: through the "+ New" chooser when documents exist,
 * or from the cards shown when there are none yet. `name` is the card's name, such as "Tax invoice" or "Quotation".
 */
export async function startDocument(page: Page, name: string) {
  const trigger = page.getByRole('button', { name: 'New', exact: true });
  const cards = page.getByRole('group', { name: /^Choose a document type/ });
  // The list loads after the page shows, so wait for whichever of the two it turns out to be.
  await trigger.or(cards).first().waitFor();
  if (await trigger.count()) await trigger.click();
  await cards.getByRole('button', { name, exact: true }).click();
}
