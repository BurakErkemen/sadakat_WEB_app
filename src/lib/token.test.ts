import { describe, expect, it } from 'vitest'
import { generateCardToken } from './token'

describe('generateCardToken', () => {
  it('generates a 160-bit hex token', () => {
    const token = generateCardToken()

    expect(token).toMatch(/^[a-f0-9]{40}$/)
  })

  it('does not return the same token repeatedly', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateCardToken()))

    expect(tokens.size).toBe(20)
  })
})
