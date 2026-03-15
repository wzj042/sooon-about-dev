// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import { advanceLastPracticeQueueProgress, clearPracticeQueueSession, consumePracticeQueue, loadLastPracticeQueueSession, savePracticeQueue } from './practiceQueue'

function buildQuestion(index: number) {
  return {
    question: `q-${index}`,
    options: [`A-${index}`, `B-${index}`, `C-${index}`, `D-${index}`],
    answer: 0,
  }
}

describe('practiceQueue capacity', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('preserves large queue sizes instead of truncating to 500', () => {
    const total = 3400
    const questions = Array.from({ length: total }, (_, index) => buildQuestion(index))

    const saved = savePracticeQueue(questions)
    const consumed = consumePracticeQueue()

    expect(saved).toBe(total)
    expect(consumed).toHaveLength(total)
  })

  it('tracks practiced progress separately from cursor rotation', () => {
    const questions = Array.from({ length: 10 }, (_, index) => buildQuestion(index))
    savePracticeQueue(questions)
    consumePracticeQueue()

    advanceLastPracticeQueueProgress(4)
    let session = loadLastPracticeQueueSession()
    expect(session).not.toBeNull()
    expect(session?.cursor).toBe(4)
    expect(session?.practicedCount).toBe(4)

    advanceLastPracticeQueueProgress(9)
    session = loadLastPracticeQueueSession()
    expect(session).not.toBeNull()
    expect(session?.cursor).toBe(3)
    expect(session?.practicedCount).toBe(13)
  })

  it('clears pending queue, fallback queue, and last session together', () => {
    const questions = Array.from({ length: 3 }, (_, index) => buildQuestion(index))
    savePracticeQueue(questions)
    consumePracticeQueue()

    expect(loadLastPracticeQueueSession()).not.toBeNull()
    expect(sessionStorage.getItem('sooon-practice-queue-fallback')).not.toBeNull()

    clearPracticeQueueSession()

    expect(loadLastPracticeQueueSession()).toBeNull()
    expect(localStorage.getItem('sooon-practice-queue')).toBeNull()
    expect(sessionStorage.getItem('sooon-practice-queue-fallback')).toBeNull()
  })
})
