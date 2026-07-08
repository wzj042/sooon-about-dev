// @vitest-environment jsdom

import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./questionBank', () => ({
  loadCachedQuestionBank: vi.fn(),
  loadQuestionBank: vi.fn(),
}))

import { loadCachedQuestionBank, loadQuestionBank } from './questionBank'
import {
  advanceLastPracticeQueueProgress,
  clearPracticeQueueSession,
  consumePracticeQueue,
  loadLastPracticeQueueSession,
  loadLastPracticeQueueSessionSummary,
  savePracticeQueue,
} from './practiceQueue'
import { clearPendingQueue, loadPendingQueue } from './practiceQueueStorage'

const PRACTICE_QUEUE_KEY = 'sooon-practice-queue'
const PRACTICE_QUEUE_FALLBACK_KEY = 'sooon-practice-queue-fallback'
const LAST_PRACTICE_QUEUE_SESSION_KEY = 'sooon-last-practice-queue-session'

function buildQuestion(index: number) {
  return {
    question: `q-${index}`,
    options: [`A-${index}`, `B-${index}`, `C-${index}`, `D-${index}`],
    answer: 0,
    sourceId: `source-${index}`,
    updatedAt: `2026-05-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
  }
}

describe('practiceQueue storage', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    await clearPendingQueue()
    vi.mocked(loadCachedQuestionBank).mockResolvedValue([])
    vi.mocked(loadQuestionBank).mockResolvedValue([])
  })

  it('persists refs instead of full questions and preserves large queue sizes', async () => {
    const total = 3400
    const questions = Array.from({ length: total }, (_, index) => buildQuestion(index))
    vi.mocked(loadCachedQuestionBank).mockResolvedValue(questions)

    const saved = await savePracticeQueue(questions)
    const savedPayload = await loadPendingQueue()
    const consumed = await consumePracticeQueue()
    const fallbackPayload = JSON.parse(sessionStorage.getItem(PRACTICE_QUEUE_FALLBACK_KEY) ?? '{}') as {
      payload?: { refs?: unknown[]; questions?: unknown[] }
    }

    expect(saved).toBe(total)
    expect(savedPayload?.refs).toHaveLength(total)
    expect(savedPayload?.questions).toBeUndefined()
    expect((savedPayload?.refs?.[0] as { question?: string } | undefined)?.question).toBeUndefined()
    expect(consumed).toHaveLength(total)
    expect(fallbackPayload.payload?.refs).toHaveLength(total)
    expect(fallbackPayload.payload?.questions).toBeUndefined()
  })

  it('drops soft-deleted questions when saving and consuming the queue', async () => {
    const activeQuestions = Array.from({ length: 5 }, (_, index) => buildQuestion(index))
    const deletedQuestion = { ...buildQuestion(99), deleted: true as const }
    const questions = [...activeQuestions, deletedQuestion]
    vi.mocked(loadCachedQuestionBank).mockResolvedValue(activeQuestions)

    const saved = await savePracticeQueue(questions)
    const savedPayload = await loadPendingQueue()
    const consumed = await consumePracticeQueue()

    expect(saved).toBe(activeQuestions.length)
    expect(savedPayload?.refs).toHaveLength(activeQuestions.length)
    expect(consumed).toHaveLength(activeQuestions.length)
  })

  it('resets last session cursor and practiced count when saving a new queue', async () => {
    const oldQueue = Array.from({ length: 3 }, (_, index) => buildQuestion(index))
    const newQueue = Array.from({ length: 4 }, (_, index) => buildQuestion(index + 10))

    vi.mocked(loadCachedQuestionBank).mockResolvedValue(oldQueue)
    await savePracticeQueue(oldQueue)
    advanceLastPracticeQueueProgress(2)

    let session = await loadLastPracticeQueueSession()
    expect(session?.cursor).toBe(2)
    expect(session?.practicedCount).toBe(2)

    vi.mocked(loadCachedQuestionBank).mockResolvedValue(newQueue)
    await savePracticeQueue(newQueue)
    session = await loadLastPracticeQueueSession()
    expect(session?.cursor).toBe(0)
    expect(session?.practicedCount).toBe(0)
  })

  it('tracks practiced progress separately from cursor rotation', async () => {
    const questions = Array.from({ length: 10 }, (_, index) => buildQuestion(index))
    vi.mocked(loadCachedQuestionBank).mockResolvedValue(questions)

    await savePracticeQueue(questions)
    await consumePracticeQueue()

    advanceLastPracticeQueueProgress(4)
    let session = await loadLastPracticeQueueSession()
    expect(session).not.toBeNull()
    expect(session?.cursor).toBe(4)
    expect(session?.practicedCount).toBe(4)

    advanceLastPracticeQueueProgress(9)
    session = await loadLastPracticeQueueSession()
    expect(session).not.toBeNull()
    expect(session?.cursor).toBe(3)
    expect(session?.practicedCount).toBe(13)
  })

  it('clears pending queue, fallback queue, and last session together', async () => {
    const questions = Array.from({ length: 3 }, (_, index) => buildQuestion(index))
    vi.mocked(loadCachedQuestionBank).mockResolvedValue(questions)

    await savePracticeQueue(questions)
    await consumePracticeQueue()

    expect(loadLastPracticeQueueSessionSummary()).not.toBeNull()
    expect(sessionStorage.getItem(PRACTICE_QUEUE_FALLBACK_KEY)).not.toBeNull()

    await clearPracticeQueueSession()

    expect(loadLastPracticeQueueSessionSummary()).toBeNull()
    expect(await loadPendingQueue()).toBeNull()
    expect(sessionStorage.getItem(PRACTICE_QUEUE_KEY)).toBeNull()
    expect(localStorage.getItem(PRACTICE_QUEUE_KEY)).toBeNull()
    expect(sessionStorage.getItem(PRACTICE_QUEUE_FALLBACK_KEY)).toBeNull()
  })

  it('reads legacy full-question payloads for queue and last session', async () => {
    const questions = Array.from({ length: 4 }, (_, index) => buildQuestion(index))

    localStorage.setItem(
      PRACTICE_QUEUE_KEY,
      JSON.stringify({
        questions,
        createdAt: '2026-05-10T00:00:00.000Z',
      }),
    )
    localStorage.setItem(
      LAST_PRACTICE_QUEUE_SESSION_KEY,
      JSON.stringify({
        questions,
        cursor: 2,
        practicedCount: 5,
        updatedAt: '2026-05-10T00:00:00.000Z',
      }),
    )

    const consumed = await consumePracticeQueue()
    const session = await loadLastPracticeQueueSession()
    const migratedSession = JSON.parse(localStorage.getItem(LAST_PRACTICE_QUEUE_SESSION_KEY) ?? '{}') as {
      refs?: unknown[]
      questions?: unknown[]
    }
    const fallbackPayload = JSON.parse(sessionStorage.getItem(PRACTICE_QUEUE_FALLBACK_KEY) ?? '{}') as {
      payload?: { refs?: unknown[]; questions?: unknown[] }
    }

    expect(consumed).toEqual(questions)
    expect(session).not.toBeNull()
    expect(session?.questions).toEqual(questions)
    expect(session?.cursor).toBe(2)
    expect(session?.practicedCount).toBe(5)
    expect(migratedSession.refs).toHaveLength(questions.length)
    expect(migratedSession.questions).toBeUndefined()
    expect(fallbackPayload.payload?.refs).toHaveLength(questions.length)
    expect(fallbackPayload.payload?.questions).toBeUndefined()
  })
})
