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
