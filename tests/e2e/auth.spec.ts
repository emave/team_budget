import { test, expect } from '@playwright/test';

test('redirects unauthenticated user to /login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('h1')).toContainText('Team Budget');
});

test('login page renders without errors', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('h1')).toContainText('Team Budget');
});
