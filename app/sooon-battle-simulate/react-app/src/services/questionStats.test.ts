import { describe, expect, it } from 'vitest'

import { isEthicsType } from './questionStats'

describe('questionStats type matching', () => {
  it('matches only sooon_ai as ethics type', () => {
    expect(isEthicsType('sooon_ai')).toBe(true)
    expect(isEthicsType('  SOOON_AI  ')).toBe(true)
  })

  it('does not match non-sooon_ai labels', () => {
    expect(isEthicsType('ethics')).toBe(false)
    expect(isEthicsType('\u4f26\u7406')).toBe(false)
    expect(isEthicsType('common_sense')).toBe(false)
    expect(isEthicsType('science')).toBe(false)
    expect(isEthicsType(undefined)).toBe(false)
  })
})
