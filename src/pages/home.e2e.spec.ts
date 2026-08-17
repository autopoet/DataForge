import { expect, test } from '@playwright/test';

// M12 U1: the hero is down to the title, the workbench primary action and a
// quiet type-generator text link — no subtitle, no tagline, no workflow cards.

test.describe('Home page', () => {
  test('hero shows only the title, the workbench button and the type-generator link', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'DataForge' })).toBeVisible();
    await expect(page.locator('[data-test-id="hero-open-workbench"]')).toBeVisible();
    await expect(page.locator('[data-test-id="hero-open-type-generator"]')).toHaveText(/TypeScript types/);

    await expect(page.locator('section.hero p')).toHaveCount(0);
  });

  test('hero entries navigate to the workbench and the type generator', async ({ page }) => {
    await page.goto('/');

    await page.locator('[data-test-id="hero-open-workbench"]').click();
    await expect(page).toHaveURL('/workbench');

    await page.goto('/');
    await page.locator('[data-test-id="hero-open-type-generator"]').click();
    await expect(page).toHaveURL('/type-generator');
  });
});
