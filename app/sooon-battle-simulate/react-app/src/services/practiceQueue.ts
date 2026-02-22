import type { QuestionItem } from '../domain/types'
import { getJson, setValue } from './storage'

interface PracticeQueuePayload {
  questions: QuestionItem[]
  createdAt: string
}

interface LastPracticeQueueSessionPayload {
  questions: QuestionItem[]
  cursor: number
  updatedAt: string
}

const PRACTICE_QUEUE_KEY = 'sooon-practice-queue'
const PRACTICE_QUEUE_FALLBACK_KEY = 'sooon-practice-queue-fallback'
const LAST_PRACTICE_QUEUE_SESSION_KEY = 'sooon-last-practice-queue-session'
const PRACTICE_QUEUE_MAX_ITEMS = 500
const PRACTICE_QUEUE_FALLBACK_TTL_MS = 5000
export const MIN_PRACTICE_QUEUE_ITEMS = 5

function isValidQuestionItem(value: unknown): value is QuestionItem {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<QuestionItem>
  return (
    typeof row.question === 'string' &&
    row.question.length > 0 &&
    Array.isArray(row.options) &&
    row.options.length === 4 &&
    row.options.every((option) => typeof option === 'string') &&
    Number.isInteger(row.answer) &&
    Number(row.answer) >= 0 &&
    Number(row.answer) <= 3
  )
}

export function savePracticeQueue(questions: QuestionItem[]): number {
  const normalized = questions.filter(isValidQuestionItem).slice(0, PRACTICE_QUEUE_MAX_ITEMS)
  const payload: PracticeQueuePayload = {
    questions: normalized,
    createdAt: new Date().toISOString(),
  }
  setValue(PRACTICE_QUEUE_KEY, payload)
  saveLastPracticeQueueSession(normalized, 0)
  return normalized.length
}

export function consumePracticeQueue(): QuestionItem[] {
  const payload = getJson<Partial<PracticeQueuePayload>>(PRACTICE_QUEUE_KEY, {})

  if (Array.isArray(payload.questions)) {
    try {
      localStorage.removeItem(PRACTICE_QUEUE_KEY)
    } catch {
      // no-op
    }

    try {
      sessionStorage.setItem(
        PRACTICE_QUEUE_FALLBACK_KEY,
        JSON.stringify({
          expiresAt: Date.now() + PRACTICE_QUEUE_FALLBACK_TTL_MS,
          payload,
        }),
      )
    } catch {
      // no-op
    }

    return payload.questions.filter(isValidQuestionItem).slice(0, PRACTICE_QUEUE_MAX_ITEMS)
  }

  try {
    const rawFallback = sessionStorage.getItem(PRACTICE_QUEUE_FALLBACK_KEY)
    if (!rawFallback) return []

    const parsed = JSON.parse(rawFallback) as {
      expiresAt?: unknown
      payload?: Partial<PracticeQueuePayload>
    }

    const expiresAt = Number(parsed.expiresAt)
    const fallbackQuestions = parsed.payload?.questions
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt || !Array.isArray(fallbackQuestions)) {
      sessionStorage.removeItem(PRACTICE_QUEUE_FALLBACK_KEY)
      return []
    }

    // One extra read for React StrictMode double-invocation; then clear.
    sessionStorage.removeItem(PRACTICE_QUEUE_FALLBACK_KEY)
    return fallbackQuestions.filter(isValidQuestionItem).slice(0, PRACTICE_QUEUE_MAX_ITEMS)
  } catch {
    return []
  }
}

function normalizeCursor(cursor: number, length: number): number {
  if (!Number.isFinite(cursor) || length <= 0) return 0
  const normalized = Math.floor(cursor) % length
  return normalized >= 0 ? normalized : normalized + length
}

export function saveLastPracticeQueueSession(questions: QuestionItem[], cursor = 0): number {
  const normalized = questions.filter(isValidQuestionItem).slice(0, PRACTICE_QUEUE_MAX_ITEMS)
  if (normalized.length <= 0) {
    try {
      localStorage.removeItem(LAST_PRACTICE_QUEUE_SESSION_KEY)
    } catch {
      // no-op
    }
    return 0
  }

  const payload: LastPracticeQueueSessionPayload = {
    questions: normalized,
    cursor: normalizeCursor(cursor, normalized.length),
    updatedAt: new Date().toISOString(),
  }

  setValue(LAST_PRACTICE_QUEUE_SESSION_KEY, payload)
  return normalized.length
}

export function loadLastPracticeQueueSession(): { questions: QuestionItem[]; cursor: number } | null {
  const payload = getJson<Partial<LastPracticeQueueSessionPayload>>(LAST_PRACTICE_QUEUE_SESSION_KEY, {})
  if (!Array.isArray(payload.questions)) return null

  const questions = payload.questions.filter(isValidQuestionItem).slice(0, PRACTICE_QUEUE_MAX_ITEMS)
  if (questions.length <= 0) return null

  const cursor = normalizeCursor(Number(payload.cursor ?? 0), questions.length)
  return { questions, cursor }
}

export function updateLastPracticeQueueCursor(cursor: number): void {
  const session = loadLastPracticeQueueSession()
  if (!session) return
  saveLastPracticeQueueSession(session.questions, cursor)
}
