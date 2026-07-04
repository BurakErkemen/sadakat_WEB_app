import { Link } from 'react-router-dom'

export default function GizlilikPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center min-h-[44px]">
            <img src="/logo.png" alt="Puaniva" className="h-9 w-auto"
              style={{ objectFit: 'contain', maxWidth: '140px' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          </Link>
          <Link to="/" className="inline-flex items-center min-h-[44px] px-2 text-sm text-gray-500 hover:text-violet-600 transition-colors">← Ana Sayfa</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Gizlilik Politikası</h1>
        <p className="text-sm text-gray-400 mb-8">Son güncelleme: Haziran 2025</p>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-6 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">1. Genel Bakış</h2>
            <p>
              Puaniva olarak gizliliğinize önem veriyoruz. Bu politika, platformumuzu kullanırken
              hangi verileri topladığımızı, nasıl kullandığımızı ve koruduğumuzu açıklamaktadır.
              KVKK uyumluluğuna ilişkin detaylar için{' '}
              <Link to="/kvkk" className="text-violet-600 hover:underline font-medium inline-block py-3 -my-3 px-0.5">KVKK Aydınlatma Metni</Link>'ni
              inceleyiniz.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">2. Topladığımız Veriler</h2>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-gray-800">İşletme Sahipleri:</p>
                <ul className="list-disc list-inside text-gray-600 space-y-1 mt-1">
                  <li>Ad, e-posta adresi, şifre (şifreli saklanır)</li>
                  <li>İşletme adı, türü, şehir bilgisi</li>
                  <li>Abonelik ve ödeme kayıtları</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-800">Son Kullanıcılar (Sadakat Kartı Sahipleri):</p>
                <ul className="list-disc list-inside text-gray-600 space-y-1 mt-1">
                  <li>Ad (isteğe bağlı, işletme girişi)</li>
                  <li>İşlem geçmişi (damga/puan/ödül)</li>
                  <li>Kart QR kodu (anonim token)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">3. Çerezler ve Takip</h2>
            <p>
              Platform, oturum yönetimi amacıyla yalnızca zorunlu çerezler kullanmaktadır.
              Üçüncü taraf analitik veya reklam çerezleri kullanılmamaktadır.
              Firebase Authentication oturum bilgisini tarayıcı yerel depolamasında (localStorage) saklayabilir.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">4. Veri Saklama Süresi</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Hesap verileri: Hesap silinene kadar</li>
              <li>İşlem kayıtları: Yasal saklama süresi boyunca (5 yıl)</li>
              <li>Destek talepleri: 2 yıl</li>
              <li>Teknik loglar: 90 gün</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">5. Üçüncü Taraf Hizmetler</h2>
            <p className="mb-2">Platform aşağıdaki üçüncü taraf hizmetlerden yararlanmaktadır:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li><strong>Google Firebase:</strong> Kimlik doğrulama, veritabanı, barındırma</li>
              <li><strong>Shopier:</strong> Ödeme işlemleri (PCI DSS uyumlu)</li>
            </ul>
            <p className="mt-2 text-gray-500">
              Bu hizmetlerin kendi gizlilik politikaları geçerlidir.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">6. Güvenlik</h2>
            <p>
              Verileriniz TLS/SSL şifreli bağlantılar üzerinden iletilmekte ve Firebase'in güvenli
              altyapısında saklanmaktadır. Şifreler hiçbir zaman düz metin olarak tutulmaz.
              Erişim, rol bazlı yetkilendirme (Firestore Security Rules) ile kısıtlanmaktadır.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">7. İletişim</h2>
            <p>
              Gizlilik ile ilgili sorularınız için:{' '}
              <a href="mailto:info@cyandanismanlik.com" className="text-violet-600 hover:underline font-medium inline-block py-3 -my-3 px-0.5">
                info@cyandanismanlik.com
              </a>
            </p>
          </section>

        </div>
      </main>
    </div>
  )
}
