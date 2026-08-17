import { expect, test } from '@playwright/test';

// M10 (design doc M10 §1): end-to-end coverage of the workbench main flow —
// paste dirty JSON → green badge → formatted output, view conversion, deep
// decode and download. The detection/parse pipeline runs behind a 300ms
// debounce, so assertions on the badge/output rely on Playwright's built-in
// auto-retry instead of explicit waits.

const dirtyJson = '{\n  // team config\n  "name": "DataForge",\n  "tags": ["json",],\n}';
const dirtyJsonFormatted = JSON.stringify({ name: 'DataForge', tags: ['json'] }, null, 2);
// JSON.stringify(JSON.stringify({ data: JSON.stringify({ a: 1 }) })) — the
// scenario-A fixture shape: a JSON string wrapping an object with a
// string-encoded field (2 decode layers). Built programmatically like the
// fixture so hand-escaped quotes cannot drift from the real-world shape.
const encodedJsonInput = JSON.stringify(JSON.stringify({ data: JSON.stringify({ a: 1 }) }));

test.describe('Tool - workbench', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workbench');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Data workbench - DataForge');
  });

  test('formats pasted dirty JSON (comments, trailing commas) and shows the detection badge', async ({ page }) => {
    await page.getByTestId('workbench-input').fill(dirtyJson);

    const badge = page.getByTestId('format-badge');
    await expect(badge).toContainText('JSON');
    await expect(badge).not.toContainText('low confidence');
    await expect(page.getByTestId('parse-error')).toHaveCount(0);

    const output = page.getByTestId('area-content');
    await expect(output).toContainText('"name": "DataForge"');
    await expect(output).toContainText('"tags"');
  });

  test('shows a parse error row and the empty output state for broken JSON', async ({ page }) => {
    await page.getByTestId('workbench-input').fill('{"left": 1,,}');

    await expect(page.getByTestId('parse-error')).toContainText('Cannot parse as JSON');
    await expect(page.getByTestId('output-empty')).toBeVisible();
  });

  test('converts JSON input to YAML in the YAML view', async ({ page }) => {
    await page.getByTestId('workbench-input').fill(dirtyJson);
    await expect(page.getByTestId('format-badge')).toContainText('JSON');

    await page.getByTestId('view-tabs').getByText('YAML', { exact: true }).click();

    const output = page.getByTestId('area-content');
    await expect(output).toContainText('name: DataForge');
    await expect(output).toContainText('- json');
  });

  test('decodes a multi-layer JSON-encoded string with "Decode all"', async ({ page }) => {
    await page.getByTestId('workbench-input').fill(encodedJsonInput);

    await expect(page.getByTestId('decode-banner')).toContainText('~2 layers');

    await page.getByTestId('decode-all').click();

    await expect(page.getByTestId('decode-banner')).toHaveCount(0);
    await expect(page.getByTestId('format-badge')).toContainText('JSON');
    const output = page.getByTestId('area-content');
    await expect(output).toContainText('"data"');
    await expect(output).toContainText('"a": 1');
  });

  test('peels a single layer with "Decode one layer"', async ({ page }) => {
    await page.getByTestId('workbench-input').fill(encodedJsonInput);

    await page.getByTestId('decode-one').click();

    // One layer down: the input is now a plain object with a still-encoded
    // field, so the banner stays up with a single remaining layer.
    await expect(page.getByTestId('decode-banner')).toContainText('~1 layers');
    await page.getByTestId('decode-one').click();
    await expect(page.getByTestId('decode-banner')).toHaveCount(0);
  });

  test('downloads the formatted view with a matching filename and content', async ({ page }) => {
    await page.getByTestId('workbench-input').fill(dirtyJson);
    await expect(page.getByTestId('area-content')).toContainText('"name": "DataForge"');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-output').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^dataforge-formatted-\d{8}-\d{6}\.json$/);

    const stream = await download.createReadStream();
    const content = await new Promise<string>((resolve, reject) => {
      const decoder = new TextDecoder('utf-8');
      let text = '';
      stream?.on('data', (chunk: Uint8Array) => {
        text += decoder.decode(chunk, { stream: true });
      });
      stream?.on('end', () => resolve(text + decoder.decode()));
      stream?.on('error', reject);
    });
    expect(content).toBe(dirtyJsonFormatted);
  });
});
