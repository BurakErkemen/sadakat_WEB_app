import { Link } from 'react-router-dom'

export default function TermsPage() {
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Kullanım Koşulları</h1>
        <p className="text-sm text-gray-400 mb-8">Son güncelleme: Haziran 2026</p>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-6 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">1. Taraflar ve Kabul</h2>
            <p>
              Bu Kullanım Koşulları, <strong>Cyan Danışmanlık</strong> ("Şirket") ile Sadex platformunu
              kullanan işletmeler ve bireyler ("Kullanıcı") arasındaki anlaşmayı düzenler.
              Platforma kaydolarak veya platformu kullanarak bu koşulları kabul etmiş sayılırsınız.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">2. Hizmetin Tanımı</h2>
            <p>
              Sadex; işletmelerin müşterilerine yönelik dijital sadakat kartı oluşturmasına,
              damga/puan işlemi yapmasına ve ödül yönetimi gerçekleştirmesine olanak tanıyan
              bir SaaS (Hizmet Olarak Yazılım) platformudur.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">3. Hesap Yükümlülükleri</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Hesap bilgilerinizin doğruluğundan ve güvenliğinden siz sorumlusunuz.</li>
              <li>Şifrenizi üçüncü kişilerle paylaşmayınız.</li>
              <li>Hesabınız üzerinden gerçekleştirilen tüm işlemler size aittir.</li>
              <li>İhlal tespit edilmesi halinde hesabınız askıya alınabilir.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">4. Abonelik ve Ödeme</h2>
            <p className="mb-2">
              Platform, seçilen plana göre aylık veya yıllık abonelik modeliyle sunulmaktadır.
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Ödemeler Shopier üzerinden güvenli şekilde alınır.</li>
              <li>Abonelik yenileme bildirimleri e-posta ile yapılır.</li>
              <li>İptal talebi sonrasında mevcut dönem sonuna kadar erişim devam eder; yeni dönem başlamaz.</li>
              <li>Plan yükseltme talepleri destek ekibi aracılığıyla işlenir; geçiş tarihinden önce kullanılmış süre ücretlendirilmeye devam eder.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">4A. İade ve Cayma Politikası</h2>

            <p className="mb-3">
              Sadex, işletmelere yönelik (B2B) bir SaaS platformudur. Platform üzerinden yapılan
              abonelik satın alımları ticari amaçlı olup 6502 sayılı Tüketicinin Korunması Hakkında
              Kanun kapsamındaki tüketici cayma hakları bu sözleşmeye uygulanmaz.
            </p>

            <p className="font-medium text-gray-800 mb-2">Genel İade Kuralı</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 mb-3">
              <li>
                Abonelik dönemi başladıktan sonra — kısmen de olsa kullanılmış olması halinde —
                <strong className="text-gray-800"> iade yapılmaz.</strong>
              </li>
              <li>
                Ödeme tamamlanıp hesap aktive edildikten itibaren hizmet teslim edilmiş sayılır;
                Mesafeli Sözleşmeler Yönetmeliği madde 15/ğ uyarınca dijital içerik/hizmet
                teslimata başlandığında cayma hakkı sona erer.
              </li>
              <li>
                Bu koşullar satın alma ekranında açıkça sunulmakta ve ödeme öncesinde onay
                alınmaktadır; söz konusu onay cayma hakkının kullanılamayacağının kabulü niteliğindedir.
              </li>
            </ul>

            <p className="font-medium text-gray-800 mb-2">Plan Değişikliği</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 mb-3">
              <li>Daha düşük bir plana geçmek istenmesi halinde geçmiş dönemlere ait ücretler iade edilmez.</li>
              <li>Yükseltme taleplerinde yeni plan, ödeme onayının ardından aktive edilir; önceki plan ücreti mahsup edilmez.</li>
              <li>Yıllık paketlerde kalan aylara orantılı kısmi iade yapılmaz.</li>
            </ul>

            <p className="font-medium text-gray-800 mb-2">İstisnai Durumlar</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>
                Şirket kaynaklı teknik bir hata veya kesinti nedeniyle hizmetin <strong>7 takvim günü veya daha uzun süre</strong> kesintisiz
                kullanılamaması durumunda Şirket, hizmet dışında kalınan süreyle orantılı kredi (sonraki dönemde mahsup) sağlayabilir.
                Bu durum nakit iade hakkı doğurmaz.
              </li>
              <li>
                İade talepleri yalnızca{' '}
                <a href="mailto:info@cyandanismanlik.com" className="text-violet-600 hover:underline font-medium">
                  info@cyandanismanlik.com
                </a>{' '}
                adresine yazılı olarak iletilmelidir; talep, ödeme tarihinden itibaren <strong>7 gün</strong> içinde
                yapılmadıkça değerlendirmeye alınmaz.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">5. Kabul Edilemez Kullanım</h2>
            <p className="mb-2">Aşağıdaki davranışlar kesinlikle yasaktır:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Platformu yasa dışı amaçlarla kullanmak</li>
              <li>Başka kullanıcıların verilerine yetkisiz erişim sağlamak</li>
              <li>Sisteme zarar verecek yazılım veya kod enjekte etmek</li>
              <li>Müşteri verilerini üçüncü taraflarla izinsiz paylaşmak</li>
              <li>Spam veya yanıltıcı içerik oluşturmak</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">6. Fikri Mülkiyet</h2>
            <p>
              Platform üzerindeki tüm yazılım, tasarım, marka ve içerik Şirkete aittir.
              Kullanıcıya yalnızca bu koşullar çerçevesinde sınırlı, devredilemez bir kullanım lisansı verilmektedir.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">7. Veri Koruma</h2>
            <p>
              Kişisel verilerin işlenmesine ilişkin detaylı bilgi için{' '}
              <Link to="/kvkk" className="text-violet-600 hover:underline font-medium">KVKK Aydınlatma Metni</Link>'ni
              ve{' '}
              <Link to="/gizlilik" className="text-violet-600 hover:underline font-medium">Gizlilik Politikası</Link>'nı
              inceleyiniz.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">8. Sorumluluk Sınırı</h2>
            <p>
              Şirket, platformun kesintisiz veya hatasız çalışacağını garanti etmez.
              Teknik arızalar, üçüncü taraf hizmet kesintileri veya mücbir sebeplerden kaynaklanan
              doğrudan ya da dolaylı zararlardan Şirket sorumlu tutulamaz.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">9. Değişiklikler</h2>
            <p>
              Şirket, bu koşulları önceden bildirmeksizin güncelleyebilir. Güncel koşullar bu sayfada yayımlanır.
              Platformu kullanmaya devam etmeniz güncel koşulları kabul ettiğiniz anlamına gelir.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">10. Uygulanacak Hukuk</h2>
            <p>
              Bu koşullar Türk Hukuku'na tabidir. Anlaşmazlıklarda İstanbul Mahkemeleri ve
              İcra Daireleri yetkilidir.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">11. İletişim</h2>
            <p>
              Sorularınız için:{' '}
              <a href="mailto:info@cyandanismanlik.com" className="text-violet-600 hover:underline font-medium">
                info@cyandanismanlik.com
              </a>
            </p>
          </section>

        </div>
      </main>
    </div>
  )
}
