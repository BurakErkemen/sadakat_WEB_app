import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QRScannerProps {
  onScan: (cardToken: string) => void
  onClose: () => void
}

// URL'den cardToken çıkar: /c/{token} → token
function extractCardToken(raw: string): string | null {
  try {
    const url = new URL(raw)
    const parts = url.pathname.split('/')
    const idx = parts.indexOf('c')
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1]
  } catch {
    // raw string direkt token olabilir (32+ hex karakter)
    if (/^[a-f0-9]{20,}$/i.test(raw.trim())) return raw.trim()
  }
  return null
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const divId = 'qr-scanner-region'

  useEffect(() => {
    const scanner = new Html5Qrcode(divId)
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const token = extractCardToken(decodedText)
          if (token) {
            void scanner.stop().catch(() => null)
            onScan(token)
          }
        },
        () => null, // hata sessiz geç
      )
      .catch((err: unknown) => {
        console.error('Kamera başlatılamadı:', err)
      })

    return () => {
      scanner.stop().catch(() => null)
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="font-semibold text-gray-900">QR Kodu Tara</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div id={divId} className="w-full" />
        <p className="text-center text-xs text-gray-400 px-4 py-3">
          Müşterinin sadakat kartı QR kodunu kameraya gösterin
        </p>
      </div>
    </div>
  )
}
