import { expect, test } from '@playwright/test'

test('landing page renders without a blank screen', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('body')).toBeVisible()
  await expect(page.locator('body')).not.toBeEmpty()
})
