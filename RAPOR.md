# Sadex Production Öncesi Test Raporu

Rapor tarihi: 23 Haziran 2026  
İnceleme rolü: Senior Test Engineer  
Proje: `sadakat_WEB_app`  
Kapsam: Claude tarafından yapılan son düzeltmeler, React uygulaması, Firebase Auth/Firestore kuralları, unit/rules/E2E testleri, build ve dependency güvenliği

## 1. Yönetici Özeti

**Production kararı: NO-GO**

Kod tabanı teknik kalite açısından iyi ilerlemiş durumda. Lint, unit testler, Firestore emulator testleri, Playwright E2E testleri, production build ve dependency audit başarıyla tamamlandı.

Buna rağmen admin onay modelini doğrudan etkileyen bir yetkilendirme açığı var: `pending` kullanıcının merchant oluşturması Firestore kurallarında engellenmiyor. UI kullanıcıyı `/pending` sayfasına yönlendirse de doğrulanmış bir kullanıcı Firestore SDK/REST çağrısıyla merchant, slug ve trial aboneliği oluşturabilir. Production öncesi bu açık kapatılmalı.

İkinci önemli kalite riski, varsayılan `npm test` komutunun Firestore rules testlerini emulator yokken skip ederek başarılı görünmesi. CI yalnızca `npm test` çalıştırırsa güvenlik testleri gerçekte çalışmadan yeşil sonuç alınabilir.

## 2. Otomatik Test Sonuçları

| Kontrol | Sonuç | Detay |
|---|---|---|
| `npm run lint` | PASS | Sıfır warning/error, `--max-warnings 0` |
| `npm run test:unit` | PASS* | 11 test geçti, 10 rules testi emulator olmadığı için skip edildi |
| `npm run test:rules:emulator` | PASS | Firestore Emulator üzerinde 10/10 test geçti |
| `npm run test:e2e` | PASS | Chromium üzerinde 12/12 test geçti |
| `npm run build` | PASS | TypeScript project build ve Vite production build başarılı |
| `npm audit --omit=dev` | PASS | 0 vulnerability |
| Java/Firebase CLI | PASS | Java 21, Firebase CLI 15.21.0 |
| Hassas dosya Git kontrolü | PASS | `.env` ve `adminsdk.json` ignore ediliyor; Git geçmişinde izlenmiyor |

`PASS*`: Unit komutu rules testlerini çalıştırmıyor; skip ediyor. Güvenlik kapısı olarak tek başına yeterli değil.

## 3. Release Blocker Bulgular

### P0 - Pending kullanıcı admin onayını Firestore üzerinden bypass edebilir

Dosyalar:

- `firestore.rules:56-61`
- `firestore.rules:83-91`
- `src/routes/AppRouter.tsx:47-72`
- `src/features/onboarding/OnboardingPage.tsx:85-128`

UI tarafında `pending` ve `rejected` profiller `/pending` sayfasına gönderiliyor. Ancak Firestore kuralları merchant oluşturmak için yalnızca şunu kontrol ediyor:

```text
signedIn() && request.resource.data.ownerId == request.auth.uid
```

Kural kullanıcının `users/{uid}.status == 'approved'` olduğunu veya e-postasının doğrulandığını kontrol etmiyor. Aynı kullanıcı daha sonra kendi merchant'ı için `publicSlugs` ve `subscription/current` oluşturabiliyor.

Ek bypass yolu:

- Firebase Auth hesabı oluşup profil `setDoc` işlemi başarısız olursa kullanıcı profili `null` kalabilir.
- E-posta doğrulandıktan sonra `OnboardingGuard`, profil yokken onboarding ekranını render ediyor.
- Firestore merchant create kuralı profil veya approval aramadığı için onboarding doğrudan çalışabilir.

Etkisi:

- Admin onaylı aktivasyon modeli güvenlik katmanında uygulanmıyor.
- Pending/rejected kullanıcı ücretli/işletmeci akışına doğrudan girebilir.
- UI koruması güvenlik kontrolü gibi davranıyor; doğrudan API çağrısı bunu atlıyor.

Önerilen düzeltme:

1. `isApprovedUser()` helper'ı ekleyin ve merchant create için zorunlu tutun.
2. Gerekirse `request.auth.token.email_verified == true` kontrolü ekleyin.
3. `publicSlugs` ve trial subscription create kurallarında da approved owner şartını doğrulayın.
4. Emulator testlerine pending, rejected, profile-missing ve unverified kullanıcı senaryoları ekleyin.

### P0 - Varsayılan test komutu güvenlik testleri çalışmadan yeşil oluyor

Dosyalar:

- `package.json:9-14`
- `tests/rules/firestore.rules.test.ts:18-19`

`npm test` / `npm run test:unit`, emulator ortam değişkeni yoksa rules suite'ini `describe.skip` ile atlıyor. Ayrıca komutlarda `--passWithNoTests` kullanılıyor.

Gözlenen sonuç:

```text
Test Files  4 passed | 1 skipped
Tests       11 passed | 10 skipped
exit code   0
```

Bu yapı CI'da yanıltıcı bir yeşil sonuç üretir. Firestore rules bu ürünün tenant izolasyonu ve PII güvenliği için ana kontrol katmanıdır; rules testleri opsiyonel olmamalı.

Önerilen düzeltme:

- CI `test` script'ini unit + rules emulator + E2E olarak birleştirin.
- `test:rules` emulator olmadan çalıştırılırsa açık hata versin; skip etmesin.
- Kritik test komutlarından `--passWithNoTests` seçeneğini kaldırın.
- CI workflow'a `npm run lint`, `npm run test:unit`, `npm run test:rules:emulator`, `npm run test:e2e`, `npm run build` adımlarını ekleyin.

## 4. Yüksek Öncelikli Bulgular

### P1 - Plan limitleri yalnızca UI seviyesinde

Kaynaklar:

- `README.md` mimari notları
- `src/hooks/usePlanLimits.ts`
- `firestore.rules:56-80`

Müşteri, işlem ve kampanya limitleri Firestore rules veya trusted backend tarafından enforce edilmiyor. Merchant owner doğrudan Firestore çağrısıyla UI limitlerini aşabilir.

Etkisi:

- Trial/Mini/Standart planların ticari sınırları teknik olarak uygulanmıyor.
- Ücretlendirme ile gerçek kullanım arasında uyuşmazlık oluşabilir.
- Kötüye kullanım Firestore maliyetini artırabilir.

Production ücretli trafik öncesi hard enforcement önerilir. MVP riski olarak kabul edilecekse ürün, satış ve operasyon tarafından yazılı kabul edilmelidir.

### P1 - Onboarding dört ayrı yazma işlemiyle atomik değil

Dosya: `src/features/onboarding/OnboardingPage.tsx:76-128`

Onboarding sırasıyla merchant, user pointer, public slug ve trial subscription yazıyor. İşlemler batch/transaction içinde değil.

Olası yarım durumlar:

- Merchant oluşur, user pointer yazılamaz.
- Merchant ve pointer oluşur, slug yazılamaz.
- Slug oluşur, subscription oluşturulamaz.
- İki kullanıcı aynı slug için yarıştığında biri orphan merchant ile kalabilir.

Mevcut recovery yalnızca kullanıcının merchant'ını tekrar bağlamaya odaklı; eksik slug/subscription durumlarını tamir etmiyor.

Öneri:

- Mümkün olan yazımları transaction/batch içinde birleştirin.
- Slug rezervasyonunu atomik yapın.
- Recovery akışında merchant, slug ve subscription bütünlüğünü doğrulayın.
- Failure injection testleri ekleyin.

### P1 - Inactivity logout sekmeler arasında senkron değil

Dosya: `src/hooks/useInactivityLogout.ts:11-50`

Yeni timestamp yaklaşımı arka planda geçen süreyi doğru sayıyor. Ancak `lastActivityAt` yalnızca sekme içindeki React ref'inde tutuluyor.

Senaryo:

1. Kullanıcı A sekmesinde aktif çalışıyor.
2. B sekmesi bir saat boyunca pasif kalıyor.
3. B sekmesi timeout olup Firebase `signOut` çağırıyor.
4. Auth state sekmeler arasında senkron olduğu için aktif A sekmesi de oturumdan düşebilir.

Öneri:

- Aktivite timestamp'ini `localStorage` veya `BroadcastChannel` ile sekmeler arasında paylaşın.
- Logout'u tüm sekmelerin ortak son aktivitesine göre hesaplayın.
- Fake timer + storage/BroadcastChannel testleri ekleyin.

### P1 - Firestore rules kapsamı ürün yüzeyine göre yetersiz

Dosya: `tests/rules/firestore.rules.test.ts`

10 rules testi geçiyor fakat aşağıdaki kritik alanlar kapsanmıyor:

- Pending/rejected/unverified kullanıcının merchant oluşturması.
- Cross-tenant merchant, campaign, customer, membership ve transaction erişimi.
- Merchant owner'ın başka merchant'a yazması.
- Public campaign get/list ayrımı.
- `paymentConsents` immutability ve zorunlu alanları.
- Transaction update/delete ve sahte transaction alanları.
- Public slug yarış ve sahiplik senaryoları.
- Merchant owner'ın subscription plan/status yükseltme denemeleri için farklı payload'lar.

Rules test matrisi koleksiyon x rol x operasyon tablosuyla genişletilmeli.

## 5. Orta Öncelikli Bulgular

### P2 - E2E kapsamı gerçek ürün akışlarını test etmiyor

Dosyalar:

- `tests/e2e/public.spec.ts`
- `tests/e2e/auth.spec.ts`

12 test geçiyor ancak çoğu smoke/redirect kontrolü. Landing testi yalnızca body'nin boş olmadığını kontrol ediyor. Invalid card/merchant testleri de yalnızca body'nin boş olmamasını ve `undefined` yazmamasını doğruluyor.

Eksik ana akışlar:

- Kayıt -> e-posta doğrulama -> pending -> admin approve -> onboarding.
- Merchant oluşturma ve slug çakışması.
- Kampanya oluşturma/aktif-pasif geçişi.
- Müşteri oluşturma ve duplicate telefon kontrolü.
- Damga/puan ekleme ve ödül kullandırma.
- Public kartta güncel bakiyenin görünmesi.
- Plan talebi ve payment consent kaydı.
- Admin kullanıcı/merchant/subscription/support yönetimi.
- Mobil viewport ve QR scanner fallback.

Auth + Firestore emulator ile seed'li E2E projesi önerilir.

### P2 - Admin yetkisi iki ayrı kaynaktan yönetiliyor

Dosyalar:

- `firestore.rules:7-10`
- `src/lib/constants.ts:65`
- `.env.example`
- `DEPLOY.md`

Firestore rules UID'yi hardcode ediyor; frontend `VITE_ADMIN_UIDS` kullanıyor. İki liste ayrışırsa:

- Gerçek admin UI'ı göremeyebilir ama rules yetkisi olabilir.
- UI admin görünen kullanıcı Firestore'da yetkisiz olabilir.

Bu doğrudan veri sızıntısı yaratmaz çünkü rules son otoritedir, ancak production operasyonunu kırabilir. Custom claims tek kaynak olarak tercih edilmelidir.

### P2 - Payment consent kuralları hukuki kayıt şemasını doğrulamıyor

Dosyalar:

- `firestore.rules:94-100`
- `src/features/subscription/SubscriptionPage.tsx:73-91`

Kural yalnızca `merchantId` ve `userId` eşleşmesini doğruluyor. `planId`, `billingCycle`, `displayedPrice`, `acceptedTermsVersion`, `acceptedAt` ve `actionType` alanları zorunlu veya tip kontrollü değil.

Kayıt immutable olsa da eksik/yanlış payload hukuki kanıt değerini düşürür. `hasOnly/hasAll`, enum, number ve timestamp kontrolleri eklenmeli.

### P2 - Auth/profile null durumu açıkça ele alınmıyor

Dosyalar:

- `src/features/auth/AuthContext.tsx:31-39`
- `src/routes/AppRouter.tsx:47-72`

Authenticated kullanıcının `users/{uid}` profili yoksa `profile` null oluyor. Guard'lar bu durumu hata/recovery olarak ele almak yerine onboarding veya uygulama kabuğuna geçebilir.

Öneri:

- Profile missing için ayrı bir auth state tanımlayın.
- Kullanıcıyı güvenli profile repair/logout ekranına yönlendirin.
- Profile read permission/network hata durumunu “profil yok” ile aynı state'te tutmayın.

### P2 - Rules admin testi gerçek environment uyumunu doğrulamıyor

Dosya: `tests/rules/firestore.rules.test.ts:234-249`

Test hardcoded UID ile admin update'i doğruluyor. Frontend `VITE_ADMIN_UIDS` değerinin aynı UID'yi içerdiği test edilmiyor. Deployment config drift CI'da yakalanmıyor.

## 6. Düşük Öncelikli Bulgular

### P3 - E2E yalnızca Desktop Chrome çalıştırıyor

Dosya: `playwright.config.ts:17-22`

Ürün mobil-first olarak tanımlanmasına rağmen mobil viewport/WebKit testi yok. En az Pixel 7 ve iPhone 13 viewport projesi eklenmeli.

### P3 - Rules emulator test çıktısı gereksiz gürültülü

Beklenen `assertFails` çağrıları emulator logunda uzun permission stack trace'leri üretiyor. Testler geçiyor ancak CI log okunabilirliği düşüyor. Firebase debug logging azaltılabilir.

### P3 - Test artifacts ve TypeScript build info temizliği

`tsconfig.test.tsbuildinfo` untracked durumda. Build/test artifact'leri `.gitignore` altında tutulmalı. Çalışma ağacında yanlışlıkla commit edilmemeli.

## 7. Doğrulanan Claude Düzeltmeleri

Aşağıdaki değişiklikler kod ve testlerle doğrulandı:

- Yeni kayıtlar `approved` yerine `pending` oluşturuluyor.
- Kullanıcı kendi `status` alanını güncelleyemiyor.
- Kullanıcı başka sahibin merchantId'sini profiline yazamıyor.
- Normal kullanıcı e-posta doğrulamadan protected route'a giremiyor.
- Pending/rejected kullanıcı doğrulama sonrası `/pending` ekranına yönleniyor.
- Subscription update/delete yalnızca admin tarafından yapılabiliyor.
- Public card get açık, list kapalı.
- Support ticket tenant izolasyonu testten geçiyor.
- Kampanya pasifleştirme transaction ile kalan aktif pointer'ı koruyor.
- Lint gate temizlendi.
- Dependency audit temiz.
- `adminsdk.json` ve `.env` Git tarafından ignore ediliyor ve geçmişte izlenmemiş.

## 8. Test Kapsam Özeti

### Unit testler

- 11 test geçti.
- Phone, slug, token ve utility fonksiyonları kapsanıyor.

### Firestore rules testleri

- Emulator üzerinde 10 test geçti.
- Temel public card, subscription, support ticket ve user profile kontrolleri mevcut.
- Tenant ve approval matrisi genişletilmeli.

### E2E testleri

- 12 Chromium testi geçti.
- Public render, unauthenticated redirect, kayıt checkbox'ları, legal linkler ve invalid public route smoke kontrolleri mevcut.
- Authenticated iş akışları kapsanmıyor.

## 9. Zorunlu Production Checklist

1. Pending/rejected/profile-missing kullanıcıların merchant oluşturmasını Firestore rules seviyesinde engelle.
2. Varsayılan CI test komutunda rules emulator testlerini zorunlu çalıştır.
3. Plan limitleri için hard enforcement kararı ver ve kritik limitleri backend/rules ile uygula.
4. Onboarding yazımlarını atomik hale getir veya tam recovery mekanizması ekle.
5. Inactivity logout'u sekmeler arasında senkronize et.
6. Rules test matrisini tenant izolasyonu ve approval bypass senaryolarıyla genişlet.
7. Authenticated emulator E2E akışlarını ekle.
8. Payment consent şemasını rules seviyesinde doğrula.
9. Admin UID yapılandırmasını tek kaynağa taşı.
10. Mobil Playwright projelerini CI'a ekle.

## 10. Nihai Karar

**NO-GO for production.**

Staging/demo için mevcut yapı güçlü ve otomatik kapılar yeşil. Ancak admin approval bypass güvenlik açığı kapanmadan production kullanıcı kaydı açılmamalı. Bu düzeltmeden sonra rules emulator ve authenticated E2E testleri yeniden çalıştırılarak release kararı güncellenmeli.
