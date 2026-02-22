import type { QuestionItem } from '../domain/types'
import { normalizePublicAssetUrl, toPublicUrl } from '../utils/publicAsset'

interface RawQuestionPayload {
  options?: unknown
  answer?: unknown
  type?: unknown
  updated_at?: unknown
  updatedAt?: unknown
}

interface RawQuestionArrayPayload {
  question?: unknown
  options?: unknown
  answer?: unknown
  type?: unknown
  updated_at?: unknown
  updatedAt?: unknown
}

interface QuestionPageDescriptor {
  file?: unknown
  count?: unknown
  hash?: unknown
}

interface QuestionBankManifest {
  version?: unknown
  source?: unknown
  total?: unknown
  pageSize?: unknown
  contentHash?: unknown
  pages?: unknown
}

interface ParsedManifestPage {
  file: string
  count?: number
  hash?: string
}

interface ParsedManifest {
  total: number
  pageSize: number
  pages: ParsedManifestPage[]
  signature: string
}

interface QuestionBankCacheSnapshot {
  manifestSignature: string | null
  syncedPages: string[]
  questions: QuestionItem[]
}

interface QuestionBankMetaEntry {
  key: string
  value: unknown
}

const QUESTION_BANK_URL = toPublicUrl('assets/qb.json')
const QUESTION_BANK_MANIFEST_URL = toPublicUrl('assets/qb.manifest.json')
const QUESTION_BANK_PAGE_PREFIX = toPublicUrl('assets/qb-pages/')
const MIN_QUESTION_POOL_SIZE = 80

const QUESTION_BANK_DB_NAME = 'sooon-question-bank'
const QUESTION_BANK_DB_VERSION = 1
const QUESTION_STORE_NAME = 'questions'
const META_STORE_NAME = 'meta'
const META_KEY_MANIFEST_SIGNATURE = 'manifestSignature'
const META_KEY_SYNCED_PAGES = 'syncedPages'
const LOCAL_MANIFEST_SIGNATURE_KEY = 'sooon-question-bank-manifest-signature'

let questionBankDbPromise: Promise<IDBDatabase> | null = null
let pageSyncPromise: Promise<void> | null = null
let pageSyncSignature: string | null = null

function isValidQuestion(item: QuestionItem): boolean {
  return (
    typeof item.question === 'string' &&
    item.question.length > 0 &&
    Array.isArray(item.options) &&
    item.options.length === 4 &&
    item.options.every((option) => typeof option === 'string') &&
    Number.isInteger(item.answer) &&
    item.answer >= 0 &&
    item.answer <= 3
  )
}

function normalizeQuestion(question: string, raw: RawQuestionPayload): QuestionItem {
  const options = Array.isArray(raw.options) ? raw.options.filter((value) => typeof value === 'string').slice(0, 4) : []
  const answer = Number(raw.answer ?? 0)
  const updatedAtRaw = typeof raw.updated_at === 'string' ? raw.updated_at : typeof raw.updatedAt === 'string' ? raw.updatedAt : null
  const updatedAt = typeof updatedAtRaw === 'string' ? updatedAtRaw.trim() : ''

  return {
    question,
    options,
    answer,
    type: typeof raw.type === 'string' ? raw.type : undefined,
    updatedAt: updatedAt.length > 0 ? updatedAt : undefined,
  }
}

function parseObjectPayload(payload: Record<string, RawQuestionPayload>): QuestionItem[] {
  return Object.entries(payload)
    .map(([question, raw]) => normalizeQuestion(question, raw))
    .filter(isValidQuestion)
}

function parseArrayPayload(payload: RawQuestionArrayPayload[]): QuestionItem[] {
  return payload
    .map((raw) =>
      normalizeQuestion(typeof raw.question === 'string' ? raw.question : '', {
        options: raw.options,
        answer: raw.answer,
        type: raw.type,
        updated_at: raw.updated_at,
        updatedAt: raw.updatedAt,
      }),
    )
    .filter(isValidQuestion)
}

function parseQuestionPayload(payload: unknown): QuestionItem[] {
  if (Array.isArray(payload)) {
    return parseArrayPayload(payload as RawQuestionArrayPayload[])
  }

  if (payload && typeof payload === 'object') {
    return parseObjectPayload(payload as Record<string, RawQuestionPayload>)
  }

  return []
}

function resolvePageUrl(file: string): string {
  if (file.startsWith('/')) return normalizePublicAssetUrl(file)
  return `${QUESTION_BANK_PAGE_PREFIX}${file.replace(/^\/+/, '')}`
}

function isValidManifestPage(value: unknown): value is QuestionPageDescriptor {
  if (!value || typeof value !== 'object') return false
  const page = value as QuestionPageDescriptor

  return (
    typeof page.file === 'string' &&
    page.file.length > 0 &&
    (page.count === undefined || typeof page.count === 'number') &&
    (page.hash === undefined || typeof page.hash === 'string')
  )
}

function buildManifestSignature(manifest: QuestionBankManifest, pages: ParsedManifestPage[]): string {
  return JSON.stringify({
    version: typeof manifest.version === 'number' ? manifest.version : null,
    source: typeof manifest.source === 'string' ? manifest.source : null,
    total: typeof manifest.total === 'number' ? manifest.total : 0,
    pageSize: typeof manifest.pageSize === 'number' ? manifest.pageSize : 0,
    contentHash: typeof manifest.contentHash === 'string' ? manifest.contentHash : null,
    pages: pages.map((page) => ({
      file: page.file,
      count: typeof page.count === 'number' ? page.count : null,
      hash: typeof page.hash === 'string' ? page.hash : null,
    })),
  })
}

function parseManifest(payload: unknown): ParsedManifest | null {
  if (!payload || typeof payload !== 'object') return null

  const manifest = payload as QuestionBankManifest
  if (!Array.isArray(manifest.pages) || manifest.pages.length === 0) return null

  const pages = manifest.pages.filter(isValidManifestPage).map((page) => ({
    file: page.file as string,
    count: typeof page.count === 'number' ? page.count : undefined,
    hash: typeof page.hash === 'string' ? page.hash : undefined,
  }))

  if (pages.length === 0) return null

  return {
    total: typeof manifest.total === 'number' ? manifest.total : 0,
    pageSize: typeof manifest.pageSize === 'number' ? manifest.pageSize : 0,
    pages,
    signature: buildManifestSignature(manifest, pages),
  }
}

async function fetchQuestionPayload(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    throw new Error(`Failed to load question bank: ${response.status}`)
  }

  return response.json()
}

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function uniqueStringArray(values: string[]): string[] {
  return Array.from(new Set(values))
}

function createEmptySnapshot(): QuestionBankCacheSnapshot {
  return {
    manifestSignature: null,
    syncedPages: [],
    questions: [],
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed'))
    }
  })
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function openQuestionBankDb(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available'))
  }

  if (questionBankDbPromise) {
    return questionBankDbPromise
  }

  questionBankDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(QUESTION_BANK_DB_NAME, QUESTION_BANK_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(QUESTION_STORE_NAME)) {
        db.createObjectStore(QUESTION_STORE_NAME, { keyPath: 'question' })
      }
      if (!db.objectStoreNames.contains(META_STORE_NAME)) {
        db.createObjectStore(META_STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
      }
      resolve(db)
    }

    request.onerror = () => {
      questionBankDbPromise = null
      reject(request.error ?? new Error('Failed to open IndexedDB'))
    }

    request.onblocked = () => {
      questionBankDbPromise = null
      reject(new Error('IndexedDB open blocked'))
    }
  })

  return questionBankDbPromise
}

function metaEntriesToMap(entries: unknown[]): Map<string, unknown> {
  const map = new Map<string, unknown>()
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const typed = entry as QuestionBankMetaEntry
    if (typeof typed.key !== 'string') continue
    map.set(typed.key, typed.value)
  }
  return map
}

function getMetaString(map: Map<string, unknown>, key: string): string | null {
  const value = map.get(key)
  return typeof value === 'string' && value.length > 0 ? value : null
}

function getMetaStringArray(map: Map<string, unknown>, key: string): string[] {
  const value = map.get(key)
  if (!Array.isArray(value)) return []
  return uniqueStringArray(value.filter((item): item is string => typeof item === 'string' && item.length > 0))
}

async function readCacheSnapshotFromDb(): Promise<QuestionBankCacheSnapshot> {
  const db = await openQuestionBankDb()
  const transaction = db.transaction([QUESTION_STORE_NAME, META_STORE_NAME], 'readonly')

  const questionRequest = transaction.objectStore(QUESTION_STORE_NAME).getAll() as IDBRequest<unknown[]>
  const metaRequest = transaction.objectStore(META_STORE_NAME).getAll() as IDBRequest<unknown[]>

  const [questionRows, metaRows] = await Promise.all([requestToPromise(questionRequest), requestToPromise(metaRequest)])
  await transactionToPromise(transaction)

  const metaMap = metaEntriesToMap(Array.isArray(metaRows) ? metaRows : [])

  return {
    manifestSignature: getMetaString(metaMap, META_KEY_MANIFEST_SIGNATURE),
    syncedPages: getMetaStringArray(metaMap, META_KEY_SYNCED_PAGES),
    questions: parseArrayPayload(Array.isArray(questionRows) ? (questionRows as RawQuestionArrayPayload[]) : []),
  }
}

async function readCacheSnapshotSafe(): Promise<QuestionBankCacheSnapshot> {
  if (!isIndexedDbAvailable()) return createEmptySnapshot()

  try {
    return await readCacheSnapshotFromDb()
  } catch {
    return createEmptySnapshot()
  }
}

async function writeCacheMeta(manifestSignature: string, syncedPages: string[]): Promise<void> {
  const db = await openQuestionBankDb()
  const transaction = db.transaction(META_STORE_NAME, 'readwrite')
  const store = transaction.objectStore(META_STORE_NAME)

  store.put({
    key: META_KEY_MANIFEST_SIGNATURE,
    value: manifestSignature,
  })
  store.put({
    key: META_KEY_SYNCED_PAGES,
    value: uniqueStringArray(syncedPages),
  })

  await transactionToPromise(transaction)
}

async function resetCacheForManifest(manifestSignature: string): Promise<void> {
  const db = await openQuestionBankDb()
  const transaction = db.transaction([QUESTION_STORE_NAME, META_STORE_NAME], 'readwrite')
  transaction.objectStore(QUESTION_STORE_NAME).clear()
  transaction.objectStore(META_STORE_NAME).clear()
  transaction.objectStore(META_STORE_NAME).put({
    key: META_KEY_MANIFEST_SIGNATURE,
    value: manifestSignature,
  })
  transaction.objectStore(META_STORE_NAME).put({
    key: META_KEY_SYNCED_PAGES,
    value: [],
  })

  await transactionToPromise(transaction)
}

async function upsertQuestionsInCache(questions: QuestionItem[]): Promise<void> {
  if (questions.length === 0) return

  const db = await openQuestionBankDb()
  const transaction = db.transaction(QUESTION_STORE_NAME, 'readwrite')
  const store = transaction.objectStore(QUESTION_STORE_NAME)

  for (const question of questions) {
    store.put(question)
  }

  await transactionToPromise(transaction)
}

function getStoredManifestSignature(): string | null {
  try {
    const value = localStorage.getItem(LOCAL_MANIFEST_SIGNATURE_KEY)
    return typeof value === 'string' && value.length > 0 ? value : null
  } catch {
    return null
  }
}

function setStoredManifestSignature(signature: string): void {
  try {
    localStorage.setItem(LOCAL_MANIFEST_SIGNATURE_KEY, signature)
  } catch {
    // no-op
  }
}

function getTargetPoolSize(requiredCount: number, maxPoolSize: number): number {
  return Math.min(maxPoolSize, Math.max(requiredCount, MIN_QUESTION_POOL_SIZE))
}

function buildPoolFromQuestions(questions: QuestionItem[], requiredCount: number, maxPoolSize: number): QuestionItem[] {
  if (questions.length === 0) return []

  const targetPoolSize = getTargetPoolSize(requiredCount, maxPoolSize)
  const shuffled = shuffle(questions)

  if (shuffled.length <= targetPoolSize) {
    return shuffled
  }

  return shuffled.slice(0, targetPoolSize)
}

async function tryLoadCachedQuestions(): Promise<QuestionItem[]> {
  const snapshot = await readCacheSnapshotSafe()
  return snapshot.questions
}

async function loadQuestionBankFromNetwork(signal?: AbortSignal): Promise<QuestionItem[]> {
  const payload = await fetchQuestionPayload(QUESTION_BANK_URL, signal)
  return parseQuestionPayload(payload)
}

function pickBootstrapPage(manifest: ParsedManifest, syncedPages: string[]): ParsedManifestPage | null {
  if (manifest.pages.length === 0) return null

  const synced = new Set(syncedPages)
  const pending = manifest.pages.filter((page) => !synced.has(page.file))

  if (pending.length > 0) {
    return shuffle(pending)[0]
  }

  return manifest.pages[0]
}

async function bootstrapFromSinglePage(
  manifest: ParsedManifest,
  syncedPages: string[],
  signal?: AbortSignal,
): Promise<{ questions: QuestionItem[]; syncedPages: string[] }> {
  const page = pickBootstrapPage(manifest, syncedPages)
  if (!page) {
    return {
      questions: [],
      syncedPages: uniqueStringArray(syncedPages),
    }
  }

  try {
    const payload = await fetchQuestionPayload(resolvePageUrl(page.file), signal)
    const questions = parseQuestionPayload(payload)
    if (questions.length === 0) {
      return {
        questions: [],
        syncedPages: uniqueStringArray(syncedPages),
      }
    }

    const nextSyncedPages = uniqueStringArray([...syncedPages, page.file])
    await upsertQuestionsInCache(questions)
    await writeCacheMeta(manifest.signature, nextSyncedPages)

    return {
      questions,
      syncedPages: nextSyncedPages,
    }
  } catch {
    return {
      questions: [],
      syncedPages: uniqueStringArray(syncedPages),
    }
  }
}

async function syncManifestPagesToCache(manifest: ParsedManifest): Promise<void> {
  if (!isIndexedDbAvailable()) return

  let snapshot = await readCacheSnapshotSafe()
  if (snapshot.manifestSignature !== manifest.signature) {
    await resetCacheForManifest(manifest.signature)
    snapshot = createEmptySnapshot()
    snapshot.manifestSignature = manifest.signature
  }

  const syncedPages = new Set(snapshot.syncedPages)

  for (const page of manifest.pages) {
    if (syncedPages.has(page.file)) continue

    try {
      const payload = await fetchQuestionPayload(resolvePageUrl(page.file))
      const rows = parseQuestionPayload(payload)
      if (rows.length > 0) {
        await upsertQuestionsInCache(rows)
      }
      syncedPages.add(page.file)
      await writeCacheMeta(manifest.signature, Array.from(syncedPages))
    } catch {
      // Skip failed pages and keep existing cache.
    }
  }

  setStoredManifestSignature(manifest.signature)
}

function ensureBackgroundManifestSync(manifest: ParsedManifest): void {
  if (!isIndexedDbAvailable()) return

  if (pageSyncPromise) {
    if (pageSyncSignature === manifest.signature) {
      return
    }

    void pageSyncPromise.finally(() => {
      ensureBackgroundManifestSync(manifest)
    })
    return
  }

  pageSyncSignature = manifest.signature
  pageSyncPromise = syncManifestPagesToCache(manifest)
    .catch(() => undefined)
    .finally(() => {
      pageSyncPromise = null
      pageSyncSignature = null
    })
}

async function loadPoolFromManifestPages(manifest: ParsedManifest, requiredCount: number, signal?: AbortSignal): Promise<QuestionItem[]> {
  const maxPoolSize = manifest.total > 0 ? manifest.total : Number.MAX_SAFE_INTEGER
  const targetPoolSize = getTargetPoolSize(requiredCount, maxPoolSize)
  const pool: QuestionItem[] = []
  const shuffledPages = shuffle(manifest.pages)

  for (const page of shuffledPages) {
    if (pool.length >= targetPoolSize) break

    try {
      const pagePayload = await fetchQuestionPayload(resolvePageUrl(page.file), signal)
      const rows = parseQuestionPayload(pagePayload)
      if (rows.length > 0) {
        pool.push(...rows)
      }
    } catch {
      // Continue loading remaining pages and fall back to full bank if pool is not enough.
    }
  }

  if (pool.length >= requiredCount) {
    return pool
  }

  const fallback = await loadQuestionBank(signal)
  if (fallback.length === 0) return pool
  return buildPoolFromQuestions(fallback, requiredCount, maxPoolSize)
}

export async function loadQuestionBank(signal?: AbortSignal): Promise<QuestionItem[]> {
  const cached = await tryLoadCachedQuestions()
  if (cached.length > 0) {
    return cached
  }

  const network = await loadQuestionBankFromNetwork(signal)
  if (network.length > 0 && isIndexedDbAvailable()) {
    void upsertQuestionsInCache(network).catch(() => undefined)
  }

  return network
}

export async function loadCachedQuestionBank(): Promise<QuestionItem[]> {
  return tryLoadCachedQuestions()
}

export async function loadQuestionPool(requiredCount: number, signal?: AbortSignal): Promise<QuestionItem[]> {
  const safeRequiredCount = Math.max(1, Math.floor(requiredCount))

  try {
    const manifestPayload = await fetchQuestionPayload(QUESTION_BANK_MANIFEST_URL, signal)
    const manifest = parseManifest(manifestPayload)
    if (!manifest) {
      return loadQuestionBank(signal)
    }

    const maxPoolSize = manifest.total > 0 ? manifest.total : Number.MAX_SAFE_INTEGER

    if (!isIndexedDbAvailable()) {
      return loadPoolFromManifestPages(manifest, safeRequiredCount, signal)
    }

    const localManifestSignature = getStoredManifestSignature()
    let snapshot = await readCacheSnapshotSafe()
    const localSignatureChanged = localManifestSignature !== null && localManifestSignature !== manifest.signature
    const dbSignatureChanged = snapshot.manifestSignature !== manifest.signature
    const manifestChanged = localSignatureChanged || dbSignatureChanged

    if (manifestChanged) {
      try {
        await resetCacheForManifest(manifest.signature)
        setStoredManifestSignature(manifest.signature)
      } catch {
        return loadPoolFromManifestPages(manifest, safeRequiredCount, signal)
      }

      snapshot = {
        manifestSignature: manifest.signature,
        syncedPages: [],
        questions: [],
      }
    } else if (localManifestSignature === null) {
      setStoredManifestSignature(manifest.signature)
    }

    let questionSource = snapshot.questions

    if (questionSource.length === 0) {
      const bootstrap = await bootstrapFromSinglePage(manifest, snapshot.syncedPages, signal)
      if (bootstrap.questions.length > 0) {
        questionSource = bootstrap.questions
      }
    }

    ensureBackgroundManifestSync(manifest)

    if (questionSource.length > 0) {
      const localPool = buildPoolFromQuestions(questionSource, safeRequiredCount, maxPoolSize)
      if (localPool.length >= safeRequiredCount) {
        return localPool
      }
    }

    const remotePool = await loadPoolFromManifestPages(manifest, safeRequiredCount, signal)
    if (remotePool.length > 0) {
      void upsertQuestionsInCache(remotePool).catch(() => undefined)
    }

    return remotePool
  } catch {
    const cached = await tryLoadCachedQuestions()
    if (cached.length >= safeRequiredCount) {
      return buildPoolFromQuestions(cached, safeRequiredCount, Number.MAX_SAFE_INTEGER)
    }

    return loadQuestionBank(signal)
  }
}

export function shuffle<T>(array: T[]): T[] {
  const copy = array.slice()
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function buildRoundQuestion(question: QuestionItem): {
  question: string
  options: string[]
  correctAnswer: number
} {
  const originalOptions = question.options.slice(0, 4)
  const correctText = originalOptions[question.answer]
  const shuffled = shuffle(originalOptions)
  const correctAnswer = shuffled.findIndex((option) => option === correctText)

  return {
    question: question.question,
    options: shuffled,
    correctAnswer,
  }
}
