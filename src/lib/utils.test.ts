import { describe, expect, it } from 'vitest'
import { brandStyle, cn, maskName } from './utils'

describe('utility helpers', () => {
  it('masks each name part without exposing full PII', () => {
    expect(maskName('Burak Erkemen')).toBe('B**** E******')
    expect(maskName('Ayşe')).toBe('A***')
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
})
