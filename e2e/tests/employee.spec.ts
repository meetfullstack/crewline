import { expect, type Page, test } from '@playwright/test';
import { daysFromNow, storageFor } from './helpers';

test.use({ storageState: storageFor('maya') });

const clockCard = (page: Page) => page.getByRole('region', { name: 'Time clock' });

test('clock in, take a break and clock out', async ({ page }) => {
  // Clocking in outside a shift asks for confirmation.
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/dashboard');
  const card = clockCard(page);
  await expect(card).toBeVisible();

  // Leave a clean state if an earlier run stopped half-way.
  if (await card.getByRole('button', { name: 'End break' }).isVisible()) {
    await card.getByRole('button', { name: 'End break' }).click();
  }
  if (await card.getByRole('button', { name: 'Clock out' }).isVisible()) {
    await card.getByRole('button', { name: 'Clock out' }).click();
    await expect(card.getByText('Not clocked in', { exact: true })).toBeVisible();
  }

  await card.getByRole('button', { name: 'Clock in' }).click();
  await expect(card.getByText('Clocked in', { exact: true })).toBeVisible();

  await card.getByRole('button', { name: 'Break' }).click();
  await expect(card.getByText('On break', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'End break' }).click();
  await expect(card.getByText('Clocked in', { exact: true })).toBeVisible();

  await card.getByRole('button', { name: 'Clock out' }).click();
  await expect(card.getByText('Not clocked in', { exact: true })).toBeVisible();
});

test('time off: employee requests, manager approves, employee sees it', async ({ page, browser }) => {
  // A date far enough out (and varied per run) to avoid overlapping requests.
  const day = daysFromNow(120 + (Date.now() % 150));
  const reason = `E2E ${Date.now()}`;

  await page.goto('/time-off');
  await page.getByLabel('First day').fill(day);
  await page.getByLabel(/Reason/).fill(reason);
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText('Request sent to your manager')).toBeVisible();
  const mine = page.getByRole('listitem').filter({ hasText: reason });
  await expect(mine.getByText('Pending', { exact: true })).toBeVisible();

  // The manager approves it in their own session.
  const manager = await browser.newContext({ storageState: storageFor('manager') });
  const managerPage = await manager.newPage();
  await managerPage.goto('/time-off');
  const card = managerPage.getByRole('listitem').filter({ hasText: reason });
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(managerPage.getByText(/Approved Maya's request/)).toBeVisible();
  await manager.close();

  // Live update: Maya's open page reflects the approval without a reload.
  await expect(mine.getByText('Approved', { exact: true })).toBeVisible({ timeout: 10_000 });
});
