import type { QuestionSelectionStrategy } from '../domain/types'
import { buildQuestionHash, isQuestionHash } from './questionIdentity'
import { getJson, setValue } from './storage'

export interface QuestionStatEntry {
  seenCount: number
  answeredCount: number
  correctCount: number
  wrongCount: number
  totalResponseMs: number
  lastResponseMs: number
  lastAnsweredAt: string
  mastered: boolean
  updatedAt: string
}

export interface QuestionStatsSummary {
  answeredUniqueQuestions: number
  seenUniqueQuestions: number
  totalAttempts: number
  totalCorrectCount: number
  totalWrongCount: number
  averageResponseMs: number
}

export type QuestionStatsMap = Record<string, QuestionStatEntry>
export type DailyQuestionStatsMap = Record<string, number>

export interface RecordQuestionAttemptParams {
  question: string
  answered: boolean
  correct: boolean
  responseMs: number
}

const QUESTION_STATS_STORAGE_KEY = 'sooon-question-stats'
const QUESTION_STATS_CHANGED_EVENT = 'sooon-question-stats-changed'
const QUESTION_DAILY_STATS_STORAGE_KEY = 'sooon-question-daily-stats'

export const STATS_BASED_STRATEGIES: QuestionSelectionStrategy[] = [
  'unseen_first',
  'mistake_focused',
  'slow_thinking_focused',
  'common_sense_only',
  'ethics_only',
  'unmastered_only',
  'mastered_only',
]

function normalizeStatEntry(raw: Partial<QuestionStatEntry> | null | undefined): QuestionStatEntry {
  const seenCount = Number(raw?.seenCount ?? 0)
  const answeredCount = Number(raw?.answeredCount ?? 0)
  const correctCount = Number(raw?.correctCount ?? 0)
  const wrongCount = Number(raw?.wrongCount ?? 0)
  const totalResponseMs = Number(raw?.totalResponseMs ?? 0)
  const lastResponseMs = Number(raw?.lastResponseMs ?? 0)

  return {
    seenCount: Number.isFinite(seenCount) ? Math.max(0, Math.floor(seenCount)) : 0,
    answeredCount: Number.isFinite(answeredCount) ? Math.max(0, Math.floor(answeredCount)) : 0,
    correctCount: Number.isFinite(correctCount) ? Math.max(0, Math.floor(correctCount)) : 0,
    wrongCount: Number.isFinite(wrongCount) ? Math.max(0, Math.floor(wrongCount)) : 0,
    totalResponseMs: Number.isFinite(totalResponseMs) ? Math.max(0, Math.floor(totalResponseMs)) : 0,
    lastResponseMs: Number.isFinite(lastResponseMs) ? Math.max(0, Math.floor(lastResponseMs)) : 0,
    lastAnsweredAt: typeof raw?.lastAnsweredAt === 'string' ? raw.lastAnsweredAt : '',
    mastered: raw?.mastered === true,
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : '',
  }
}

function getStatsStorageKey(question: string): string {
  return buildQuestionHash(question)
}

function emitQuestionStatsChanged(): void {
  window.dispatchEvent(new Event(QUESTION_STATS_CHANGED_EVENT))
}

function writeQuestionStatsMap(map: QuestionStatsMap, emitChanged: boolean): void {
  setValue(QUESTION_STATS_STORAGE_KEY, map)
  if (emitChanged) {
    emitQuestionStatsChanged()
  }
}

export function loadQuestionStatsMap(): QuestionStatsMap {
  const raw = getJson<Record<string, Partial<QuestionStatEntry> & { question?: unknown }>>(QUESTION_STATS_STORAGE_KEY, {})
  const normalized: QuestionStatsMap = {}
  let shouldMigrate = false

  for (const [storedKey, entry] of Object.entries(raw)) {
    const legacyQuestion = typeof entry?.question === 'string' ? entry.question.trim() : ''
    const normalizedStoredKey = storedKey.trim()
    const normalizedKey = legacyQuestion.length > 0 ? getStatsStorageKey(legacyQuestion) : isQuestionHash(normalizedStoredKey) ? normalizedStoredKey : getStatsStorageKey(normalizedStoredKey)
    if (normalizedKey.length === 0) continue
    if (legacyQuestion.length > 0 || normalizedStoredKey !== normalizedKey) {
      shouldMigrate = true
    }

    const previous = normalized[normalizedKey]
    const nextEntry = normalizeStatEntry(entry)

    if (!previous) {
      normalized[normalizedKey] = nextEntry
      continue
    }

    const nextIsNewer = nextEntry.updatedAt >= previous.updatedAt
    const nextAnsweredLater = nextEntry.lastAnsweredAt >= previous.lastAnsweredAt

    normalized[normalizedKey] = {
      seenCount: previous.seenCount + nextEntry.seenCount,
      answeredCount: previous.answeredCount + nextEntry.answeredCount,
      correctCount: previous.correctCount + nextEntry.correctCount,
      wrongCount: previous.wrongCount + nextEntry.wrongCount,
      totalResponseMs: previous.totalResponseMs + nextEntry.totalResponseMs,
      lastResponseMs: nextAnsweredLater ? nextEntry.lastResponseMs : previous.lastResponseMs,
      lastAnsweredAt: nextAnsweredLater ? nextEntry.lastAnsweredAt : previous.lastAnsweredAt,
      mastered: nextIsNewer ? nextEntry.mastered : previous.mastered,
      updatedAt: nextIsNewer ? nextEntry.updatedAt : previous.updatedAt,
    }
  }

  if (shouldMigrate) {
    writeQuestionStatsMap(normalized, false)
  }

  return normalized
}

export function loadDailyQuestionStatsMap(): DailyQuestionStatsMap {
  const raw = getJson<Record<string, unknown>>(QUESTION_DAILY_STATS_STORAGE_KEY, {})
  const normalized: DailyQuestionStatsMap = {}

  for (const [dateKey, value] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue
    const count = Number(value)
    if (!Number.isFinite(count)) continue
    normalized[dateKey] = Math.max(0, Math.floor(count))
  }

  return normalized
}

export function saveDailyQuestionStatsMap(map: DailyQuestionStatsMap): void {
  setValue(QUESTION_DAILY_STATS_STORAGE_KEY, map)
}

export function saveQuestionStatsMap(map: QuestionStatsMap): void {
  writeQuestionStatsMap(map, true)
}

export function clearQuestionHistory(): void {
  try {
    localStorage.removeItem(QUESTION_STATS_STORAGE_KEY)
    localStorage.removeItem(QUESTION_DAILY_STATS_STORAGE_KEY)
  } catch {
    // Ignore storage errors and still notify listeners.
  }

  emitQuestionStatsChanged()
}

export function subscribeQuestionStats(handler: () => void): () => void {
  window.addEventListener(QUESTION_STATS_CHANGED_EVENT, handler)
  return () => {
    window.removeEventListener(QUESTION_STATS_CHANGED_EVENT, handler)
  }
}

export function getQuestionStat(question: string, map: QuestionStatsMap): QuestionStatEntry | null {
  const storageKey = getStatsStorageKey(question.trim())
  if (storageKey.length === 0) return null
  return map[storageKey] ?? null
}

export function recordQuestionAttempt(params: RecordQuestionAttemptParams): void {
  const question = params.question.trim()
  if (question.length === 0) return

  const answered = params.answered === true
  if (!answered) return

  const map = loadQuestionStatsMap()
  const storageKey = getStatsStorageKey(question)
  if (storageKey.length === 0) return

  const previous = map[storageKey] ?? normalizeStatEntry(null)

  const correct = params.correct === true
  const responseMs = Number.isFinite(params.responseMs) ? Math.max(0, Math.floor(params.responseMs)) : 0
  const now = new Date().toISOString()

  map[storageKey] = {
    seenCount: previous.seenCount + 1,
    answeredCount: previous.answeredCount + 1,
    correctCount: previous.correctCount + (correct ? 1 : 0),
    wrongCount: previous.wrongCount + (!correct ? 1 : 0),
    totalResponseMs: previous.totalResponseMs + responseMs,
    lastResponseMs: responseMs,
    lastAnsweredAt: now,
    mastered: previous.mastered,
    updatedAt: now,
  }

  const dailyMap = loadDailyQuestionStatsMap()
  const today = new Date().toISOString().slice(0, 10)
  dailyMap[today] = Math.max(0, Math.floor((dailyMap[today] ?? 0) + 1))
  saveDailyQuestionStatsMap(dailyMap)

  saveQuestionStatsMap(map)
}

export function averageResponseMs(entry: QuestionStatEntry | null): number {
  if (!entry || entry.answeredCount <= 0) return 0
  return entry.totalResponseMs / entry.answeredCount
}

export function setQuestionMastered(question: string, mastered: boolean): void {
  const normalizedQuestion = question.trim()
  if (normalizedQuestion.length === 0) return

  const map = loadQuestionStatsMap()
  const storageKey = getStatsStorageKey(normalizedQuestion)
  if (storageKey.length === 0) return

  const previous = map[storageKey] ?? normalizeStatEntry(null)
  map[storageKey] = {
    ...previous,
    mastered,
    updatedAt: new Date().toISOString(),
  }
  saveQuestionStatsMap(map)
}

export function getQuestionStatsSummary(map: QuestionStatsMap): QuestionStatsSummary {
  let seenUniqueQuestions = 0
  let answeredUniqueQuestions = 0
  let totalAttempts = 0
  let totalCorrectCount = 0
  let totalWrongCount = 0
  let totalResponseMs = 0

  for (const entry of Object.values(map)) {
    if (entry.seenCount > 0) seenUniqueQuestions += 1
    if (entry.answeredCount > 0) answeredUniqueQuestions += 1
    totalAttempts += entry.answeredCount
    totalCorrectCount += entry.correctCount
    totalWrongCount += entry.wrongCount
    totalResponseMs += entry.totalResponseMs
  }

  return {
    seenUniqueQuestions,
    answeredUniqueQuestions,
    totalAttempts,
    totalCorrectCount,
    totalWrongCount,
    averageResponseMs: totalAttempts > 0 ? totalResponseMs / totalAttempts : 0,
  }
}

function normalizeQuestionType(type?: string): string {
  return typeof type === 'string' ? type.trim() : ''
}

export function isEthicsType(type?: string): boolean {
  const normalized = normalizeQuestionType(type).toLowerCase()
  return normalized === 'sooon_ai' || normalized === 'ethics' || normalized === '素问' || normalized === '伦理'
}

export function isCommonSenseType(type?: string): boolean {
  const normalized = normalizeQuestionType(type)
  if (normalized.length === 0) return false
  if (normalized === '素问') return false
  return !isEthicsType(normalized)
}
