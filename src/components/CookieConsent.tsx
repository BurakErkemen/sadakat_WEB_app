import { useEffect, useState } from 'react'
import { PREFERENCES_EVENT, readConsent, saveConsent } from '@/lib/browserPreferences'

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => readConsent() === null)
  const [error, setError] = useState(false)
  useEffect(() => {
    function sync() { setVisible(readConsent() === null) }
    window.addEventListener('storage', sync)
    window.addEventListener(PREFERENCES_EVENT, sync)
    return () => { window.removeEventListener('storage', sync); window.removeEventListener(PREFERENCES_EVENT, sync) }
  }, [])

  function choose(choice: 'accepted' | 'declined') {
    const saved = saveConsent(choice)
    setError(!saved)
    setVisible(!saved)
  }

  if (!visible) return <button onClick={() => setVisible(true)} className="fixed bottom-1 left-1 z-40 rounded-lg bg-white border px-2 py-1 text-xs text-gray-500">Çerez Tercihleri</button>
  return <div role="dialog" aria-label="Çerez ve depolama tercihleri" className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 sm:max-w-sm bg-white rounded-2xl shadow-xl border p-4 space-y-3">
    <p className="text-sm font-semibold">Çerez ve depolama tercihleri</p>
    <p className="text-xs text-gray-600">Giriş oturumu, güvenlik amaçlı son etkinlik zamanı ve bu seçim tarayıcıda saklanır. Şifrenizi saklamayız. “Beni hatırla” seçiminiz giriş ekranından yönetilir.</p>
    <p className="text-xs text-gray-600">İzin verirseniz okuduğunuz destek yanıtlarını bu cihazda hatırlarız. İzin vermezseniz bu bilgi yalnızca açık sayfanın belleğinde tutulur. Reklam veya ziyaretçi takip çerezi kullanmıyoruz.</p>
    {error && <p role="alert" className="text-xs text-red-600">Tarayıcı depolaması kapalı; tercihiniz kaydedilemedi. İsteğe bağlı kayıt yapılmayacak.</p>}
    <div className="flex gap-2">
      <button onClick={() => choose('accepted')} className="flex-1 min-h-11 bg-indigo-600 text-white text-xs rounded-lg">Tercihleri Hatırla</button>
      <button onClick={() => choose('declined')} className="flex-1 min-h-11 border text-xs rounded-lg">Yalnızca Zorunlu</button>
    </div>
    {error && <button onClick={() => setVisible(false)} className="text-xs underline">Kaydetmeden Kapat</button>}
  </div>
}
