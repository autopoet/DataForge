import { expect, test } from '@playwright/test';

test.describe('Tool - Text diff', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/text-diff');
  });

  test('shows a live diff of the two inputs', async ({ page }) => {
    await page.getByTestId('original').fill('hello world');
    await page.getByTestId('modified').fill('hello there');

    // Monaco is loaded from its own chunk, so wait until the diff editor is
    // mounted and the modified pane has rendered the second input.
    await expect(page.locator('.monaco-diff-editor .editor.modified .view-line')).toContainText('hello there');
  });
});
