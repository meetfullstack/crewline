import { expect, test as setup } from '@playwright/test';
import { DEMO_PASSWORD, storageFor, USERS } from './helpers';

// Sign in once per role and reuse the session in every test. The manager
// goes through the real form; the others sign in via the API.

setup('manager signs in through the login form', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(USERS.manager);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Daniel/ })).toBeVisible();
  await page.context().storageState({ path: storageFor('manager') });
});

setup('employee signs in', async ({ page }) => {
  const response = await page.request.post('/api/auth/login', {
    data: { email: USERS.maya, password: DEMO_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  await page.context().storageState({ path: storageFor('maya') });
});
