import type { QuestionSelectionStrategy } from '../domain/types'
import { getJson, setValue } from './storage'

export interface QuestionStatEntry {
  question: string
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
  'mastered_only',
]

function normalizeStatEntry(question: string, raw: Partial<QuestionStatEntry> | null | undefined): QuestionStatEntry {
  const seenCount = Number(raw?.seenCount ?? 0)
  const answeredCount = Number(raw?.answeredCount ?? 0)
  const correctCount = Number(raw?.correctCount ?? 0)
  const wrongCount = Number(raw?.wrongCount ?? 0)
  const totalResponseMs = Number(raw?.totalResponseMs ?? 0)
  const lastResponseMs = Number(raw?.lastResponseMs ?? 0)

  return {
    question,
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

function emitQuestionStatsChanged(): void {
  window.dispatchEvent(new Event(QUESTION_STATS_CHANGED_EVENT))
}

export function loadQuestionStatsMap(): QuestionStatsMap {
  const raw = getJson<Record<string, Partial<QuestionStatEntry>>>(QUESTION_STATS_STORAGE_KEY, {})
  const normalized: QuestionStatsMap = {}

  for (const [question, entry] of Object.entries(raw)) {
    if (typeof question !== 'string' || question.length === 0) continue
    normalized[question] = normalizeStatEntry(question, entry)
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
  setValue(QUESTION_STATS_STORAGE_KEY, map)
  emitQuestionStatsChanged()
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
  return map[question] ?? null
}

export function recordQuestionAttempt(params: RecordQuestionAttemptParams): void {
  const question = params.question.trim()
  if (question.length === 0) return

  const answered = params.answered === true
  if (!answered) return

  const map = loadQuestionStatsMap()
  const previous = map[question] ?? normalizeStatEntry(question, null)

  const correct = params.correct === true
  const responseMs = Number.isFinite(params.responseMs) ? Math.max(0, Math.floor(params.responseMs)) : 0

  map[question] = {
    question,
    seenCount: previous.seenCount + 1,
    answeredCount: previous.answeredCount + 1,
    correctCount: previous.correctCount + (correct ? 1 : 0),
    wrongCount: previous.wrongCount + (!correct ? 1 : 0),
    totalResponseMs: previous.totalResponseMs + responseMs,
    lastResponseMs: responseMs,
    lastAnsweredAt: new Date().toISOString(),
    mastered: previous.mastered,
    updatedAt: new Date().toISOString(),
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
  const previous = map[normalizedQuestion] ?? normalizeStatEntry(normalizedQuestion, null)
  map[normalizedQuestion] = {
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

export function isEthicsType(type?: string): boolean {
  if (typeof type !== 'string') return false
  return type.trim().toLowerCase() === 'sooon_ai'
}

export function isCommonSenseType(type?: string): boolean {
  if (typeof type !== 'string') return false
  return type.trim().toLowerCase() === 'common_sense'
}

