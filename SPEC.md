# DamgaKart — Dijital Sadakat Kartı SaaS MVP · Nihai (Merged) Build Promptu

> Codex / Claude Code (VS Code) için uygulama kurma promptu. Boş repoda bağlam ver: "bu speke göre projeyi baştan kur."
> Güvenlik ve atomiklik kuralları **pazarlık dışıdır**; ajan gevşetmemeli.
> Bu sürüm, iki ayrı mimari dokümanın her maddede **daha sıkı/doğru olan** kararlarının birleşimidir.

Sen kıdemli bir React + Firebase geliştiricisisin. Firebase tabanlı, web üzerinden çalışan, mobil-first bir **Dijital Sadakat Kartı SaaS MVP** geliştir. Küçük işletmelere **99 TL/ay** giriş paketiyle satılacak, düşük destekli bir mikro SaaS.

---

## 0. Ajan Davranış Kuralları

- TypeScript **strict**; `any` yasak (`unknown` + daraltma).
- Önce iskelet (routing + auth + boş ekranlar) kur, derlenip çalıştığını gör; sonra özellik ekle. Her özellik ayrı çalışır commit.
- Sunucu/Cloud Functions/Admin SDK/custom claims **yok**. Sadece **Auth + Firestore + Hosting + Security Rules**.
- Yetkilendirme client'ta değil **Rules'ta**. Kuralları özelliklerden önce yaz, emulator ile dene.
- Mobil-first, tek elle. Arayüz **Türkçe**.
- Sırlar repoda olmaz: `.env` + `.env.example` + `.gitignore`.
- Çok-doküman yazımları **atomik** (writeBatch / runTransaction) — bölüm 13.
- Public dokümanlara **asla PII** yazma (telefon, tam ad, not). Kod seviyesinde garanti et.
- Çelişki görürsen varsayım yap, `DECISIONS.md`'ye not düş, devam et.

---

## 1. Amaç

Kağıt sadakat kartı yerine dijital kart. Örnekler: kafe "5 kahve alana 1 hediye", kuaför "6 işlem sonrası indirim", oto yıkama "5 yıkama sonrası 1 ücretsiz", künefeci "5 alışveriş sonrası tatlı indirimi".

Müşteri kendi telefonunda **token'lı kart linkini** (`/c/:cardToken`) açar.

**Değer:** "Kağıt sadakat kartı yerine müşterileriniz telefondan damga toplasın; siz de tekrar gelen müşteri sayısını artırın."

---

## 2. Teknolojiler

**Kullan:** React, Vite, TypeScript (strict), Tailwind CSS, Firebase Auth, Cloud Firestore, Firebase Hosting, Security Rules, React Router, Zod, QR kütüphanesi (`qrcode`/`qrcode.react`), token için `crypto.getRandomValues`.

**Kullanma:** custom backend, Express, NestJS, Laravel, Django, REST server, Prisma, PostgreSQL, MySQL, MongoDB, Cloud Functions, Firebase Admin SDK, harici ödeme, SMS, WhatsApp API, custom claims.

---

## 3. Mimari Sınırlar ve Dürüst Enforcement

Tamamen client-side. Cloud Functions olmadığı için bazı şeyler gerçekten enforce edilemez — sahte güvenlik gibi yazma:

- Plan limitleri Rules ile kesin zorlanmaz.
- Müşteri sayısı / aylık işlem limiti **yalnızca UI uyarısı/sayacı**.
- Kullanım sayacı **hiçbir dokümanda tutulmaz**. "Bu ay N işlem" = `transactions` koleksiyonunda `createdAt >= ayBaşı` sorgusuyla **anlık** hesaplanır (owner kendi transaction'larını okuyabilir). Limit değerleri koddaki `PLAN_LIMITS` sabitinden.
- Merchant kendi client'ını manipüle ederse limiti aşabilir; MVP'de kabul. Onur sistemi + manuel takip.

---

## 4. Roller

- **Platform Admin:** UID listesi config/env'de (custom claim yok). İşletmeleri listeler; abonelik **plan/durumunu** değiştirir; işletmeyi aktif/pasif yapar.
- **Merchant Owner:** Auth ile giriş. İşletmesini yönetir, kampanya/müşteri oluşturur, müşteri arar, damga ekler, ödül kullandırır, QR/kart linki paylaşır, aboneliği **okur** (yazamaz).
- **Staff — MVP DIŞI.** (Admin SDK yok → e-postadan UID bulunamaz.) V2: davet kodu akışı.
- **Customer:** Auth yok. Sadece `/c/:cardToken` ile kendi kartını **get** ile görür. Telefonla sorgulamaz, listeleme yok, yazma yok.

---

## 5. Kritik Güvenlik Kararları (merged)

1. **Telefonla public kart sorgulama YASAK.** `customers where phone == X` için public read açmak tüm telefonları sızdırır (Rules sorguyu satır satır filtrelemez). Doğru model: `/c/:cardToken` tek **get**, token tahmin edilemez, doküman PII'siz.
2. **Public tarafta yazma YOK.** Self-enroll MVP dışı. Müşteri kaydı owner panelinden: ad+telefon al → müşteri oluştur → `cardToken` üret → `/c/:cardToken` linki/QR paylaş.
3. **publicCards ince model + PII yok.** İçinde: merchantId, campaignId, membershipId, cardToken, currentStamps, status, customerDisplayName (maskeli), lastUpdatedAt, createdAt. **Asla:** phone, normalizedPhone, fullName, customerId, note. Kampanya/işletme bilgileri **kopyalanmaz**, canlı okunur (bölüm 6).
4. **Private müşteri verisi** sadece `merchants/{mid}/customers/{cid}` (owner/admin).
5. **Membership sayaçları** sadece owner/admin yazar.
6. **Slug benzersizliği** `publicSlugs/{slug}` doc-ID ile; create owner'a kısıtlı (squatting önlenir).
7. **Global `users.role` YOK.** Owner ilişkisi `merchants.ownerId`. Owner kendi merchant'ını bulabilsin diye `users/{uid}.merchantId` pointer'ı yazılır (merchant `list` admin'e kapalı olduğu için query atamaz).
8. **Abonelik yazımı SADECE admin.** Owner kendini `pro` yapamaz.
9. **Tek aktif kampanya.** `merchants.activeCampaignId` pointer'ı. Yeni kampanya aktifleşince eskisi pasife (bölüm 14).
10. **publicCards bağlayıcı alan kilidi.** Update'te `merchantId/campaignId/membershipId` değiştirilemez (bölüm 12).
11. **transactions değişmez.** `create` evet, `update/delete: false`. Düzeltme silmeyle değil, `manual_adjustment` ile telafi edilir.

---

## 6. Veri Modeli

**users/{userId}** — `displayName, email, phone, merchantId, createdAt, updatedAt`. (global role yok; `merchantId` pointer var.) Sadece sahibi okur/yazar.

**merchants/{merchantId}** (PII yok) — `name, slug, sector, city, district, phone, instagram, googleMapsUrl, logoUrl, brandColor, ownerId, activeCampaignId, status: active|passive, createdAt, updatedAt`.

**publicSlugs/{slug}** — `merchantId, isActive, createdAt`.

**merchants/{mid}/campaigns/{cid}** (PII yok) — `name, description, requiredStamps, rewardDescription, status: active|passive, startDate, endDate?, coverImageUrl?, createdAt, updatedAt`.

**merchants/{mid}/customers/{cid}** (PII, private) — `fullName, phone, normalizedPhone, note?, consentAccepted, createdAt, updatedAt`.

**merchants/{mid}/memberships/{mid2}** (private) — `customerId, campaignId, cardToken, currentStamps, totalEarnedStamps, totalRedeemedRewards, status: active|passive, createdAt, updatedAt`.

**merchants/{mid}/transactions/{tid}** (private, değişmez) — `customerId, campaignId, membershipId, type: stamp_add|reward_redeem|manual_adjustment, amount, note?, createdBy, createdAt`.

**merchants/{mid}/subscription/current** (owner okur, admin yazar) — `plan: trial|mini|standard|pro, status: active|trialing|past_due|canceled, currentPeriodStart, currentPeriodEnd, updatedAt`. (limit/usage tutulmaz.)

**publicCards/{cardToken}** (public get; PII yok) — bölüm 5.3'teki alanlar.

---

## 6.1 Public Kart Veri Okuma Akışı

`/c/:cardToken` sadece **get** yapar, hiç list/query yok:
1. `publicCards/{cardToken}` get
2. `merchants/{merchantId}` get
3. `merchants/{merchantId}/campaigns/{campaignId}` get

Ödül uygunluğu client'ta: `currentStamps >= campaign.requiredStamps`. Kampanya/işletme düzenlenince kart anında güncel (drift yok).

---

## 7. Route Yapısı

**Public:** `/` (landing), `/login`, `/register`, `/c/:cardToken` (müşteri kartı), `/m/:merchantSlug` (**opsiyonel** tanıtım — yapılırsa `activeCampaignId` üzerinden kampanya get; self-enroll/telefon sorgusu YOK).

**Owner (`/app/*` korumalı):** `/onboarding`, `/app` (dashboard), `/app/campaigns`, `/app/campaigns/new`, `/app/customers`, `/app/customers/new`, `/app/stamp`, `/app/redeem`, `/app/transactions`, `/app/qr`, `/app/settings`, `/app/subscription`.

**Admin:** `/admin` (UID listesi config/env; işletme listele, plan/durum değiştir, aktif/pasif).

`/c/:cardToken` pasif/yok/aktif üç durumu da nazikçe gösterir; beyaz ekran patlatmaz.

---

## 8. Ana Akışlar

**Onboarding (slug sırası):** slug'u önce `get` ile kontrol et → müsaitse merchant oluştur (`ownerId = uid`) → `users/{uid}.merchantId` yaz → `publicSlugs/{slug}` oluştur (create mevcutsa "Bu işletme linki alınmış" hatası). Slug create kuralı merchant'ın önceden var olmasına baktığından **bu üçlü batch'lenemez; sırayla yap.**

**Müşteri oluşturma:** `createCustomerWithCard` (13.1) — tek batch'te customer + membership + publicCards + paylaşım linki.

**Damga ekleme:** owner telefonla `customers` arar → aktif membership → `addStamp` (13.2) tek writeBatch + increment. (Kart QR'ı taranınca: `cardToken` → publicCards get → `membershipId` direkt elde.)

**Ödül kullandırma:** `redeemReward` (13.3) — `runTransaction`, eşik kontrolü transaction içinde campaign okunarak.

**Kampanya aktif etme:** `activateCampaign` (14) — eski aktifi pasifle + yeniyi aktifle + `merchants.activeCampaignId` güncelle, tek batch.

---

## 9–11. UI/UX, Dosya Yapısı, Kalite

Mobil-first, Türkçe, esnaf dili, büyük butonlar. Loading/empty/error + başarı toast'ı zorunlu. Telefon normalize, tarih okunabilir.

**Kelimeler:** İşletme Paneli, Kampanya, Damga, Ödül, Müşteri, Sadakat Kartı, QR Kod, Damga Ekle, Ödül Kullandır, Abonelik. **Kullanma:** Loyalty, Stamp, CRM, Tenant, Segment, Conversion.

```
src/
  components/
  features/ (auth onboarding merchants campaigns customers loyalty public-card transactions subscription admin)
  firebase/ (config.ts auth.ts firestore.ts)
  lib/ (utils.ts phone.ts slug.ts token.ts dates.ts constants.ts)
  pages/ routes/ types/ hooks/
firebase.json  firestore.rules  firestore.indexes.json  .env.example  README.md  DECISIONS.md
```

`lib/constants.ts` → `PLAN_LIMITS` (sadece gösterim). Token: `crypto.getRandomValues`, ≥128-bit, URL-safe, çakışmada yeniden üret, asla telefondan/addan/sıralı ID'den türetme.

---

## 12. firestore.rules (merged — birebir uygula)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }

    function isAdmin() {
      return signedIn() && request.auth.uid in [
        'ADMIN_UID_1'   // deploy öncesi gerçek admin UID(ler)i ile değiştir
      ];
    }

    function merchantDoc(mid) {
      return get(/databases/$(database)/documents/merchants/$(mid));
    }
    function isMerchantOwner(mid) {
      return signedIn() && merchantDoc(mid).data.ownerId == request.auth.uid;
    }

    // Kullanıcı profili (merchantId pointer'ı burada)
    match /users/{userId} {
      allow get, create, update: if signedIn() && request.auth.uid == userId;
      allow list, delete: if isAdmin();
    }

    // Slug benzersizliği — create owner'a kısıtlı (squatting önlenir; merchant önce var olmalı)
    match /publicSlugs/{slug} {
      allow get: if true;
      allow list: if false;
      allow create: if signedIn() && isMerchantOwner(request.resource.data.merchantId);
      allow update, delete: if isAdmin() || (signedIn() && isMerchantOwner(resource.data.merchantId));
    }

    match /merchants/{merchantId} {
      allow get:    if true;                  // PII yok; public kart/tanıtım için
      allow list:   if isAdmin();             // enumerasyon engellenir
      allow create: if signedIn() && request.resource.data.ownerId == request.auth.uid;
      allow update: if isMerchantOwner(merchantId) || isAdmin();
      allow delete: if isAdmin();             // cascade yok; owner silemez

      match /campaigns/{campaignId} {
        allow get:  if true;                  // PII yok; public kart için
        allow list: if isMerchantOwner(merchantId) || isAdmin();
        allow create, update, delete: if isMerchantOwner(merchantId) || isAdmin();
      }

      match /customers/{customerId} {         // PII
        allow read, write: if isMerchantOwner(merchantId) || isAdmin();
      }

      match /memberships/{membershipId} {
        allow read, write: if isMerchantOwner(merchantId) || isAdmin();
      }

      match /transactions/{transactionId} {
        allow read, create: if isMerchantOwner(merchantId) || isAdmin();
        allow update, delete: if false;       // değişmez (audit)
      }

      match /subscription/{docId} {
        allow get:  if isMerchantOwner(merchantId) || isAdmin();
        allow list: if isAdmin();
        allow create, update, delete: if isAdmin();   // owner planını yazamaz
      }
    }

    match /publicCards/{cardToken} {
      allow get:  if true;                     // PII yok; pasifi UI gösterir
      allow list: if false;

      allow create: if isAdmin() || isMerchantOwner(request.resource.data.merchantId);

      // Bağlayıcı alanlar update'te değiştirilemez
      allow update: if (isAdmin() || isMerchantOwner(resource.data.merchantId))
        && request.resource.data.merchantId   == resource.data.merchantId
        && request.resource.data.campaignId   == resource.data.campaignId
        && request.resource.data.membershipId == resource.data.membershipId;

      allow delete: if isAdmin() || isMerchantOwner(resource.data.merchantId);
    }
  }
}
```

---

## 13. Referans Servis Fonksiyonları (firestore.ts)

> İmportlar: `import { writeBatch, runTransaction, doc, collection, query, where, getDocs, increment, serverTimestamp } from 'firebase/firestore'`.

### 13.1 Müşteri + kart oluşturma (tek batch)
```ts
export async function createCustomerWithCard(p: {
  merchantId: string; campaignId: string;
  fullName: string; phone: string; note?: string;
}) {
  const cardToken = generateCardToken();            // crypto, ≥128-bit, URL-safe
  const normalizedPhone = normalizePhone(p.phone);

  const customerRef   = doc(collection(db, 'merchants', p.merchantId, 'customers'));
  const membershipRef = doc(collection(db, 'merchants', p.merchantId, 'memberships'));
  const publicCardRef = doc(db, 'publicCards', cardToken);

  const batch = writeBatch(db);
  batch.set(customerRef, {
    fullName: p.fullName, phone: p.phone, normalizedPhone,
    note: p.note ?? null, consentAccepted: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.set(membershipRef, {
    customerId: customerRef.id, campaignId: p.campaignId, cardToken,
    currentStamps: 0, totalEarnedStamps: 0, totalRedeemedRewards: 0,
    status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.set(publicCardRef, {                         // PII YOK
    merchantId: p.merchantId, campaignId: p.campaignId,
    membershipId: membershipRef.id, cardToken,
    currentStamps: 0, status: 'active',
    customerDisplayName: maskName(p.fullName),       // "B**** Y****"
    lastUpdatedAt: serverTimestamp(), createdAt: serverTimestamp(),
  });
  await batch.commit();
  return { customerId: customerRef.id, membershipId: membershipRef.id, cardToken };
}
```

### 13.2 Damga ekleme (writeBatch + increment)
```ts
export async function addStamp(p: {
  merchantId: string; membershipId: string; cardToken: string;
  campaignId: string; customerId: string; ownerUid: string; note?: string;
}) {
  const membershipRef = doc(db, 'merchants', p.merchantId, 'memberships', p.membershipId);
  const publicCardRef = doc(db, 'publicCards', p.cardToken);
  const txRef         = doc(collection(db, 'merchants', p.merchantId, 'transactions'));

  const batch = writeBatch(db);
  batch.update(membershipRef, {
    currentStamps: increment(1), totalEarnedStamps: increment(1),
    updatedAt: serverTimestamp(),
  });
  batch.update(publicCardRef, {                      // bağlayıcı alanlara dokunma
    currentStamps: increment(1), lastUpdatedAt: serverTimestamp(),
  });
  batch.set(txRef, {
    customerId: p.customerId, campaignId: p.campaignId, membershipId: p.membershipId,
    type: 'stamp_add', amount: 1, note: p.note ?? null,
    createdBy: p.ownerUid, createdAt: serverTimestamp(),
  });
  await batch.commit();
}
```

### 13.3 Ödül kullandırma (runTransaction + eşik kontrolü, campaign tx içinde okunur)
```ts
export async function redeemReward(p: {
  merchantId: string; membershipId: string; cardToken: string;
  campaignId: string; customerId: string; ownerUid: string; note?: string;
}) {
  const membershipRef = doc(db, 'merchants', p.merchantId, 'memberships', p.membershipId);
  const campaignRef   = doc(db, 'merchants', p.merchantId, 'campaigns', p.campaignId);
  const publicCardRef = doc(db, 'publicCards', p.cardToken);

  await runTransaction(db, async (tx) => {
    const mSnap = await tx.get(membershipRef);        // tüm read'ler write'lardan önce
    const cSnap = await tx.get(campaignRef);
    if (!mSnap.exists()) throw new Error('Üyelik bulunamadı');
    if (!cSnap.exists()) throw new Error('Kampanya bulunamadı');

    const current  = (mSnap.data().currentStamps as number) ?? 0;
    const required = (cSnap.data().requiredStamps as number) ?? 0;
    if (current < required) throw new Error('Ödül hakkı yok');

    const txRef = doc(collection(db, 'merchants', p.merchantId, 'transactions'));
    tx.update(membershipRef, {
      currentStamps: current - required,
      totalRedeemedRewards: increment(1),
      updatedAt: serverTimestamp(),
    });
    tx.update(publicCardRef, {
      currentStamps: current - required, lastUpdatedAt: serverTimestamp(),
    });
    tx.set(txRef, {
      customerId: p.customerId, campaignId: p.campaignId, membershipId: p.membershipId,
      type: 'reward_redeem', amount: -required, note: p.note ?? null,
      createdBy: p.ownerUid, createdAt: serverTimestamp(),
    });
  });
}
```

---

## 14. Kampanya Aktif Etme (tek aktif kampanya)

```ts
export async function activateCampaign(merchantId: string, campaignId: string) {
  const activeQ = query(
    collection(db, 'merchants', merchantId, 'campaigns'),
    where('status', '==', 'active'),
  );
  const activeSnap = await getDocs(activeQ);          // owner list edebilir

  const batch = writeBatch(db);
  activeSnap.forEach((d) => {
    if (d.id !== campaignId) batch.update(d.ref, { status: 'passive', updatedAt: serverTimestamp() });
  });
  batch.update(doc(db, 'merchants', merchantId, 'campaigns', campaignId), {
    status: 'active', updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'merchants', merchantId), {
    activeCampaignId: campaignId, updatedAt: serverTimestamp(),
  });
  await batch.commit();
}
```

UI'da açıkça yaz: "MVP'de aynı anda yalnızca 1 aktif kampanya kullanılabilir."

---

## 15. Teslim Sırası

1. Proje yapısı + Firebase config + env
2. Auth + protected routes
3. Onboarding (slug kontrolü + `users.merchantId`)
4. Firestore servis katmanı (bölüm 13–14)
5. **firestore.rules** (bölüm 12) + emulator denemesi
6. Dashboard → Kampanya CRUD (+activateCampaign) → Müşteri oluşturma/link → Public kart → Damga → Ödül → QR → Admin
7. README + DECISIONS.md

Eksikleri `TODO:` ile işaretle; kod çalışır kalsın.

---

## 16. README (zorunlu notlar)

`subscription/current` owner tarafından yazılamaz (plan değişimi admin) · usage subscription'da tutulmaz, transactions'tan hesaplanır · damga = writeBatch atomik · ödül = runTransaction koşullu · publicCards ince model, PII yok · campaign/merchant publicCard'a kopyalanmaz, public kart 3 get yapar · public list/query yok · telefonla public sorgu yok · tek aktif kampanya · `/m/:merchantSlug` opsiyonel, çekirdek `/c/:cardToken` · staff & self-enroll MVP dışı · hard plan limit MVP dışı. Ayrıca: Firebase kurulumu, `.env`, veri modeli, lokal çalıştırma, Hosting deploy, MVP sınırları, V2 önerileri.

---

## 17. Manuel Test Senaryoları (README)

1. Owner `subscription/current` update **edemez**; admin edebilir; owner okuyabilir; public okuyamaz.
2. Damga sonrası membership + publicCards + transaction **aynı anda** güncellenir; yarıda kalmış tutarsız veri olmaz.
3. Ödül: yetersiz damgada hata; aynı ödül eşzamanlı iki kez kullandırılamaz.
4. Public: `merchants/{id}` ve `campaigns/{id}` **get** yapabilir; **list** yapamaz.
5. Public: customers/memberships/transactions okuyamaz/yazamaz, list atamaz.
6. publicCards update'te `merchantId/campaignId/membershipId` değiştirilemez.
7. transaction **silinemez/değiştirilemez**.
8. Kampanya adı/ödül/requiredStamps değişince public kart **güncel** değeri gösterir.
9. Yeni kampanya aktif edilince eskisi pasife geçer; `activeCampaignId` güncellenir.
10. Pasif kart sayfası nazik mesaj gösterir, beyaz ekran vermez.
11. Alınmış slug'da onboarding hata gösterir.
12. Owner login sonrası `users.merchantId` ile kendi işletmesine ulaşır (list gerekmez).

---

## 18. V2 (MVP'ye koyma)

Staff davet kodu · kontrollü self-enroll · Functions ile rate limit / hard kota · gerçek abonelik ödeme (iyzico/PayTR) · WhatsApp/SMS · advanced analytics · çok şubeli yapı.

---

## 19. Son Mimari Karar Tablosu

| Konu | Karar |
|---|---|
| subscription write / read | admin / owner+admin |
| usage / aylık işlem | tutulmaz / transactions sorgusundan |
| damga / ödül | writeBatch+increment / runTransaction (campaign tx içinde) |
| merchant get / list / delete | public / admin / admin-only |
| campaign get / list | public / owner+admin |
| publicCards | ince model, PII yok, get:true, bağlayıcı alan kilidi |
| campaign/merchant denormalizasyonu | yok (canlı get) |
| transactions | değişmez (update/delete:false) |
| slug create | owner'a kısıtlı |
| owner→merchant | `users.merchantId` pointer |
| aktif kampanya | işletme başına tek + `merchants.activeCampaignId` |
| `/m/:merchantSlug` | opsiyonel | 
| `/c/:cardToken` | çekirdek public akış |
| telefonla public sorgu / self-enroll / staff | yok / yok / MVP dışı |
| admin | sabit UID listesi |

---

## 20. En Önemli Ürün Kuralı

99 TL/ay mikro SaaS: basit, mobil-first, düşük destek, **public veri sızıntısı sıfır**. İlk sürümde güvenlik için gerekirse UX'ten ödün ver (owner-created müşteri). Değer: "Kağıt sadakat kartı yerine müşterileriniz telefondan damga toplasın; siz de tekrar gelen müşteri sayısını artırın."
