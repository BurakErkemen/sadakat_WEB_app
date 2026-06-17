# DECISIONS.md

Çelişkili veya belirsiz noktalarda alınan mimari kararlar.

---

## D-001: Merchant ID formatı
**Karar:** `{uid}_{timestamp}` formatı kullanıldı (örn. `abc123_1718600000000`).  
**Neden:** Cloud Functions yok, Admin SDK yok. UID tabanlı ID'ler kolay çakışma yaratmaz ve onboarding'de `users.merchantId` pointer'ı sırayla yazılabilir.

## D-002: Onboarding'de publicSlugs batch'lenemiyor
**Karar:** Onboarding üç sıralı işlemde yapılır (merchant oluştur → users.merchantId güncelle → publicSlugs oluştur), tek batch değil.  
**Neden:** SPEC bölüm 8: "Slug create kuralı merchant'ın önceden var olmasına baktığından bu üçlü batch'lenemez; sırayla yap."

## D-003: Admin UID'leri ortam değişkeninden
**Karar:** `VITE_ADMIN_UIDS` env var'ı, virgülle ayrılmış UID listesi. `ADMIN_UIDS` sabiti bunu runtime'da parçalar.  
**Neden:** SPEC: "UID listesi config/env'de (custom claim yok)". `.env` hiçbir zaman commit edilmez.

## D-004: QR sayfası merchant-geneli (kart seçimli)
**Karar:** `/app/qr` tüm aktif membership'leri listeler ve birini seçtirip QR üretir.  
**Neden:** SPEC QR sayfasını belirtmiş fakat hangi kartın gösterileceğini açıklamamış. En pratik çözüm seçim dropdownu.

## D-005: subscription/current yoksa plan=trial kabul edilir
**Karar:** `subscription/current` dokümanı yoksa `plan: 'trial'` varsayılır, limit UI'da gösterilir.  
**Neden:** Yeni kayıt olan merchant'ların subscription dokümanı admin oluşturur; MVP'de otomatik oluşturma yok.

## D-006: Bottom nav'da 5 ana öğe
**Karar:** Alt navigasyonda 5 öğe: Ana Sayfa, Kampanya, Müşteriler, Damga Ekle, Ödül Kullandır. Diğerleri (İşlemler, QR, Abonelik, Ayarlar) header'dan veya hızlı erişimden ulaşılır.  
**Neden:** Mobil-first tasarımda 5'ten fazla bottom nav öğesi tıklanabilirlik sorununa yol açar.

## D-007: `/m/:merchantSlug` opsiyonel — MVP'de eklenmedi
**Karar:** SPEC bölüm 7'de "opsiyonel" yazıyor; bu rota implementasyona alınmadı.  
**Neden:** MVP kapsamını dar tutmak; `/c/:cardToken` çekirdek akış.

## D-008: Manual adjustment MVP dışı transaction UI'ı
**Karar:** `manual_adjustment` tipi transaction modelde var, UI yok.  
**Neden:** SPEC'te "düzeltme silmeyle değil, `manual_adjustment` ile telafi edilir" deniyor fakat UI akışı belirtilmemiyor. V2'ye bırakıldı.
