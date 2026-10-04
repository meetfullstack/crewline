import { expect, test } from '@playwright/test';
import { storageFor } from './helpers';

test.use({ storageState: storageFor('manager') });

test('dashboard shows staffing, labour and what needs attention', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('Clocked in now')).toBeVisible();
  await expect(page.getByText("Today's labour")).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Labour cost by day' })).toBeVisible();
});

test('schedule builder loads the week with conflicts and totals', async ({ page }) => {
  await page.goto('/schedule');
  await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
  const grid = page.getByRole('table', { name: 'Weekly schedule' });
  await expect(grid).toBeVisible();
  await expect(grid.getByText('Open shifts')).toBeVisible();
  await expect(page.getByText('Scheduled hours')).toBeVisible();

  // Next week is the seeded draft: publishable, with warnings to review.
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
});

test('shift editor checks conflicts live before saving', async ({ page }) => {
  await page.goto('/schedule');
  // Open a shift that belongs to someone (open shifts have nothing to check).
  await page
    .locator('[role="row"]:not(:has-text("Open shifts")) [aria-roledescription="Draggable shift"]')
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Edit shift' })).toBeVisible();
  // The live check settles on either "No conflicts" or a list of issues.
  await expect(
    dialog.getByText(/No conflicts|already working|unavailable|rest between|over .* limit|overtime|isn't trained|time off|on leave/),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
});

test('timesheets list scheduled vs worked hours', async ({ page }) => {
  await page.goto('/timesheets');
  await expect(page.getByRole('heading', { name: 'Timesheets' })).toBeVisible();
  await expect(page.getByText('Attendance issues')).toBeVisible();
  await page.getByRole('button', { name: 'Previous week' }).click();
  await expect(page.getByRole('columnheader', { name: 'Worked' })).toBeVisible();
});
