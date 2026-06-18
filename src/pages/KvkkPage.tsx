import { Link } from 'react-router-dom'

export default function KvkkPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/">
            <img src="/sadex.png" alt="Sadex" className="h-9 w-auto"
              style={{ objectFit: 'contain', maxWidth: '140px' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          </Link>
          <Link to="/" className="text-sm text-gray-500 hover:text-violet-600 transition-colors">← Ana Sayfa</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">KVKK Aydınlatma Metni</h1>
        <p className="text-sm text-gray-400 mb-8">Son güncelleme: Haziran 2025</p>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-6 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">1. Veri Sorumlusu</h2>
            <p>
              Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında
              <strong> Cyan Danışmanlık</strong> ("Şirket") tarafından veri sorumlusu sıfatıyla hazırlanmıştır.
              Sadex platformu üzerinden toplanan kişisel verileriniz Şirket tarafından işlenmektedir.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">2. İşlenen Kişisel Veriler</h2>
            <p className="mb-2">Aşağıdaki kişisel verileriniz işlenebilmektedir:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li><strong>Kimlik:</strong> Ad, soyad</li>
              <li><strong>İletişim:</strong> E-posta adresi, telefon numarası</li>
              <li><strong>İşlem:</strong> Damga/puan geçmişi, ödül kullanım bilgileri</li>
              <li><strong>Teknik:</strong> IP adresi, tarayıcı türü, oturum bilgileri</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">3. Kişisel Verilerin İşlenme Amaçları</h2>
            <p className="mb-2">Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Sadakat programı hizmetinin sunulması ve yönetimi</li>
              <li>Kullanıcı hesabının oluşturulması ve kimlik doğrulaması</li>
              <li>Müşteri destek taleplerinin karşılanması</li>
              <li>Yasal yükümlülüklerin yerine getirilmesi</li>
              <li>Hizmet kalitesinin iyileştirilmesi ve analizler</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">4. Kişisel Verilerin Aktarıldığı Taraflar</h2>
            <p>
              Kişisel verileriniz; altyapı hizmetleri (Google Firebase / Google Cloud), ödeme hizmetleri (Shopier)
              ve yasal zorunluluk halinde yetkili kamu kurum ve kuruluşlarıyla paylaşılabilir.
              Bu aktarımlar KVKK'nın 8. ve 9. maddelerinde öngörülen güvencelere uygun olarak gerçekleştirilir.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">5. Kişisel Verilerin Toplanma Yöntemi ve Hukuki Sebebi</h2>
            <p>
              Kişisel verileriniz; web formu, uygulama kaydı ve işletme üyesi etkileşimleri aracılığıyla
              elektronik ortamda toplanmaktadır. İşlemenin hukuki sebepleri; sözleşmenin ifası, yasal yükümlülük
              ve meşru menfaattir (KVKK md. 5/2-c, 5/2-ç, 5/2-f).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">6. Veri Sahibinin Hakları (KVKK Madde 11)</h2>
            <p className="mb-2">KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>İşlenmişse bilgi talep etme</li>
              <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
              <li>Yurt içi veya yurt dışına aktarıldığı üçüncü kişileri öğrenme</li>
              <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
              <li>Silinmesini veya yok edilmesini isteme</li>
              <li>Düzeltme/silme işlemlerinin üçüncü kişilere bildirilmesini isteme</li>
              <li>Aleyhinize sonuç doğuruyorsa itiraz etme</li>
              <li>Zararın giderilmesini talep etme</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">7. Başvuru Yöntemi</h2>
            <p>
              Haklarınıza ilişkin başvurularınızı{' '}
              <a href="mailto:info@cyandanismanlik.com" className="text-violet-600 hover:underline font-medium">
                info@cyandanismanlik.com
              </a>{' '}
              adresine e-posta göndererek iletebilirsiniz.
              Başvurunuz en geç 30 gün içinde sonuçlandırılacaktır.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">8. Veri Güvenliği</h2>
            <p>
              Kişisel verileriniz Google Firebase altyapısında saklanmakta olup endüstri standardı
              TLS şifrelemesi ve erişim kontrolü uygulanmaktadır. Şirket, yetkisiz erişim, kayıp ve
              ifşaya karşı teknik ve idari tedbirleri almaktadır.
            </p>
          </section>

        </div>
      </main>
    </div>
  )
}
