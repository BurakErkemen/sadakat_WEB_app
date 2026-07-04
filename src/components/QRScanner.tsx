import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { trapTabKey } from '@/lib/focusTrap'

interface QRScannerProps {
  onScan: (cardToken: string) => void
  onClose: () => void
}

function extractCardToken(raw: string): string | null {
  try {
    const url = new URL(raw)
    const parts = url.pathname.split('/')
    const idx = parts.indexOf('c')
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1]
  } catch {
    if (/^[a-f0-9]{20,}$/i.test(raw.trim())) return raw.trim()
  }
  return null
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const divId = 'qr-scanner-region'
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [errorMsg, setErrorMsg] = useState('')
  const [manualValue, setManualValue] = useState('')
  const [manualError, setManualError] = useState(false)
  const manualInputRef = useRef<HTMLInputElement>(null)

  // Kamera çalışmazsa fallback: kart linkini veya kodunu elle yapıştır
  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const token = extractCardToken(manualValue.trim())
    if (!token) { setManualError(true); return }
    await scannerRef.current?.stop().catch(() => null)
    onScan(token)
  }

  async function startCamera() {
    setStatus('starting')
    setErrorMsg('')

    const scanner = new Html5Qrcode(divId)
    scannerRef.current = scanner

    // Önce arka kamera, başarısız olursa ön kamera dene
    const tryStart = async (facingMode: 'environment' | 'user') => {
      await scanner.start(
        { facingMode },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const token = extractCardToken(decodedText)
          if (token) {
            void scanner.stop().catch(() => null)
            onScan(token)
          }
        },
        () => null,
      )
    }

    try {
      await tryStart('environment')
      setStatus('scanning')
    } catch {
      try {
        await tryStart('user')
        setStatus('scanning')
      } catch (err) {
        console.error('Kamera başlatılamadı:', err)
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('notallowed')) {
          setErrorMsg('Kamera iznine ihtiyaç var. Tarayıcı adres çubuğundaki kilit simgesinden kamera iznini açın.')
        } else if (msg.toLowerCase().includes('notfound') || msg.toLowerCase().includes('devicenotfound')) {
          setErrorMsg('Kamera bulunamadı. Cihazınızda kamera olduğundan emin olun.')
        } else {
          setErrorMsg('Kamera başlatılamadı. Başka bir sekme kamerayı kullanıyor olabilir.')
        }
        setStatus('error')
      }
    }
  }

  useEffect(() => {
    void startCamera()
    return () => {
      scannerRef.current?.stop().catch(() => null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Escape ile kapatma + odak dialog içinde kalsın
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      trapTabKey(dialogRef.current, e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (status === 'error') manualInputRef.current?.focus()
  }, [status])

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="QR Kodu Tara" className="bg-white rounded-2xl overflow-hidden w-full max-w-sm">
        {/* Başlık */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="font-semibold text-gray-900">QR Kodu Tara</p>
          <button onClick={onClose} aria-label="Kapat" className="text-gray-400 hover:text-gray-600 text-xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            ✕
          </button>
        </div>

        {/* Kamera alanı */}
        <div className="relative">
          <div id={divId} className="w-full" />

          {/* Başlatılıyor overlay */}
          {status === 'starting' && (
            <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center gap-3 min-h-[200px]">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Kamera başlatılıyor…</p>
            </div>
          )}

          {/* Hata overlay */}
          {status === 'error' && (
            <div className="bg-gray-50 flex flex-col items-center justify-center gap-4 p-6 min-h-[200px] text-center">
              <span className="text-4xl">📵</span>
              <p className="text-sm text-gray-600 leading-relaxed">{errorMsg}</p>
              <button
                onClick={() => {
                  scannerRef.current?.stop().catch(() => null)
                  void startCamera()
                }}
                className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700"
              >
                Tekrar Dene
              </button>
            </div>
          )}
        </div>

        {/* Alt bilgi */}
        {status === 'scanning' && (
          <p className="text-center text-xs text-gray-400 px-4 py-3">
            Müşterinin sadakat kartı QR kodunu kameraya gösterin
          </p>
        )}

        {/* Manuel giriş fallback — kamera çalışmasa da işlem tamamlanabilir */}
        <div className="border-t border-gray-100 px-4 py-3">
          <form onSubmit={handleManualSubmit} className="space-y-1.5">
            <label htmlFor="manual-card-input" className="text-xs font-medium text-gray-500">
              QR okunmuyor mu? Kart linkini veya kodunu yapıştırın
            </label>
            <div className="flex gap-2">
              <input
                ref={manualInputRef}
                id="manual-card-input"
                type="text"
                inputMode="url"
                autoComplete="off"
                enterKeyHint="done"
                value={manualValue}
                onChange={(e) => { setManualValue(e.target.value); setManualError(false) }}
                placeholder="https://…/c/abc123 veya kart kodu"
                aria-invalid={manualError}
                aria-describedby={manualError ? 'manual-card-error' : undefined}
                className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${manualError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`}
              />
              <button
                type="submit"
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold shrink-0"
              >
                Bul
              </button>
            </div>
            {manualError && (
              <p id="manual-card-error" role="alert" className="text-xs text-red-600">Geçerli bir kart linki veya kodu girin.</p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
