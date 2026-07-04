import { describe, expect, it } from 'vitest'
import { brandStyle, cn, isLightColor, maskName } from './utils'

describe('utility helpers', () => {
  it('masks every word to first letter + stars (no full-name PII)', () => {
    expect(maskName('Burak Erkemen')).toBe('B**** E******')
    expect(maskName('Ayşe')).toBe('A***')
    expect(maskName('Ali Veli Can')).toBe('A** V*** C**')
    expect(maskName('  Burak   Erkemen  ')).toBe('B**** E******')
    expect(maskName('O')).toBe('O*')
    expect(maskName('')).toBe('')
  })

  it('builds either solid or gradient brand styles', () => {
    expect(brandStyle('#111111')).toEqual({ backgroundColor: '#111111' })
    expect(brandStyle('#111111', '#222222', 90)).toEqual({
      background: 'linear-gradient(90deg, #111111, #222222)',
    })
    expect(brandStyle('#111111', '#111111')).toEqual({ backgroundColor: '#111111' })
  })

  it('joins truthy class names only', () => {
    expect(cn('base', false, null, undefined, 'active')).toBe('base active')
  })

  it('detects light brand colors for contrast handling', () => {
    expect(isLightColor('#ffffff')).toBe(true)
    expect(isLightColor('#ffeb3b')).toBe(true)   // açık sarı
    expect(isLightColor('#fff')).toBe(true)      // kısa hex
    expect(isLightColor('#000000')).toBe(false)
    expect(isLightColor('#6366f1')).toBe(false)  // indigo (varsayılan)
    expect(isLightColor(undefined)).toBe(false)
    expect(isLightColor('gecersiz')).toBe(false)
  })
})
