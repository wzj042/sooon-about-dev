import type { QuestionItem } from '../domain/types'
import { buildQuestionHash } from './questionIdentity'
import { loadCachedQuestionBank, loadQuestionBank } from './questionBank'
import { getJson, setValue } from './storage'

interface PracticeQueueQuestionRef {
  questionHash?: string
  question?: string
  sourceId?: string
  updatedAt?: string
}

interface PracticeQueuePayload {
  version?: number
  refs?: PracticeQueueQuestionRef[]
  questions?: QuestionItem[]
  createdAt?: string
}

interface LastPracticeQueueSessionPayload {
  version?: number
  refs?: PracticeQueueQuestionRef[]
  questions?: QuestionItem[]
  cursor?: number
  practicedCount?: number
  updatedAt?: string
}

export interface LastPracticeQueueSessionSummary {
  count: number
  cursor: number
  practicedCount: number
}

const PRACTICE_QUEUE_KEY = 'sooon-practice-queue'
const PRACTICE_QUEUE_FALLBACK_KEY = 'sooon-practice-queue-fallback'
const LAST_PRACTICE_QUEUE_SESSION_KEY = 'sooon-last-practice-queue-session'
const PRACTICE_QUEUE_SESSION_CHANGED_EVENT = 'sooon-practice-queue-session-changed'
const PRACTICE_QUEUE_STORAGE_VERSION = 3
// Do not enforce an arbitrary small hard cap (legacy cap was 500).
// Storage limits should be determined by browser capacity instead.
const PRACTICE_QUEUE_MAX_ITEMS = Number.MAX_SAFE_INTEGER
const PRACTICE_QUEUE_FALLBACK_TTL_MS = 5000

function emitPracticeQueueSessionChanged(): void {
  window.dispatchEvent(new Event(PRACTICE_QUEUE_SESSION_CHANGED_EVENT))
}

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

function isPracticeableQuestionItem(value: unknown): value is QuestionItem {
  return isValidQuestionItem(value) && value.deleted !== true
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function isValidQuestionRef(value: unknown): value is PracticeQueueQuestionRef {
  if (!value || typeof value !== 'object') return false
  const ref = value as Partial<PracticeQueueQuestionRef>
  return (
    ((typeof ref.questionHash === 'string' && ref.questionHash.length > 0) || (typeof ref.question === 'string' && ref.question.length > 0)) &&
    (ref.questionHash === undefined || typeof ref.questionHash === 'string') &&
    (ref.question === undefined || typeof ref.question === 'string') &&
    (ref.sourceId === undefined || typeof ref.sourceId === 'string') &&
    (ref.updatedAt === undefined || typeof ref.updatedAt === 'string')
  )
}

function normalizeQuestionRef(value: PracticeQueueQuestionRef): PracticeQueueQuestionRef {
  const questionHash = normalizeOptionalString(value.questionHash)
  const question = normalizeOptionalString(value.question)
  if (!questionHash && !question) {
    return {
      questionHash: '',
    }
  }

  return {
    questionHash: questionHash ?? buildQuestionHash(question ?? ''),
    sourceId: normalizeOptionalString(value.sourceId),
    updatedAt: normalizeOptionalString(value.updatedAt),
  }
}

function normalizeQuestionRefs(value: unknown): PracticeQueueQuestionRef[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isValidQuestionRef)
    .map(normalizeQuestionRef)
    .filter((ref) => typeof ref.questionHash === 'string' && ref.questionHash.length > 0)
    .slice(0, PRACTICE_QUEUE_MAX_ITEMS)
}

function normalizeLegacyQuestions(value: unknown): QuestionItem[] {
  if (!Array.isArray(value)) return []
  return value.filter(isPracticeableQuestionItem).slice(0, PRACTICE_QUEUE_MAX_ITEMS)
}

function normalizeCursor(cursor: number, length: number): number {
  if (!Number.isFinite(cursor) || length <= 0) return 0
  const normalized = Math.floor(cursor) % length
  return normalized >= 0 ? normalized : normalized + length
}

function normalizePracticedCount(practicedCount: number): number {
  if (!Number.isFinite(practicedCount)) return 0
  return Math.max(0, Math.floor(practicedCount))
}

function buildQuestionRef(question: QuestionItem): PracticeQueueQuestionRef {
  return {
    questionHash: buildQuestionHash(question.question),
    sourceId: normalizeOptionalString(question.sourceId),
    updatedAt: normalizeOptionalString(question.updatedAt),
  }
}

function buildPracticeQueuePayload(questions: QuestionItem[]): PracticeQueuePayload {
  return {
    version: PRACTICE_QUEUE_STORAGE_VERSION,
    refs: questions.map(buildQuestionRef),
    createdAt: new Date().toISOString(),
  }
}

function buildLastPracticeQueueSessionPayload(
  questions: QuestionItem[],
  cursor: number,
  practicedCount: number,
): LastPracticeQueueSessionPayload {
  return {
    version: PRACTICE_QUEUE_STORAGE_VERSION,
    refs: questions.map(buildQuestionRef),
    cursor: normalizeCursor(cursor, questions.length),
    practicedCount: normalizePracticedCount(practicedCount),
    updatedAt: new Date().toISOString(),
  }
}

function buildSerializableQueuePayload(payload: Partial<PracticeQueuePayload>): PracticeQueuePayload | null {
  const refs = normalizeQuestionRefs(payload.refs)
  if (refs.length > 0) {
    return {
      version: PRACTICE_QUEUE_STORAGE_VERSION,
      refs,
      createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : new Date().toISOString(),
    }
  }

  const questions = normalizeLegacyQuestions(payload.questions)
  if (questions.length <= 0) return null
  return buildPracticeQueuePayload(questions)
}

function parseLastPracticeQueueSessionSummary(payload: Partial<LastPracticeQueueSessionPayload>): LastPracticeQueueSessionSummary | null {
  const refs = normalizeQuestionRefs(payload.refs)
  if (refs.length > 0) {
    return {
      count: refs.length,
      cursor: normalizeCursor(Number(payload.cursor ?? 0), refs.length),
      practicedCount: normalizePracticedCount(Number(payload.practicedCount ?? payload.cursor ?? 0)),
    }
  }

  const questions = normalizeLegacyQuestions(payload.questions)
  if (questions.length <= 0) return null
  return {
    count: questions.length,
    cursor: normalizeCursor(Number(payload.cursor ?? 0), questions.length),
    practicedCount: normalizePracticedCount(Number(payload.practicedCount ?? payload.cursor ?? 0)),
  }
}

function hasLegacyQuestionRefFields(value: unknown): boolean {
  if (!Array.isArray(value)) return false

  return value.some((item) => {
    if (!item || typeof item !== 'object') return false
    const ref = item as Partial<PracticeQueueQuestionRef>
    return (
      (typeof ref.question === 'string' && ref.question.trim().length > 0) ||
      (typeof ref.questionHash !== 'string' || ref.questionHash.trim().length <= 0)
    )
  })
}

function shouldMigratePracticeQueuePayload(payload: Partial<PracticeQueuePayload>): boolean {
  return payload.version !== PRACTICE_QUEUE_STORAGE_VERSION || hasLegacyQuestionRefFields(payload.refs) || normalizeLegacyQuestions(payload.questions).length > 0
}

function shouldMigrateLastPracticeQueueSessionPayload(payload: Partial<LastPracticeQueueSessionPayload>): boolean {
  return payload.version !== PRACTICE_QUEUE_STORAGE_VERSION || hasLegacyQuestionRefFields(payload.refs) || normalizeLegacyQuestions(payload.questions).length > 0
}

function buildLookupKey(...parts: Array<string | undefined>): string | null {
  const normalized = parts.map((part) => normalizeOptionalString(part))
  if (normalized.some((part) => !part)) return null
  return normalized.join('\u0000')
}

function addLookupEntry(map: Map<string, QuestionItem>, key: string | null, question: QuestionItem): void {
  if (!key || map.has(key)) return
  map.set(key, question)
}

function createQuestionLookup(questions: QuestionItem[]) {
  const byHash = new Map<string, QuestionItem>()
  const bySourceId = new Map<string, QuestionItem>()
  const bySourceIdAndUpdatedAt = new Map<string, QuestionItem>()
  const byQuestion = new Map<string, QuestionItem>()
  const byQuestionAndUpdatedAt = new Map<string, QuestionItem>()

  for (const question of questions.filter(isPracticeableQuestionItem)) {
    addLookupEntry(byHash, buildQuestionHash(question.question), question)
    addLookupEntry(bySourceId, normalizeOptionalString(question.sourceId) ?? null, question)
    addLookupEntry(
      bySourceIdAndUpdatedAt,
      buildLookupKey(question.sourceId, question.updatedAt),
      question,
    )
    addLookupEntry(byQuestion, normalizeOptionalString(question.question) ?? null, question)
    addLookupEntry(
      byQuestionAndUpdatedAt,
      buildLookupKey(question.question, question.updatedAt),
      question,
    )
  }

  return {
    byHash,
    bySourceId,
    bySourceIdAndUpdatedAt,
    byQuestion,
    byQuestionAndUpdatedAt,
  }
}

function resolveQuestionFromLookup(
  ref: PracticeQueueQuestionRef,
  lookup: ReturnType<typeof createQuestionLookup>,
): QuestionItem | null {
  const byHash = ref.questionHash ? lookup.byHash.get(ref.questionHash) : undefined
  if (byHash) return byHash

  const bySourceIdAndUpdatedAt = lookup.bySourceIdAndUpdatedAt.get(buildLookupKey(ref.sourceId, ref.updatedAt) ?? '')
  if (bySourceIdAndUpdatedAt) return bySourceIdAndUpdatedAt

  const bySourceId = ref.sourceId ? lookup.bySourceId.get(ref.sourceId) : undefined
  if (bySourceId) return bySourceId

  const byQuestionAndUpdatedAt = lookup.byQuestionAndUpdatedAt.get(buildLookupKey(ref.question, ref.updatedAt) ?? '')
  if (byQuestionAndUpdatedAt) return byQuestionAndUpdatedAt

  return ref.question ? lookup.byQuestion.get(ref.question) ?? null : null
}

function resolveQuestionRefsFromSource(refs: PracticeQueueQuestionRef[], questions: QuestionItem[]): QuestionItem[] {
  if (refs.length <= 0 || questions.length <= 0) return []
  const lookup = createQuestionLookup(questions)
  return refs
    .map((ref) => resolveQuestionFromLookup(ref, lookup))
    .filter((question): question is QuestionItem => question !== null)
}

async function resolveQuestionRefs(refs: PracticeQueueQuestionRef[]): Promise<QuestionItem[]> {
  if (refs.length <= 0) return []

  const cachedQuestions = await loadCachedQuestionBank()
  const cachedResolved = resolveQuestionRefsFromSource(refs, cachedQuestions)
  if (cachedResolved.length === refs.length) {
    return cachedResolved
  }

  try {
    const remoteQuestions = await loadQuestionBank()
    const mergedQuestions = cachedQuestions.length > 0 ? [...cachedQuestions, ...remoteQuestions] : remoteQuestions
    const resolved = resolveQuestionRefsFromSource(refs, mergedQuestions)
    return resolved.length > 0 ? resolved : cachedResolved
  } catch {
    return cachedResolved
  }
}

function persistPracticeQueueFallback(payload: Partial<PracticeQueuePayload>): void {
  const serializablePayload = buildSerializableQueuePayload(payload)
  if (!serializablePayload) return

  try {
    sessionStorage.setItem(
      PRACTICE_QUEUE_FALLBACK_KEY,
      JSON.stringify({
        expiresAt: Date.now() + PRACTICE_QUEUE_FALLBACK_TTL_MS,
        payload: serializablePayload,
      }),
    )
  } catch {
    // no-op
  }
}

function loadFallbackPracticeQueuePayload(): Partial<PracticeQueuePayload> | null {
  try {
    const rawFallback = sessionStorage.getItem(PRACTICE_QUEUE_FALLBACK_KEY)
    if (!rawFallback) return null

    const parsed = JSON.parse(rawFallback) as {
      expiresAt?: unknown
      payload?: Partial<PracticeQueuePayload>
    }

    const expiresAt = Number(parsed.expiresAt)
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt || !parsed.payload) {
      sessionStorage.removeItem(PRACTICE_QUEUE_FALLBACK_KEY)
      return null
    }

    // One extra read for React StrictMode double-invocation; then clear.
    sessionStorage.removeItem(PRACTICE_QUEUE_FALLBACK_KEY)
    return parsed.payload
  } catch {
    return null
  }
}

export function updateLastPracticeQueueSessionCounts(
  count: number,
  nextCursor: number,
  nextPracticedCount: number,
): void {
  if (count <= 0) return

  const payload = getJson<Partial<LastPracticeQueueSessionPayload>>(LAST_PRACTICE_QUEUE_SESSION_KEY, {})
  const refs = normalizeQuestionRefs(payload.refs)
  if (refs.length > 0) {
    setValue(LAST_PRACTICE_QUEUE_SESSION_KEY, {
      version: PRACTICE_QUEUE_STORAGE_VERSION,
      refs,
      cursor: normalizeCursor(nextCursor, count),
      practicedCount: normalizePracticedCount(nextPracticedCount),
      updatedAt: new Date().toISOString(),
    } satisfies LastPracticeQueueSessionPayload)
    emitPracticeQueueSessionChanged()
    return
  }

  const questions = normalizeLegacyQuestions(payload.questions)
  if (questions.length <= 0) return
  saveLastPracticeQueueSession(questions, nextCursor, nextPracticedCount)
}

export function savePracticeQueue(questions: QuestionItem[]): number {
  const normalized = questions.filter(isPracticeableQuestionItem).slice(0, PRACTICE_QUEUE_MAX_ITEMS)
  const payload = buildPracticeQueuePayload(normalized)
  setValue(PRACTICE_QUEUE_KEY, payload)
  saveLastPracticeQueueSession(normalized, 0)
  return normalized.length
}

export function clearPracticeQueueSession(): void {
  try {
    localStorage.removeItem(PRACTICE_QUEUE_KEY)
    localStorage.removeItem(LAST_PRACTICE_QUEUE_SESSION_KEY)
  } catch {
    // no-op
  }

  try {
    sessionStorage.removeItem(PRACTICE_QUEUE_FALLBACK_KEY)
  } catch {
    // no-op
  }

  emitPracticeQueueSessionChanged()
}

export async function consumePracticeQueue(): Promise<QuestionItem[]> {
  const payload = getJson<Partial<PracticeQueuePayload>>(PRACTICE_QUEUE_KEY, {})
  const refs = normalizeQuestionRefs(payload.refs)
  const legacyQuestions = normalizeLegacyQuestions(payload.questions)

  if (refs.length > 0 || legacyQuestions.length > 0) {
    const migratedPayload = buildSerializableQueuePayload(payload)
    if (migratedPayload && shouldMigratePracticeQueuePayload(payload)) {
      setValue(PRACTICE_QUEUE_KEY, migratedPayload)
    }

    try {
      localStorage.removeItem(PRACTICE_QUEUE_KEY)
    } catch {
      // no-op
    }

    persistPracticeQueueFallback(migratedPayload ?? payload)
    return refs.length > 0 ? resolveQuestionRefs(refs) : legacyQuestions
  }

  const fallbackPayload = loadFallbackPracticeQueuePayload()
  if (!fallbackPayload) return []

  const fallbackRefs = normalizeQuestionRefs(fallbackPayload.refs)
  if (fallbackRefs.length > 0) {
    return resolveQuestionRefs(fallbackRefs)
  }

  return normalizeLegacyQuestions(fallbackPayload.questions)
}

export function saveLastPracticeQueueSession(questions: QuestionItem[], cursor = 0, practicedCount = 0): number {
  const normalized = questions.filter(isPracticeableQuestionItem).slice(0, PRACTICE_QUEUE_MAX_ITEMS)
  if (normalized.length <= 0) {
    try {
      localStorage.removeItem(LAST_PRACTICE_QUEUE_SESSION_KEY)
    } catch {
      // no-op
    }
    emitPracticeQueueSessionChanged()
    return 0
  }

  const payload = buildLastPracticeQueueSessionPayload(normalized, cursor, practicedCount)
  setValue(LAST_PRACTICE_QUEUE_SESSION_KEY, payload)
  emitPracticeQueueSessionChanged()
  return normalized.length
}

export async function loadLastPracticeQueueSession(): Promise<{
  questions: QuestionItem[]
  cursor: number
  practicedCount: number
} | null> {
  const payload = getJson<Partial<LastPracticeQueueSessionPayload>>(LAST_PRACTICE_QUEUE_SESSION_KEY, {})
  const summary = parseLastPracticeQueueSessionSummary(payload)
  if (!summary) return null

  const legacyQuestions = normalizeLegacyQuestions(payload.questions)
  if (legacyQuestions.length > 0) {
    if (shouldMigrateLastPracticeQueueSessionPayload(payload)) {
      setValue(LAST_PRACTICE_QUEUE_SESSION_KEY, buildLastPracticeQueueSessionPayload(legacyQuestions, summary.cursor, summary.practicedCount))
    }

    return {
      questions: legacyQuestions,
      cursor: normalizeCursor(summary.cursor, legacyQuestions.length),
      practicedCount: summary.practicedCount,
    }
  }

  const refs = normalizeQuestionRefs(payload.refs)
  if (refs.length <= 0) return null

  if (shouldMigrateLastPracticeQueueSessionPayload(payload)) {
    setValue(LAST_PRACTICE_QUEUE_SESSION_KEY, {
      version: PRACTICE_QUEUE_STORAGE_VERSION,
      refs,
      cursor: normalizeCursor(summary.cursor, refs.length),
      practicedCount: summary.practicedCount,
      updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date().toISOString(),
    } satisfies LastPracticeQueueSessionPayload)
  }

  const questions = await resolveQuestionRefs(refs)
  if (questions.length <= 0) return null

  return {
    questions,
    cursor: normalizeCursor(summary.cursor, questions.length),
    practicedCount: summary.practicedCount,
  }
}

export function loadLastPracticeQueueSessionSummary(): LastPracticeQueueSessionSummary | null {
  const payload = getJson<Partial<LastPracticeQueueSessionPayload>>(LAST_PRACTICE_QUEUE_SESSION_KEY, {})
  const summary = parseLastPracticeQueueSessionSummary(payload)
  if (!summary) return null

  if (shouldMigrateLastPracticeQueueSessionPayload(payload)) {
    const refs = normalizeQuestionRefs(payload.refs)
    if (refs.length > 0) {
      setValue(LAST_PRACTICE_QUEUE_SESSION_KEY, {
        version: PRACTICE_QUEUE_STORAGE_VERSION,
        refs,
        cursor: normalizeCursor(summary.cursor, refs.length),
        practicedCount: summary.practicedCount,
        updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date().toISOString(),
      } satisfies LastPracticeQueueSessionPayload)
    } else {
      const legacyQuestions = normalizeLegacyQuestions(payload.questions)
      if (legacyQuestions.length > 0) {
        setValue(LAST_PRACTICE_QUEUE_SESSION_KEY, buildLastPracticeQueueSessionPayload(legacyQuestions, summary.cursor, summary.practicedCount))
      }
    }
  }

  return summary
}

export function updateLastPracticeQueueCursor(cursor: number): void {
  const summary = loadLastPracticeQueueSessionSummary()
  if (!summary) return
  updateLastPracticeQueueSessionCounts(summary.count, cursor, summary.practicedCount)
}

export function advanceLastPracticeQueueProgress(delta: number): void {
  const summary = loadLastPracticeQueueSessionSummary()
  if (!summary) return
  const safeDelta = Math.max(0, Math.floor(delta))
  if (safeDelta <= 0) return

  const nextPracticed = summary.practicedCount + safeDelta
  const nextCursor = summary.cursor + safeDelta
  updateLastPracticeQueueSessionCounts(summary.count, nextCursor, nextPracticed)
}

export function subscribePracticeQueueSession(handler: () => void): () => void {
  window.addEventListener(PRACTICE_QUEUE_SESSION_CHANGED_EVENT, handler)
  return () => {
    window.removeEventListener(PRACTICE_QUEUE_SESSION_CHANGED_EVENT, handler)
  }
}
