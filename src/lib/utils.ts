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

// Ad maskeleme: "Burak Erkemen" → "B**** E******"
export function maskName(fullName: string): string {
  return fullName
    .split(' ')
    .map((word) => (word.length > 0 ? word[0] + '*'.repeat(Math.max(0, word.length - 1)) : ''))
    .join(' ')
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
