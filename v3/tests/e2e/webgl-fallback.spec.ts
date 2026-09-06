import { expect, test } from '@playwright/test';

test.use({ launchOptions: { args: ['--disable-webgl', '--disable-gpu'] } });

test('the learning UI stays usable without WebGL', async ({ page }) => {
    await page.goto('/?demo=student#/home');
    await expect(page.getByRole('heading', { name: /ТВІЙ ДЕНЬ/ })).toBeVisible();
    await page.getByRole('button', { name: /Продовжити урок/ }).click();
    await expect(page.getByRole('heading', { name: 'Present Perfect', exact: true })).toBeVisible();
});
