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

## D-007: `/m/:slug` public işletme sayfası eklendi
**Karar:** SPEC bölüm 7'de "opsiyonel" yazmasına rağmen `PublicMerchantPage` (`/m/:slug`) implemente edildi.  
**Neden:** Landing page alternatifi olarak işletmenin aktif kampanyalarını müşterilere göstermek; müşteri kaydı için yönlendirme noktası. Çekirdek akış hâlâ `/c/:cardToken`.

## D-008: Manual adjustment MVP dışı transaction UI'ı
**Karar:** `manual_adjustment` tipi transaction modelde var, UI yok.  
**Neden:** SPEC'te "düzeltme silmeyle değil, `manual_adjustment` ile telafi edilir" deniyor fakat UI akışı belirtilmemiyor. V2'ye bırakıldı.

## D-009: Owner trial subscription create edebilir
**Karar:** Firestore Rules'ta `subscription/current` create, owner için `plan == 'trial' && status == 'trialing'` koşuluyla izin veriliyor.  
**Neden:** Admin doküman oluşturana kadar onboarding'in çalışabilmesi için. SPEC'teki "abonelik yazımı sadece admin" kuralından bilinçli sapma. Plan yükseltme/değiştirme yine sadece admin.

## D-010: Merchant list — owner kendi kayıtlarını sorgulayabilir
**Karar:** Firestore Rules'ta `merchants` list, `resource.data.ownerId == request.auth.uid` koşuluyla signed-in user'a açık.  
**Neden:** OnboardingPage kurtarma akışı: `users/{uid}` bozulmuş olduğunda merchant'ı bulmak için `where('ownerId', '==', uid)` sorgusu gerekiyor. Admin tüm listeyi görebilir; diğer kullanıcılar yalnızca kendi kayıtlarını döndüren sorgular yapabilir.

## D-011: Support ticket erişim modeli
**Karar:** supportTickets create/get/list, `userMerchantId()` helper'ı ile doğrulanan sahip merchant kontrolüne bağlandı.  
**Neden:** Kullanıcı sadece kendi merchant'ına ait destek taleplerini görebilmeli; admin tüm talepleri yönetir.

## D-012: Plan bazlı çoklu aktif kampanya
**Karar:** Standart ve Pro planlar aynı anda birden fazla kampanyayı aktif edebilir. Trial ve Mini tek aktif kampanya ile sınırlı. Merchant dokümanına `activeCampaignIds: string[]` alanı eklendi; `activeCampaignId` backward compat için korundu.  
**Neden:** Kullanıcı talebi — farklı türde kampanyaların (damga + puan gibi) eş zamanlı yürütülmesi. SPEC'teki "tek aktif kampanya" kuralından bilinçli sapma.
