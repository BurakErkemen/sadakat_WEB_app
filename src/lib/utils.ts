import type { CSSProperties } from 'react'

/**
 * İki renk varsa linear-gradient, tek renkte solid backgroundColor döndürür.
 * Açı parametresi opsiyonel, varsayılan 135deg.
 */
export function brandStyle(
  color1: string,
  color2?: string | null,
  angleDeg = 135,
): CSSProperties {
  if (color2 && color2.trim() && color2 !== color1) {
    return { background: `linear-gradient(${angleDeg}deg, ${color1}, ${color2})` }
  }
  return { backgroundColor: color1 }
}

// Ad maskeleme (SPEC §13.1, D-021): her kelime baş harf + yıldız — "Burak Erkemen" → "B**** E******"
// Tek kelimelik isimler de maskelenir; tam ad public dokümana asla açık yazılmaz.
export function maskName(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const chars = Array.from(word) // surrogate-pair güvenli ilk karakter
      return chars[0] + '*'.repeat(Math.max(1, chars.length - 1))
    })
    .join(' ')
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

// Hex rengin algısal parlaklığı — açık marka renklerinde koyu metin seçmek için
export function isLightColor(hex?: string): boolean {
  if (!hex) return false
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (full.length !== 6) return false
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return false
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.72
}

// Marka zemini üzerinde okunur metin/detay sınıfları (koyu zemin → beyaz, açık zemin → koyu)
export function onBrandClasses(color1?: string, color2?: string) {
  const light = isLightColor(color1) && (!color2 || isLightColor(color2))
  return light
    ? {
        text: 'text-gray-900', sub: 'text-gray-700', faint: 'text-gray-600',
        chip: 'bg-black/10', stampOn: 'bg-gray-900 text-white', stampOff: 'bg-black/5 border-black/20',
        bar: 'bg-black/10', barFill: 'bg-gray-900',
      }
    : {
        text: 'text-white', sub: 'text-white/75', faint: 'text-white/60',
        chip: 'bg-white/25', stampOn: 'bg-white text-gray-800', stampOff: 'bg-white/15 border-white/30',
        bar: 'bg-white/20', barFill: 'bg-white/90',
      }
}
