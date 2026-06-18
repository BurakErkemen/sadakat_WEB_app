# DamgaKart Güncel Denetim Raporu

Rapor tarihi: 18 Haziran 2026  
Kapsam: Mevcut çalışma ağacı, `SPEC.md`, `README.md`, `DECISIONS.md`, Firebase Rules/Indexes, React kaynak kodu, `npm run build` ve `npm run lint` sonuçları.

## 1. Genel Durum

Proje aktif geliştirme halinde. Çalışma ağacında çok sayıda değiştirilmiş ve yeni dosya var. Uygulama MVP kapsamını aşarak public işletme sayfası, destek talepleri, fiyatlandırma config'i, e-posta doğrulama, pending kullanıcı akışı, puan kampanyası ve plan bazlı çoklu aktif kampanya özelliklerini içeriyor.

Otomatik kontroller:

- `npm run build`: başarılı.
- `npm run lint`: başarılı.
- Vite uyarısı: ana JS chunk yaklaşık `1.29 MB`; 500 kB üstü chunk uyarısı devam ediyor.

Sonuç: Proje derlenebilir ve lint temiz durumda. Kalan ana riskler iş mantığı, dokümantasyon tutarlılığı, emulator testi ve manuel akış doğrulamasında.

## 2. Mevcut Özellik Kapsamı

Mevcut route ve ekranlar:

- Public: `/`, `/login`, `/register`, `/forgot-password`, `/verify-email`, `/kvkk`, `/kullanim-kosullari`, `/gizlilik`, `/pending`.
- Public kart: `/c/:cardToken`.
- Public işletme: `/m/:slug`.
- İşletmeci paneli: `/app`, kampanyalar, müşteri, müşteri detay, damga, ödül, işlemler, QR, abonelik, ayarlar, destek.
- Admin paneli: `/yonetim`; eski `/admin` route'u `/yonetim` adresine yönleniyor.

Servis katmanı:

- `createCustomerWithCard`: müşteri + üyelik + public kartı batch ile oluşturuyor.
- `addStamp`: membership + public card + transaction kaydını batch ile güncelliyor.
- `redeemReward`: ödül eşiğini transaction içinde kontrol ediyor.
- `activateCampaign`: kampanya aktifleştiriyor.
- `deactivateCampaign`: kampanyayı pasife alıyor.

## 3. Kapanan Eski Bulgular

Aşağıdaki önceki bulgular artık geçerli değil:

- Build başarısızlığı yok; build başarılı.
- Lint çalıştırılmadı bulgusu kapandı; `npm run lint` başarılı.
- `transactions customerId + createdAt desc` composite index eksikliği kapandı; indeks `firestore.indexes.json` içinde mevcut.
- `DECISIONS.md` artık `/m/:slug`, owner trial subscription create, owner merchant list, support ticket erişimi ve çoklu aktif kampanya kararlarını içeriyor.
- `supportTickets` erişimi önceki geniş halinden daraltılmış; owner merchant eşleşmesi ve admin modeliyle tanımlı.

## 4. Mevcut Kritik Bulgular

### 4.1 Müşteri Detayında Yanlış Kampanya Gösterilebilir

Dosya: `src/features/customers/CustomerDetailPage.tsx`

Kod aktif üyeliğin kendi kampanyasını göstermek yerine önce `merchant.activeCampaignId` değerini kullanıyor:

- Mevcut davranış: `const activeCampId = merchant!.activeCampaignId ?? mem.campaignId`
- Beklenen davranış: müşteri üyeliği hangi kampanyaya aitse detay ekranında o kampanya gösterilmeli, yani `mem.campaignId` kullanılmalı.

Risk:

- Çoklu aktif kampanya modelinde müşteri A kampanyasına kayıtlıyken B kampanyasının adı/eşiği/progress değeri gösterilebilir.
- Ödül hakkı ve ilerleme yüzdesi yanlış hesaplanabilir.
- Kullanıcı yanlış kampanya üzerinden işlem yaptığını düşünebilir.

Öncelik: P0.

Önerilen düzeltme:

- `CustomerDetailPage` içinde kampanya dokümanı doğrudan `mem.campaignId` ile okunmalı.
- Birden fazla aktif membership varsa detay ekranı tek membership varsaymamalı; en azından ilgili üyelikleri listelemeli veya aktif kampanya seçimi yaptırmalı.

### 4.2 Çoklu Aktif Kampanya Pasifleştirmede Legacy Pointer Tutarsızlaşıyor

Dosya: `src/firebase/firestore.ts`

`deactivateCampaign` fonksiyonu her pasifleştirmede şunu yazıyor:

- `activeCampaignIds: arrayRemove(campaignId)`
- `activeCampaignId: null`

Risk:

- Standart/Pro planlarda birden fazla aktif kampanya varken yalnızca bir kampanya pasife alınsa bile `activeCampaignId` tamamen boşalıyor.
- Kodun bazı yerleri hâlâ `activeCampaignId` fallback'i kullandığı için merchant dokümanında tutarsız durum oluşuyor.

Öncelik: P0.

Önerilen düzeltme:

- `deactivateCampaign` transaction ile merchant dokümanını okumalı.
- `activeCampaignIds` listesinden çıkarma sonrası kalan ilk aktif kampanya `activeCampaignId` olarak yazılmalı.
- Kalan aktif kampanya yoksa `activeCampaignId: null` olmalı.

### 4.3 README İçinde Abonelik Erişimi Çelişkili

Dosya: `README.md`

README içinde aynı path iki farklı şekilde anlatılıyor:

- Bir satırda `subscription/current` için owner'ın sadece trial create edebileceği yazıyor.
- Başka satırda aynı path için write sadece admin deniyor.

Risk:

- Yeni geliştirici veya deploy öncesi kontrol yapan kişi gerçek Rules davranışını yanlış anlayabilir.
- `DECISIONS.md` ile README arasında kısmi uyumsuzluk kalır.

Öncelik: P1.

Önerilen düzeltme:

- Eski `read: owner/admin; write: sadece admin` satırı kaldırılmalı veya `create: owner sadece trial; update/delete: admin` şeklinde tekilleştirilmeli.

## 5. Firestore Rules Durumu

Güçlü taraflar:

- `publicCards` public `get` açık, `list` kapalı.
- `customers`, `memberships`, `transactions` owner/admin ile sınırlı.
- `transactions` update/delete kapalı.
- `publicCards` update sırasında `merchantId`, `campaignId`, `membershipId` kilitli.
- `supportTickets` create/get/list owner merchant eşleşmesine veya admin'e bağlı.
- `config` public get, admin write modeli fiyatlandırma için uygun.

Kalan doğrulama ihtiyacı:

- Firestore Rules emulator testleri yok.
- Owner'ın başka merchant verilerine erişemediği testle kanıtlanmamış.
- Support ticket list/get kuralları emulator ile doğrulanmamış.
- Owner trial subscription create ve update/delete ayrımı emulator ile doğrulanmamış.

Öncelik: P1.

## 6. Firestore Index Durumu

`firestore.indexes.json` içinde görülen indeksler:

- `transactions`: `customerId ASC`, `createdAt DESC`
- `memberships`: `customerId ASC`, `status ASC`
- `supportTickets`: `merchantId ASC`, `createdAt DESC`

Önceki transaction composite index eksikliği kapandı.

Kalan yapılacak:

- Canlı Firestore veya emulator üzerinde tüm sorgu akışları denenmeli.
- Yeni sorgular eklendikçe hata linklerinden indeks dosyası güncellenmeli.

## 7. Dokümantasyon Durumu

Güncel ve iyi taraflar:

- `DECISIONS.md`, çoklu aktif kampanya kararını içeriyor.
- `DECISIONS.md`, owner trial subscription create kararını içeriyor.
- `DECISIONS.md`, support ticket erişim modelini içeriyor.
- `README.md`, public işletme sayfası ve plan bazlı çoklu aktif kampanya bilgisini büyük ölçüde içeriyor.

Kalan eksik:

- README abonelik erişim tablosunda çelişkili satır var.
- README manuel testlerinde owner'ın sadece trial create edebilmesi ayrıca test maddesi olarak netleşebilir.

## 8. Ürün ve UX Doğrulama Eksikleri

Manuel olarak doğrulanması gereken akışlar:

- Public kart yok/pasif/aktif durumları.
- Public işletme sayfasında aktif kampanyaların doğru listelenmesi.
- QR okuma ve QR üretme.
- Çoklu aktif kampanyada müşteri oluşturma, damga ekleme ve ödül kullandırma.
- Trial süresi bitmiş/canceled/past_due abonelik kilidi.
- Destek talebi oluşturma ve admin yanıtı.
- Admin UID'nin frontend `.env` ve Firestore Rules tarafında senkron olması.

## 9. Test Durumu

Geçen kontroller:

- `npm run build`
- `npm run lint`

Eksikler:

- Unit test yok.
- Component test yok.
- Firestore Rules emulator testi yok.
- E2E/smoke test yok.

Minimum önerilen test planı:

1. Firebase emulator rules testleri.
2. Register/login/onboarding manuel testi.
3. Kampanya oluştur/aktif et/pasife al testi.
4. Çoklu aktif kampanya testi.
5. Müşteri oluşturma ve public kart testi.
6. Damga ve ödül transaction testi.
7. Admin plan/status/destek yönetimi testi.

## 10. Önceliklendirilmiş Yapılacaklar

P0 - Kritik:

1. `CustomerDetailPage` kampanya seçim bug'ını düzelt.
2. `deactivateCampaign` içinde `activeCampaignId` pointer'ını kalan aktif kampanyaya göre güncelle.

P1 - Güvenilirlik:

1. README abonelik erişim çelişkisini temizle.
2. Firestore Rules emulator testlerini yaz ve çalıştır.
3. Çoklu aktif kampanya akışlarını manuel test et.
4. Public kart ve QR akışlarını mobil tarayıcıda doğrula.

P2 - Performans ve Bakım:

1. Route bazlı code splitting ekle.
2. Büyük bundle uyarısını azalt.
3. Temel test altyapısı ekle.
4. Deploy checklist oluştur.

## 11. Yayına Hazırlık Değerlendirmesi

Durum: Staging için yakın, production için henüz hazır değil.

Neden:

- Build ve lint başarılı.
- İndeks dosyasında bilinen transaction composite index mevcut.
- Kritik MVP akışları kodda mevcut.
- Ancak iki P0 iş mantığı bug'ı var.
- Firestore Rules emulator testleri yok.
- Çoklu aktif kampanya akışı manuel olarak doğrulanmamış.

Sonuç: Önce iki P0 bug düzeltilmeli. Ardından emulator rules testleri ve manuel smoke test ile staging deploy yapılabilir.
