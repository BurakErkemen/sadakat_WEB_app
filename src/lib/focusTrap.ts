// Basit focus trap: Tab/Shift+Tab ile klavye odağını dialog içinde tutar.
// Modal/bottom-sheet'lerin keydown handler'ından çağrılır.
export function trapTabKey(root: HTMLElement | null, e: KeyboardEvent): void {
  if (e.key !== 'Tab' || !root) return
  const focusables = root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )
  if (focusables.length === 0) { e.preventDefault(); return }
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement

  if (!(active instanceof HTMLElement) || !root.contains(active)) {
    e.preventDefault()
    first.focus()
    return
  }
  if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}
