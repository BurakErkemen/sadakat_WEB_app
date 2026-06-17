import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <header className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
        <span className="text-xl font-bold text-indigo-600">DamgaKart</span>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">Giriş Yap</Link>
          <Link to="/register" className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-xl font-medium hover:bg-indigo-700">
            Ücretsiz Dene
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
          Kağıt sadakat kartı<br />
          <span className="text-indigo-600">geçmişte kaldı</span>
        </h1>
        <p className="text-lg text-gray-500 mt-6 max-w-xl mx-auto">
          Müşterileriniz telefondan damga toplasın. Siz de tekrar gelen müşteri sayısını artırın.
          Kafe, kuaför, oto yıkama — her işletmeye uygun.
        </p>
        <div className="flex items-center justify-center gap-4 mt-8">
          <Link
            to="/register"
            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200"
          >
            Hemen Başla
          </Link>
          <span className="text-sm text-gray-400">99 TL/ay · Kredi kartı gerekmez</span>
        </div>

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
          <FeatureCard icon="📱" title="Telefondan Kart" desc="Müşteri kağıt taşımaz. QR kodu okutup kartına bakar." />
          <FeatureCard icon="✅" title="Hızlı Damga" desc="Telefon numarasıyla arama — saniyeler içinde damga ekle." />
          <FeatureCard icon="🎁" title="Otomatik Ödül" desc="Limit dolunca sistem ödülü gösterir. Manuel takip yok." />
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 mt-8">
        <p className="text-center text-xs text-gray-400">
          DamgaKart &copy; {new Date().getFullYear()} &middot; Tasarım &amp; Geliştirme:{' '}
          <a href="mailto:info@cyandanismanlik.com" className="text-indigo-400 hover:text-indigo-600 transition-colors">
            Cyan Danışmanlık
          </a>
        </p>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-bold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{desc}</p>
    </div>
  )
}
