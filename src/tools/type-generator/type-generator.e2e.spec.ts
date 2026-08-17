import { expect, test } from '@playwright/test';

test.describe('Tool - type generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/type-generator');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('TypeScript type generator - DataForge');
  });

  test('generates pasteable TypeScript types from pasted JSON', async ({ page }) => {
    await page.getByTestId('input').fill('{"user":{"name":"Ada","roles":["admin","viewer"]}}');

    const output = await page.getByTestId('area-content').innerText();

    expect(output).toContain('export interface Root');
    expect(output).toContain('user: RootUser;');
    expect(output).toContain('roles: (\'admin\' | \'viewer\')[];');
  });

  test('shows a validation error for invalid JSON', async ({ page }) => {
    await page.getByTestId('input').fill('{"broken": }');

    await expect(page.getByText('Provided JSON is not valid.')).toBeVisible();
  });

  test('copies the generated types to the clipboard', async ({ page, context }) => {
    // Chromium on Linux (CI) rejects clipboard-read as an unknown permission;
    // grant what the platform knows and rely on the copy toast below.
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await page.getByTestId('input').fill('{"a": 1}');

    await page.getByTestId('copy-output').click();

    // M12 U7: TextareaCopyable fires a success toast on copy (copy.success)
    await expect(page.getByText('Copied to the clipboard')).toBeVisible();

    // Deep content check only where the platform exposes the clipboard
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText().then(text => text, () => null));
    if (clipboardText !== null) {
      expect(clipboardText).toContain('export interface Root');
      expect(clipboardText).toContain('a: number;');
    }
  });

  // M10 (design doc M10 §1): the cross-page handoff (decision A6) — the
  // workbench TypeScript view hands its current IR to this page through
  // sessionStorage, so the dedicated page opens with the data already loaded.
  test('receives the workbench data through the handoff and generates types from it', async ({ page }) => {
    await page.goto('/workbench');
    await page.getByTestId('workbench-input').fill('{"user":{"name":"Ada"}}');
    await expect(page.getByTestId('format-badge')).toContainText('JSON');

    await page.getByTestId('view-tabs').getByText('TypeScript', { exact: true }).click();
    await page.getByTestId('open-in-type-generator').click();

    await expect(page).toHaveURL(/\/type-generator\?from=workbench$/);
    const output = await page.getByTestId('area-content').innerText();
    expect(output).toContain('export interface Root');
    expect(output).toContain('user: RootUser;');
  });
});
