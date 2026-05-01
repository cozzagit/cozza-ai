import { test, expect } from '@playwright/test';

test.describe('cozza-ai · smoke', () => {
  test('loads with empty state and dark OLED background', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/cozza-ai/);

    // Empty hint visible
    await expect(page.getByText(/inizia a parlare con cozza-ai/i)).toBeVisible();

    // OLED background applied
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toMatch(/rgb\(0,\s*0,\s*0\)/);
  });

  test('has a valid PWA manifest', async ({ page }) => {
    await page.goto('/');
    const href = await page.getAttribute('link[rel="manifest"]', 'href');
    expect(href).toBeTruthy();
    if (!href) return;
    const res = await page.request.get(href);
    expect(res.ok()).toBe(true);
    const manifest = (await res.json()) as { name: string; display: string; theme_color: string };
    expect(manifest.name).toBe('cozza-ai');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#000000');
  });

  test('model selector exposes 4 options', async ({ page }) => {
    await page.goto('/');
    const radios = page.getByRole('radio');
    await expect(radios).toHaveCount(4);
    await expect(radios.nth(0)).toHaveAccessibleName('Haiku');
    await expect(radios.nth(3)).toHaveAccessibleName('4o');
  });

  test('voice button is visible and tappable', async ({ page }) => {
    await page.goto('/');
    const mic = page.getByRole('button', { name: /tieni premuto per parlare|voice non disponibile/i });
    await expect(mic).toBeVisible();
  });
});
