# Deploy Checklist

Her production deploy öncesi bu listeyi tamamla.

---

## 1. Ortam Değişkenleri

- [ ] `.env` dosyası mevcut ve tüm değerler dolu
- [ ] `VITE_ADMIN_UIDS` değeri, `firestore.rules` içindeki hardcoded UID (`QGdmCNKAahg6uWiUhEBt5dcGNFD3`) ile **eşleşiyor**
- [ ] `.env` dosyası `.gitignore`'da — `git status` çıktısında görünmüyor
- [ ] `adminsdk.json` repo dışında — hiçbir zaman commit edilmedi

## 2. Build ve Lint

```bash
npm run lint        # 0 hata, 0 uyarı
npm run build       # ✓ built — hata/uyarı yok
```

## 3. Firestore

```bash
# Rules + indexes'i deploy et
firebase deploy --only firestore:rules,firestore:indexes
```

- [ ] `firestore.rules` deploy edildi
- [ ] `firestore.indexes.json` deploy edildi
- [ ] Composite index'ler Firestore Console'da `ENABLED` durumda:
  - `transactions`: `customerId ASC + createdAt DESC`
  - `memberships`: `customerId ASC + status ASC`
  - `supportTickets`: `merchantId ASC + createdAt DESC`

## 4. Hosting

```bash
npm run build
firebase deploy --only hosting
```

- [ ] `dist/` klasörü oluştu
- [ ] Firebase Hosting preview URL'de temel akış çalışıyor

## 5. Smoke Test

- [ ] `/` landing page açılıyor
- [ ] `/login` → giriş yapılıyor
- [ ] `/app` → dashboard görünüyor, abonelik planı doğru
- [ ] Damga ekleme → membership + publicCard + transaction aynı anda güncelleniyor
- [ ] `/c/:cardToken` → public kart açılıyor, PII yok
- [ ] `/m/:slug` → public merchant sayfası açılıyor
- [ ] `/yonetim` → sadece admin giriyor, diğerleri redirect

## 6. Güvenlik Kontrolleri

- [ ] Telefon numarasıyla public sorgulama yapılamıyor (SPEC 5)
- [ ] `publicCards` dokümanında `phone`, `fullName`, `customerId` alanı yok
- [ ] Transaction silinemez/değiştirilemez
- [ ] Owner kendi planını yükseltemiyor (sadece admin)

---

**Son deploy:** _(tarih ekle)_
