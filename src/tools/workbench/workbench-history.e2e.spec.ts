import { expect, test } from '@playwright/test';

// M10 (design doc M10 §1): the history snapshot flow — edit the input, wait
// for the debounced snapshot to land, then compare a snapshot against the
// current input in the diff modal, restore one, and clear the history through
// the confirmation dialog. Snapshots are pushed 300ms (input debounce) + 2s
// (store debounce) after an edit, so the History (N) assertions below run with
// a generous timeout instead of a fixed sleep.

const inputA = '{"name":"alpha","version":1}';
const inputB = '{"name":"beta","version":2,"extra":true}';

test.describe('Tool - workbench history', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workbench');
  });

  test('records snapshots as the input changes and compares a snapshot against the current input', async ({ page }) => {
    await page.getByTestId('workbench-input').fill(inputA);
    await expect(page.getByTestId('history-open')).toContainText('History (1)', { timeout: 15_000 });

    await page.getByTestId('workbench-input').fill(inputB);
    await expect(page.getByTestId('history-open')).toContainText('History (2)', { timeout: 15_000 });

    await page.getByTestId('history-open').click();
    await expect(page.getByTestId('history-drawer')).toBeVisible();
    await expect(page.getByTestId('history-item')).toHaveCount(2);

    // Snapshots are newest-first: the second one is the original input A.
    await page.getByTestId('history-item').nth(1).getByTestId('history-compare').click();

    const diffModal = page.getByTestId('diff-modal');
    await expect(diffModal).toBeVisible();
    const diffResult = diffModal.getByTestId('diff-result');
    await expect(diffResult).toContainText('alpha');
    await expect(diffResult).toContainText('beta');
    await expect(diffResult).toContainText('extra');
  });

  test('restores a snapshot back into the input and closes the drawer', async ({ page }) => {
    await page.getByTestId('workbench-input').fill(inputA);
    await expect(page.getByTestId('history-open')).toContainText('History (1)', { timeout: 15_000 });

    await page.getByTestId('workbench-input').fill(inputB);
    await expect(page.getByTestId('history-open')).toContainText('History (2)', { timeout: 15_000 });

    await page.getByTestId('history-open').click();
    await expect(page.getByTestId('history-drawer')).toBeVisible();

    await page.getByTestId('history-item').nth(1).getByTestId('history-restore').click();

    await expect(page.getByTestId('history-drawer')).toBeHidden();
    await expect(page.getByTestId('workbench-input')).toHaveValue(inputA);
  });

  test('clears the whole history through the confirmation dialog', async ({ page }) => {
    await page.getByTestId('workbench-input').fill(inputA);
    await expect(page.getByTestId('history-open')).toContainText('History (1)', { timeout: 15_000 });

    await page.getByTestId('history-open').click();
    await page.getByTestId('history-clear').click();
    await page.getByTestId('confirm').click();

    await expect(page.getByTestId('history-empty')).toBeVisible();
    await expect(page.getByTestId('history-open')).toContainText('History (0)');
  });
});
