// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import { buildQuestionHash, isQuestionHash } from './questionIdentity'
import { getQuestionStat, isCommonSenseType, isEthicsType, loadQuestionStatsMap, recordQuestionAttempt, setQuestionMastered } from './questionStats'

const QUESTION_STATS_STORAGE_KEY = 'sooon-question-stats'

describe('questionStats type matching', () => {
  it('matches ethics labels', () => {
    expect(isEthicsType('sooon_ai')).toBe(true)
    expect(isEthicsType('  SOOON_AI  ')).toBe(true)
    expect(isEthicsType('ethics')).toBe(true)
  })

  it('does not match non-ethics labels', () => {
    expect(isEthicsType('common_sense')).toBe(false)
    expect(isEthicsType('science')).toBe(false)
    expect(isEthicsType(undefined)).toBe(false)
  })

  it('treats any non-suwen, non-ethics typed question as common sense', () => {
    expect(isCommonSenseType('甯歌瘑')).toBe(true)
    expect(isCommonSenseType('鍖栧')).toBe(true)
    expect(isCommonSenseType(undefined)).toBe(false)
  })
})

describe('questionStats storage migration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates legacy full-question keys to hash keys on read', () => {
    localStorage.setItem(
      QUESTION_STATS_STORAGE_KEY,
      JSON.stringify({
        '这是一道旧题目': {
          question: '这是一道旧题目',
          seenCount: 3,
          answeredCount: 2,
          correctCount: 1,
          wrongCount: 1,
          totalResponseMs: 1800,
          lastResponseMs: 900,
          lastAnsweredAt: '2026-05-01T10:00:00.000Z',
          mastered: false,
          updatedAt: '2026-05-01T10:00:00.000Z',
        },
      }),
    )

    const map = loadQuestionStatsMap()
    const hash = buildQuestionHash('这是一道旧题目')

    expect(isQuestionHash(hash)).toBe(true)
    expect(Object.keys(map)).toEqual([hash])
    expect(getQuestionStat('这是一道旧题目', map)?.answeredCount).toBe(2)

    const stored = JSON.parse(localStorage.getItem(QUESTION_STATS_STORAGE_KEY) ?? '{}') as Record<string, unknown>
    expect(Object.keys(stored)).toEqual([hash])
    expect(stored[hash]).not.toBeNull()
  })

  it('reads new hash storage and writes follow-up updates without question duplication', () => {
    recordQuestionAttempt({
      question: '新的题目',
      answered: true,
      correct: true,
      responseMs: 1200,
    })
    setQuestionMastered('新的题目', true)

    const map = loadQuestionStatsMap()
    const hash = buildQuestionHash('新的题目')
    const entry = getQuestionStat('新的题目', map)

    expect(Object.keys(map)).toEqual([hash])
    expect(entry?.correctCount).toBe(1)
    expect(entry?.mastered).toBe(true)

    const stored = JSON.parse(localStorage.getItem(QUESTION_STATS_STORAGE_KEY) ?? '{}') as Record<string, { question?: string }>
    expect(stored[hash]?.question).toBeUndefined()
  })
})
