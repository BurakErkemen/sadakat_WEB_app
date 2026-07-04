import { useState } from 'react'

const STORAGE_KEY = 'sadex_cookie_consent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(STORAGE_KEY))

  if (!visible) return null

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, 'declined')
    setVisible(false)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-[280px] bg-white rounded-2xl shadow-xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <span className="text-xl shrink-0">🍪</span>
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-tight">Bu site çerez kullanır</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Oturum bilgilerinizi ve uygulama tercihlerinizi saklamak için zorunlu çerezler kullanılmaktadır.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={accept}
          className="flex-1 min-h-[44px] bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
          Kabul Et
        </button>
        <button
          onClick={decline}
          className="flex-1 min-h-[44px] border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">
          Reddet
        </button>
      </div>
    </div>
  )
}
