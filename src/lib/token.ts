// Token üretimi: crypto.getRandomValues, ≥128-bit, URL-safe
// Asla telefondan/addan/sıralı ID'den türetme
export function generateCardToken(): string {
  const bytes = new Uint8Array(20) // 160-bit
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
