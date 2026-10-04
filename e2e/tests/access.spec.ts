import { expect, test } from '@playwright/test';
import { storageFor } from './helpers';

test.describe('signed out', () => {
  test('protected pages send visitors to sign in and back', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page).toHaveURL(/\/login\?next=%2Fschedule/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('wrong password shows a clear error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@harbourvine.test');
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    // (Next.js also renders an empty route-announcer alert, so match by text.)
    await expect(page.getByRole('alert').filter({ hasText: /don.t match/ })).toBeVisible();
  });
});

test.describe('employees', () => {
  test.use({ storageState: storageFor('maya') });

  test('see the staff navigation, not manager pages', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'My shifts' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Employees' })).toHaveCount(0);

    // The API refuses manager data even if the URL is visited directly.
    const response = await page.request.get('/api/employees');
    expect(response.status()).toBe(403);
  });
});
