import { describe, expect, it } from 'vitest'

import { isCommonSenseType, isEthicsType } from './questionStats'

describe('questionStats type matching', () => {
  it('matches ethics labels', () => {
    expect(isEthicsType('sooon_ai')).toBe(true)
    expect(isEthicsType('  SOOON_AI  ')).toBe(true)
    expect(isEthicsType('ethics')).toBe(true)
    expect(isEthicsType('素问')).toBe(true)
    expect(isEthicsType('伦理')).toBe(true)
  })

  it('does not match non-ethics labels', () => {
    expect(isEthicsType('common_sense')).toBe(false)
    expect(isEthicsType('science')).toBe(false)
    expect(isEthicsType(undefined)).toBe(false)
  })

  it('treats any non-suwen, non-ethics typed question as common sense', () => {
    expect(isCommonSenseType('常识')).toBe(true)
    expect(isCommonSenseType('化学')).toBe(true)
    expect(isCommonSenseType('素问')).toBe(false)
    expect(isCommonSenseType('伦理')).toBe(false)
    expect(isCommonSenseType(undefined)).toBe(false)
  })
})
