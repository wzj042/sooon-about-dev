// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import { loadPracticeQueueSettings, savePracticeQueueSettings } from './practiceQueueSettings'

describe('practiceQueueSettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads and saves auto unmaster threshold', () => {
    savePracticeQueueSettings({
      optionWrapChars: 18,
      titleSpacingPx: 12,
      titleWrapChars: 10,
      autoMasterWithinSeconds: 6,
      autoUnmasterOverSeconds: 15,
      autoNextDelaySeconds: 3,
      manualNextOnWrong: true,
    })

    expect(loadPracticeQueueSettings()).toEqual({
      optionWrapChars: 18,
      titleSpacingPx: 12,
      titleWrapChars: 10,
      autoMasterWithinSeconds: 6,
      autoUnmasterOverSeconds: 15,
      autoNextDelaySeconds: 3,
      manualNextOnWrong: true,
    })
  })

  it('normalizes invalid auto mastery thresholds to zero', () => {
    localStorage.setItem(
      'sooon-practice-queue-settings',
      JSON.stringify({
        autoMasterWithinSeconds: -5,
        autoUnmasterOverSeconds: 'abc',
        autoNextDelaySeconds: undefined,
        manualNextOnWrong: 'yes',
      }),
    )

    expect(loadPracticeQueueSettings()).toMatchObject({
      autoMasterWithinSeconds: 0,
      autoUnmasterOverSeconds: 0,
      autoNextDelaySeconds: 1,
      manualNextOnWrong: false,
    })
  })
})
