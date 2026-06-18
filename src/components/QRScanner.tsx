import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

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

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm">
        {/* Başlık */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="font-semibold text-gray-900">QR Kodu Tara</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
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
      </div>
    </div>
  )
}
