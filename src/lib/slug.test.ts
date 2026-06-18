import { describe, expect, it } from 'vitest'
import { isValidSlug, toSlug } from './slug'

describe('slug helpers', () => {
  it('creates lowercase URL-safe slugs', () => {
    expect(toSlug('Sadex Demo Cafe 2026!')).toBe('sadex-demo-cafe-2026')
    expect(toSlug('  Çok   Boşluklu---İsim  ')).toBe('cok-bosluklu-isim')
  })

  it('limits slugs to 50 characters', () => {
    expect(toSlug('a'.repeat(80))).toHaveLength(50)
  })

  it('validates slug boundaries and characters', () => {
    expect(isValidSlug('sadex-demo')).toBe(true)
    expect(isValidSlug('s12')).toBe(true)
    expect(isValidSlug('-sadex')).toBe(false)
    expect(isValidSlug('sadex-')).toBe(false)
    expect(isValidSlug('sadex_demo')).toBe(false)
    expect(isValidSlug('s')).toBe(false)
  })
})
