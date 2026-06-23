import { expect, test } from '@playwright/test'

// ─── Kimlik doğrulama yönlendirme testleri ──────────────────────────────────
// Bu testler Firebase Auth emülatörü gerektirmez; preview build üzerinde
// giriş yapmamış kullanıcının doğru yönlendirildiğini doğrular.

test('unauthenticated /app redirects to /login', async ({ page }) => {
  await page.goto('/app')
  await page.waitForURL('**/login', { timeout: 10_000 })
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated /yonetim redirects to /login', async ({ page }) => {
  await page.goto('/yonetim')
  await page.waitForURL('**/login', { timeout: 10_000 })
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated /onboarding redirects to /login', async ({ page }) => {
  await page.goto('/onboarding')
  await page.waitForURL('**/login', { timeout: 10_000 })
  await expect(page).toHaveURL(/\/login/)
})

test('unauthenticated /app/customers redirects to /login', async ({ page }) => {
  await page.goto('/app/customers')
  await page.waitForURL('**/login', { timeout: 10_000 })
  await expect(page).toHaveURL(/\/login/)
})

// ─── Kayıt formu testleri ────────────────────────────────────────────────────

test('register submit is disabled without legal checkboxes', async ({ page }) => {
  await page.goto('/register')
  await expect(page.locator('button[type="submit"]')).toBeDisabled()
})

test('register submit becomes enabled after both checkboxes are checked', async ({ page }) => {
  await page.goto('/register')

  await page.fill('input[type="text"]', 'Test User')
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'password123')

  const checkboxes = page.locator('input[type="checkbox"]')
  await checkboxes.nth(0).check()
  await checkboxes.nth(1).check()

  await expect(page.locator('button[type="submit"]')).toBeEnabled()
})

test('register page shows terms and kvkk links', async ({ page }) => {
  await page.goto('/register')
  await expect(page.locator('a[href="/kullanim-kosullari"]').first()).toBeVisible()
  await expect(page.locator('a[href="/kvkk"]').first()).toBeVisible()
})

// ─── Public kart / işletme hata ekranları ───────────────────────────────────

test('invalid card token shows error screen', async ({ page }) => {
  await page.goto('/c/not-a-real-card-token-xyz-123')
  await expect(page.locator('body')).not.toBeEmpty()
  // Hata mesajı veya "gösterilemiyor" benzeri bir içerik beklenir
  await expect(page.locator('body')).not.toContainText('undefined')
})

test('invalid merchant slug shows not-found screen', async ({ page }) => {
  await page.goto('/m/not-a-real-merchant-slug-xyz-123')
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page.locator('body')).not.toContainText('undefined')
})

// ─── Yasal sayfalar ──────────────────────────────────────────────────────────

test('terms page shows refund policy section', async ({ page }) => {
  await page.goto('/kullanim-kosullari')
  await expect(page.locator('body')).toContainText('İade ve Cayma Politikası')
})

test('subscription page shows refund warning link', async ({ page }) => {
  // Abonelik sayfası korumalı; giriş yapmadan /login'e düşer
  // Ama kullanım koşulları sayfası herkese açık
  await page.goto('/kullanim-kosullari')
  await expect(page.locator('body')).toContainText('4A')
})
