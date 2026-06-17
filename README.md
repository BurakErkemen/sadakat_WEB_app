# DamgaKart — Dijital Sadakat Kartı SaaS

React + Firebase tabanlı, web üzerinden çalışan, mobil-first dijital sadakat kartı SaaS MVP.

---

## Kurulum

### 1. Gereksinimler
- Node.js 18+
- Firebase projesi (Blaze planı — Firestore gerektirir)
- Firebase CLI: `npm install -g firebase-tools`

### 2. Bağımlılıkları Kur
```bash
npm install
```

### 3. Ortam Değişkenleri
```bash
cp .env.example .env
```
`.env` dosyasını Firebase Console → Project Settings → Your apps → Config değerleriyle doldurun:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_ADMIN_UIDS=uid1,uid2   # Admin olacak Firebase UID'leri (virgülle ayrılmış)
```

### 4. Lokal Çalıştırma
```bash
npm run dev
```

### 5. Firebase Rules Deploy
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 6. Hosting Deploy
```bash
npm run build
firebase deploy --only hosting
```

---

## Veri Modeli Özeti

| Koleksiyon | Erişim |
|---|---|
| `users/{uid}` | Sadece sahibi |
| `merchants/{mid}` | get: public, list: admin, write: owner/admin |
| `publicSlugs/{slug}` | get: public, create: owner |
| `merchants/{mid}/campaigns/{cid}` | get: public, list/write: owner/admin |
| `merchants/{mid}/customers/{cid}` | PII — sadece owner/admin |
| `merchants/{mid}/memberships/{mid2}` | Sadece owner/admin |
| `merchants/{mid}/transactions/{tid}` | read/create: owner/admin; update/delete: **yasak** |
| `merchants/{mid}/subscription/current` | read: owner/admin; write: **sadece admin** |
| `publicCards/{cardToken}` | get: public (PII yok); list: **yasak** |

---

## Mimari Notlar (MVP Sınırları)

- `subscription/current` owner tarafından **yazılamaz**. Plan değişimi admin panelinden yapılır.
- Kullanım sayacı (`usage`) subscription'da **tutulmaz**. "Bu ay N işlem" → `transactions` koleksiyonunda `createdAt >= ayBaşı` sorgusuyla anlık hesaplanır.
- **Damga ekleme** → `writeBatch` (atomik: membership + publicCard + transaction aynı anda).
- **Ödül kullandırma** → `runTransaction` (koşullu: `currentStamps >= requiredStamps` transaction içinde kontrol edilir).
- `publicCards` ince model, **PII yok**: phone, fullName, customerId asla yazılmaz.
- Campaign/merchant bilgileri publicCard'a **kopyalanmaz**; `/c/:cardToken` her yüklenişte 3 ayrı `get` yapar (canlı güncellik).
- Public `list`/`query` yok. Telefon numarasıyla public sorgu **yasak** (PII sızıntısı).
- İşletme başına **tek aktif kampanya**.
- `/m/:merchantSlug` opsiyonel — MVP'de yok, çekirdek akış `/c/:cardToken`.
- Staff ve self-enroll **MVP dışı**.
- Plan limitleri **hard enforce değil** — sadece UI uyarısı/sayacı.

---

## Manuel Test Senaryoları

1. Owner `subscription/current` **güncelleyemez**; admin edebilir; owner okuyabilir.
2. Damga sonrası membership + publicCards + transaction **aynı anda** güncellenir.
3. Ödül: yetersiz damgada hata; eşzamanlı çift kullandırma `runTransaction` ile engellenir.
4. Public: `merchants/{id}` ve `campaigns/{id}` **get** yapabilir; **list** yapamaz.
5. Public: customers/memberships/transactions okuyamaz/yazamaz.
6. `publicCards` update'te `merchantId/campaignId/membershipId` **değiştirilemez**.
7. Transaction **silinemez/değiştirilemez**.
8. Kampanya düzenlenince public kart **güncel değeri** gösterir (denormalizasyon yok).
9. Yeni kampanya aktif edilince eskisi pasife geçer; `activeCampaignId` güncellenir.
10. Pasif kart sayfası nazik mesaj gösterir, beyaz ekran vermez.
11. Alınmış slug'da onboarding hata gösterir.
12. Owner login sonrası `users.merchantId` ile kendi işletmesine ulaşır.

---

## V2 Önerileri

- Staff davet kodu akışı
- Kontrollü self-enroll (owner onaylı)
- Cloud Functions ile rate limit / hard kota
- Gerçek abonelik ödemesi (iyzico / PayTR)
- WhatsApp/SMS bildirim
- Gelişmiş analitik
- Çok şubeli yapı
- `/m/:merchantSlug` işletme tanıtım sayfası
