// Telefon numarasını normalize et (Türkiye): başındaki 0, +90 kaldır, sadece rakam bırak
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('90') && digits.length === 12) digits = digits.slice(2)
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1)
  return digits // 10 haneli
}

export function formatPhone(normalized: string): string {
  if (normalized.length !== 10) return normalized
  return `0${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6, 8)} ${normalized.slice(8)}`
}
