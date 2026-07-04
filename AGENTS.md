# DamgaKart Agent Instructions

Bu proje DamgaKart — Dijital Sadakat Kartı SaaS MVP projesidir.

Ana teknik ve ürün spesifikasyonu:
@SPEC.md

## Roller

- Claude Code: uygulayıcı ajan.
- Codex: denetçi / reviewer.
- Codex varsayılan olarak dosya değiştirmez.
- Kod yazımı Claude tarafından yapılır.
- Review, güvenlik ve mimari denetim Codex tarafından yapılır.

## Zorunlu kurallar

- TypeScript strict.
- any kullanma.
- Firebase Auth + Firestore + Hosting dışına çıkma.
- Cloud Functions, Admin SDK, backend, REST API yok.
- Yetkilendirme client tarafında değil Firestore Rules tarafında yapılır.
- Public dokümanlarda PII bulunmaz.
- Telefonla public müşteri sorgusu yok.
- Self-enroll MVP dışı.
- Staff MVP dışı.
- Transactions immutable.
- Çok dokümanlı yazımlar batch veya transaction ile atomik yapılır.
- Eksik ya da çelişkili durumda DECISIONS.md dosyasına karar notu ekle.