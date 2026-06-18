import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone } from './phone'

describe('phone helpers', () => {
  it('normalizes Turkish mobile numbers from common formats', () => {
    expect(normalizePhone('0532 123 45 67')).toBe('5321234567')
    expect(normalizePhone('+90 532 123 45 67')).toBe('5321234567')
    expect(normalizePhone('905321234567')).toBe('5321234567')
  })

  it('keeps non-standard digit lengths available for validation by callers', () => {
    expect(normalizePhone('123')).toBe('123')
    expect(normalizePhone('+1 (555) 111-2222')).toBe('15551112222')
  })

  it('formats normalized 10-digit numbers for display', () => {
    expect(formatPhone('5321234567')).toBe('0532 123 45 67')
    expect(formatPhone('123')).toBe('123')
  })
})
