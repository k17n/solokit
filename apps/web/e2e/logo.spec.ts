import { expect, test, type Page } from '@playwright/test';

async function openProfileTab(page: Page) {
  await page.goto('/tools/invoice/');
  await page.getByRole('radio', { name: /Not registered for GST/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Business or personal name').fill('Ravi Kumar Design');
  await page.getByLabel('Address line 1').fill('4 Park Street');
  await page.getByLabel('City').fill('Kolkata');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Profile' }).click();
}

test.describe('logo upload in a real browser', () => {
  test('a PNG, a viewBox-only SVG and a wrong file type', async ({ page }) => {
    await openProfileTab(page);
    const logo = page.locator('img[alt="Your logo"]');
    const input = page.locator('input[type="file"]');

    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 80;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#c0392b';
      context.fillRect(0, 0, 200, 80);
      return canvas.toDataURL('image/png').split(',')[1]!;
    });
    await input.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await expect(logo).toHaveAttribute('src', /^data:image\/png;base64,/);
    const pngSize = await logo.evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight }));
    console.log('PNG logo stored at', pngSize);

    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><rect width="100" height="40" fill="#0b1b3a"/></svg>';
    await input.setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
    await expect(logo).toHaveAttribute('src', /^data:image\/png;base64,/);
    await expect(logo).not.toHaveAttribute('src', new RegExp(`${png.slice(0, 40)}`));
    const svgSize = await logo.evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight }));
    console.log('SVG logo stored at', svgSize);

    await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
    await expect(page.locator('form').getByRole('alert')).toContainText('Choose a PNG, JPEG, WebP, GIF or SVG image.');
  });
});
