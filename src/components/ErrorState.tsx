// Veri yükleme hatası ekranı — SPEC §9: her sayfada loading/empty/error durumu zorunlu
export default function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-3xl mb-2">📡</p>
      <p className="text-gray-700 font-semibold mb-1">Veriler yüklenemedi</p>
      <p className="text-sm text-gray-400 mb-5">{message ?? 'İnternet bağlantınızı kontrol edip tekrar deneyin.'}</p>
      <button
        onClick={onRetry}
        className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 active:scale-[0.98]"
      >
        Tekrar Dene
      </button>
    </div>
  )
}
