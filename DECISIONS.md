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

---

## Spec-uyum denetimi kararları (2026-07-03, `spec-uyum` branch)

## D-013: publicCards.customerDisplayName maskeleme zorunlu (PII düzeltmesi)
**Karar:** `createCustomerWithCard`, `enrollCustomerInCampaign` ve müşteri düzenleme akışındaki publicCards yazımlarına `maskName()` uygulandı. Maskeleme servis fonksiyonlarının içinde yapılır; çağıran taraf ham ad gönderse bile public dokümana maskesiz ad yazılamaz.  
**Neden:** SPEC §5.3 ve §13.1: public dokümanda tam ad PII'dir, yalnızca maskeli ad ("B**** E******") tutulur. Denetimde üç yazım noktasının da maskesiz `fullName` yazdığı tespit edildi.  
**Açık iş (TODO):** Üretimdeki mevcut `publicCards` dokümanlarında maskesiz adlar duruyor. Tek seferlik düzeltme gerekir: owner hesabıyla (Admin SDK KULLANMADAN) her merchant'ın membership'leri gezilip publicCards.customerDisplayName maskeli değerle yeniden yazılmalı.

## D-014: adminsdk.json service account anahtarı silindi
**Karar:** Kök dizinde bulunan `adminsdk.json` (gerçek service account private key) diskten silindi. Admin SDK hiçbir kod veya bağımlılıkta kullanılmıyor; `.gitignore` zaten kapsıyor.  
**Neden:** SPEC "Admin SDK yok" ve "sırlar repoda olmaz" der. Anahtar **git geçmişine girmemiş** (doğrulandı: `git log --all` boş); bu nedenle "sızmış" kabul edilmesi zorunlu değil. Ancak anahtar OneDrive-senkronlu bir klasörde bulunduğundan **önlem olarak Firebase Console → Service Accounts üzerinden iptal edilmesi önerilir**.

## D-015: .env git izlemesinden çıkarıldı
**Karar:** `.env` commit 09f6520 ile repoya girmişti; `git rm --cached .env` ile izlemeden çıkarıldı (disk kopyası duruyor). `.env.example` gerçek değerler yerine placeholder'larla yeniden yazıldı ve izlemeye alındı.  
**Neden:** SPEC: "Sırlar repoda olmaz." İçerikteki değerler (Firebase web config + `VITE_ADMIN_UIDS`) zaten client bundle'da görünen, gizli olmayan değerlerdir; bu yüzden git geçmişi yeniden yazılmadı. Gerçek bir sır sızıntısı yoktur.

## D-016: Spec dosya adı SPEC.md olarak tekilleştirildi
**Karar:** Tek isim `SPEC.md`. `AGENTS.md` ve `CLAUDE.md` içindeki `DamgaKart-SPEC.md` referansları `SPEC.md` yapıldı.  
**Neden:** Dosya repoda `SPEC.md` adıyla ve git geçmişiyle mevcut; yeniden adlandırmak geçmişi bölerdi.

## D-017: VITE_ADMIN_UIDS gizli değildir
**Karar:** Admin UID listesi `VITE_ADMIN_UIDS` env değişkeninden okunur ve client bundle içinde görünür; bu bilinçli olarak gizli KABUL EDİLMEZ. Gerçek yetki `firestore.rules` içindeki `isAdmin()` UID kontrolündedir; client'taki liste yalnızca UI yönlendirmesi içindir.  
**Neden:** SPEC "UID listesi config/env'de"; Rules devrede olduğu sürece UID bilgisi tek başına yetki vermez. README'ye de yazıldı.

## D-018: .gitignore'daki hatalı ignore satırları kaldırıldı
**Karar:** `.gitignore` sonundaki `firestore.rules`, `*.rules`, `src/firebase/firestore.ts`, `.env.example`, `RAPOR.md` satırları silindi.  
**Neden:** Güvenlik kurallarının ve servis katmanının version control DIŞINDA tutulması kabul edilemez; yeni oluşturulacak `.rules` dosyaları da sessizce ignore ediliyordu. (`connection.js` ignore satırı korundu; dosya yalnızca public web config içerir, git geçmişinde yoktur.)

## D-019: Onboarding slug çakışması ve yetim merchant telafisi (D-1)
**Karar:** Mevcut akış korundu: slug önce `get` ile kontrol edilir, doluysa "Bu işletme linki alınmış. Farklı bir link deneyin." gösterilir. `get` ile `create` arasındaki yarış durumunda create reddedilir ve generic hata gösterilir; kullanıcı tekrar denediğinde OnboardingPage'deki kurtarma akışı (`where('ownerId','==',uid)` sorgusu + "mevcut işletmeye bağlan") yetim merchant'ı sahiplenmeyi sağlar.  
**Neden:** SPEC §8: üçlü yazım batch'lenemez. Kurtarma akışı zaten implemente (D-010); MVP için yeterli kabul edildi.

## D-020: ~~maskName formatı yumuşatıldı — ilk isim açık, soyad baş harfi~~ (İPTAL — bkz. D-021)
**Karar (iptal edildi):** "Burak E." formatı denendi; ilk isim tam gösteriliyordu, tek kelimelik isimler ise tamamen açık kalıyordu.  
**İptal nedeni:** Codex review (2026-07-03) blocking buldu: tek kelimelik isimlerde `maskName('Ayşe') === 'Ayşe'` doğrudan fullName sızıntısıdır ve ilk ismin tamamen açık olması SPEC'in "public dokümanda PII yok" kuralına aykırıdır. D-021 ile SPEC formatına dönüldü.

## D-021: maskName SPEC formatına döndürüldü
**Karar:** `customerDisplayName` her kelimede baş harf + yıldız: "Burak Erkemen" → "B**** E******", "Ayşe" → "A***", tek harfli kelime → "O*". İlk karakter `Array.from` ile alınır (surrogate-pair güvenli); publicCards'a yazan tüm yollar bu fonksiyondan geçer (D-013).  
**Neden:** Codex review blocking bulgusu — D-020 formatı tek kelimelik isimlerde tam ad sızdırıyordu. SPEC §13.1 örneğine ("B**** Y****") birebir dönüldü. Public kartta okunur ad istenirse V2'de token arkasındaki private bir yüzeye taşınmalı, public dokümana değil.

## D-022: publicCards schema allowlist Rules'a eklendi
**Karar:** `publicCards` create/update artık `keys().hasOnly(publicCardKeys())` ile 9 alanlık allowlist'e kilitli; create ayrıca `hasAll` ister, update `cardToken` eşitliğini de kilitler. Owner/admin bile public dokümana `phone`, `fullName`, `customerId`, `note` gibi ekstra alan yazamaz.  
**Neden:** Codex review blocking bulgusu: PII garantisi client kodunda değil Rules'ta olmalı (`get: true` olan dokümanda schema dışı alan = potansiyel public sızıntı).

## D-023: Müşteri silme atomikleştirildi
**Karar:** Müşteri silme tek `writeBatch` ile yapılır: customer dokümanı + müşterinin tüm membership'leri + bunlara bağlı publicCards dokümanları birlikte silinir. `transactions` bilinçli olarak silinmez (immutable audit; Rules zaten delete'i yasaklar).  
**Neden:** Codex review blocking bulgusu: önceki kod yalnızca customer dokümanını siliyordu; memberships ve publicCards orphan kalıyor, public kart tutarsız yaşamaya devam ediyordu. SPEC §0: çok-doküman yazımları atomik olmalı. Hard delete tercih edildi (KVKK: silme talebinde PII'nin gerçekten silinmesi gerekir; soft-delete PII'yi tutmaya devam ederdi).

## D-025: Girişte profil ve mağaza okuma hataları onboarding sayılmaz
**Karar:** Her oturum değişiminde profil sıfırlanır ve yüklenmesi beklenir; eski oturumun geç gelen sonuçları yok sayılır. Profil okuma hatası ve sunucuda bulunamayan profil yeni mağaza yönlendirmesi üretmez. Önbellekte mağaza bağlantısı olmayan profil sunucu doğrulamasını bekler. Mevcut mağaza sorgusu başarısızsa veya yalnızca önbellekten yanıtlandıysa form yerine tekrar deneme gösterilir. Mevcut mağaza bulununca yalnızca bağlantıyı kurtarma seçeneği sunulur.
**Neden:** Eksik veya okunamayan veri, mağazanın bulunmadığına kanıt değildir. Ayrıca mevcut Rules dolu merchantId değerinin başka mağazayla değiştirilmesine izin vermez; kurtarma ekranından ikinci mağaza açmak desteklenen bir akış değildir. Yetkilendirme kuralları değiştirilmedi.

## D-024: Owner trial create kuralı sıkılaştırıldı
**Karar:** Owner'ın `subscription` altına create yetkisi artık yalnızca `docId == 'current'`, alan allowlist'i (`plan, status, billingCycle, currentPeriodStart, currentPeriodEnd, createdAt, updatedAt`) ve `currentPeriodEnd <= now + 15 gün` sınırı ile geçerli. Update/delete değişmedi (sadece admin).  
**Neden:** Codex review bulgusu: eski kural owner'ın keyfi docId altında, ekstra alanlarla ve sınırsız süreli trial dokümanı oluşturmasına izin veriyordu. D-009'daki onboarding istisnası korunarak daraltıldı.

## D-012 (ek not, 2026-07-03): Codex review çoklu aktif kampanyayı SPEC sapması olarak işaretledi. Ürün kararı olarak bilinçli şekilde KORUNDU (kullanıcı talebiyle eklenmişti); SPEC'e birebir uyum istenirse `multiActive`/`activeCampaignIds` kaldırılmalı.
