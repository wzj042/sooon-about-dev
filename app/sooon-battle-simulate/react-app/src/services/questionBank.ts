import type { QuestionItem } from '../domain/types'
import { buildQuestionHash, isQuestionReference, type QuestionReference } from './questionIdentity'
import { normalizePublicAssetUrl, toPublicUrl } from '../utils/publicAsset'

interface RawQuestionPayload {
  options?: unknown
  answer?: unknown
  type?: unknown
  deleted?: unknown
  source_id?: unknown
  sourceId?: unknown
  updated_at?: unknown
  updatedAt?: unknown
}

interface RawQuestionArrayPayload {
  question?: unknown
  options?: unknown
  answer?: unknown
  type?: unknown
  deleted?: unknown
  source_id?: unknown
  sourceId?: unknown
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
  syncedPageHashes: Record<string, string>
  questions: QuestionItem[]
}

export interface QuestionBankCacheState {
  manifestSignature: string | null
  syncedPageCount: number
  questionCount: number
}

export interface QuestionBankCacheSyncState {
  shouldSync: boolean
  reason: 'up_to_date' | 'cache_empty' | 'cache_incomplete' | 'manifest_changed' | 'manifest_unavailable'
}

export interface QuestionBankManifestInfo {
  total: number
  pageSize: number
  pageCount: number
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
// v3：同步进度改为「按分页 hash 增量」，签名变化不再整库清空。
// 题库整体重构时把此版本号 +1，即可强制一次干净的全量重建。
const QUESTION_BANK_DB_VERSION = 3
const QUESTION_STORE_NAME = 'questions'
const META_STORE_NAME = 'meta'
const META_KEY_MANIFEST_SIGNATURE = 'manifestSignature'
// 值语义：Record<分页文件名, 分页 hash>，用于按 hash 做增量同步。
const META_KEY_SYNCED_PAGES = 'syncedPages'
const LOCAL_MANIFEST_SIGNATURE_KEY = 'sooon-question-bank-manifest-signature'

let questionBankDbPromise: Promise<IDBDatabase> | null = null
let pageSyncPromise: Promise<void> | null = null
let pageSyncSignature: string | null = null

function isValidQuestion(item: QuestionItem): boolean {
  return (
    item.deleted !== true &&
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

function normalizeDeletedFlag(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
    return undefined
  }
  if (typeof value !== 'string') return undefined

  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false
  return undefined
}

function normalizeSourceId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function normalizeQuestion(question: string, raw: RawQuestionPayload): QuestionItem {
  const options = Array.isArray(raw.options) ? raw.options.filter((value) => typeof value === 'string').slice(0, 4) : []
  const answer = Number(raw.answer ?? 0)
  const updatedAtRaw = typeof raw.updated_at === 'string' ? raw.updated_at : typeof raw.updatedAt === 'string' ? raw.updatedAt : null
  const updatedAt = typeof updatedAtRaw === 'string' ? updatedAtRaw.trim() : ''
  const deleted = normalizeDeletedFlag(raw.deleted)
  const sourceId = normalizeSourceId(raw.sourceId ?? raw.source_id)

  return {
    question,
    options,
    answer,
    type: typeof raw.type === 'string' ? raw.type : undefined,
    deleted,
    sourceId,
    updatedAt: updatedAt.length > 0 ? updatedAt : undefined,
  }
}

function parseObjectPayload(payload: Record<string, RawQuestionPayload>): QuestionItem[] {
  return Object.entries(payload)
    .map(([question, raw]) => shuffleQuestionOptions(normalizeQuestion(question, raw)))
    .filter(isValidQuestion)
}

function parseArrayPayload(payload: RawQuestionArrayPayload[]): QuestionItem[] {
  return payload
    .map((raw) =>
      shuffleQuestionOptions(
        normalizeQuestion(typeof raw.question === 'string' ? raw.question : '', {
          options: raw.options,
          answer: raw.answer,
          type: raw.type,
          deleted: raw.deleted,
          source_id: raw.source_id,
          sourceId: raw.sourceId,
          updated_at: raw.updated_at,
          updatedAt: raw.updatedAt,
        }),
      ),
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

/**
 * 解析题库数据，保留 deleted 标记的题目。
 * 供同步/写入路径使用——确保 IndexedDB 中标记为 deleted 的旧记录能被覆盖更新，
 * 避免残留旧版本（无 deleted 字段）在读取时绕过过滤。
 */
function parseObjectPayloadIncludeDeleted(payload: Record<string, RawQuestionPayload>): QuestionItem[] {
  return Object.entries(payload).map(([question, raw]) =>
    shuffleQuestionOptions(normalizeQuestion(question, raw)),
  )
}

function parseArrayPayloadIncludeDeleted(payload: RawQuestionArrayPayload[]): QuestionItem[] {
  return payload.map((raw) =>
    shuffleQuestionOptions(
      normalizeQuestion(typeof raw.question === 'string' ? raw.question : '', {
        options: raw.options,
        answer: raw.answer,
        type: raw.type,
        deleted: raw.deleted,
        source_id: raw.source_id,
        sourceId: raw.sourceId,
        updated_at: raw.updated_at,
        updatedAt: raw.updatedAt,
      }),
    ),
  )
}

function parseQuestionPayloadIncludeDeleted(payload: unknown): QuestionItem[] {
  if (Array.isArray(payload)) {
    return parseArrayPayloadIncludeDeleted(payload as RawQuestionArrayPayload[])
  }

  if (payload && typeof payload === 'object') {
    return parseObjectPayloadIncludeDeleted(payload as Record<string, RawQuestionPayload>)
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

function createEmptySnapshot(): QuestionBankCacheSnapshot {
  return {
    manifestSignature: null,
    syncedPageHashes: {},
    questions: [],
  }
}

/**
 * 计算需要重新下载的分页：缓存里记录的 hash 与 manifest 中该页 hash 不一致（或从未同步）才需要重下。
 * 内容未变的分页（hash 相同）直接跳过，这是增量同步的核心。
 */
export function selectPagesToSync(
  pages: ParsedManifestPage[],
  syncedPageHashes: Record<string, string>,
): ParsedManifestPage[] {
  return pages.filter((page) => {
    const cachedHash = syncedPageHashes[page.file]
    // 无缓存记录 → 需同步；有 hash 但与缓存不同 → 需同步；页无 hash 信息则保守重下。
    if (typeof cachedHash !== 'string' || cachedHash.length === 0) return true
    if (typeof page.hash !== 'string' || page.hash.length === 0) return true
    return cachedHash !== page.hash
  })
}

/** manifest 中已不存在的分页文件（用于清理陈旧的同步记录）。 */
function findStalePageFiles(pages: ParsedManifestPage[], syncedPageHashes: Record<string, string>): string[] {
  const manifestFiles = new Set(pages.map((page) => page.file))
  return Object.keys(syncedPageHashes).filter((file) => !manifestFiles.has(file))
}

/** 由 manifest 分页构造「文件名 → hash」映射，代表这些分页均已同步。 */
function buildSyncedHashesFromPages(pages: ParsedManifestPage[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const page of pages) {
    result[page.file] = typeof page.hash === 'string' ? page.hash : ''
  }
  return result
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

    request.onupgradeneeded = (event) => {
      const db = request.result
      const transaction = request.transaction
      if (!db.objectStoreNames.contains(QUESTION_STORE_NAME)) {
        db.createObjectStore(QUESTION_STORE_NAME, { keyPath: 'question' })
      }
      if (!db.objectStoreNames.contains(META_STORE_NAME)) {
        db.createObjectStore(META_STORE_NAME, { keyPath: 'key' })
      }
      if (event.oldVersion < 3 && transaction) {
        transaction.objectStore(QUESTION_STORE_NAME).clear()
        transaction.objectStore(META_STORE_NAME).clear()
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

function getMetaStringRecord(map: Map<string, unknown>, key: string): Record<string, string> {
  const value = map.get(key)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const result: Record<string, string> = {}
  for (const [file, hash] of Object.entries(value as Record<string, unknown>)) {
    if (typeof file === 'string' && file.length > 0 && typeof hash === 'string') {
      result[file] = hash
    }
  }
  return result
}

async function readCacheSnapshotFromDb(): Promise<QuestionBankCacheSnapshot> {
  const db = await openQuestionBankDb()
  const transaction = db.transaction([QUESTION_STORE_NAME, META_STORE_NAME], 'readonly')

  const questionRequest = transaction.objectStore(QUESTION_STORE_NAME).getAll() as IDBRequest<unknown[]>
  const metaRequest = transaction.objectStore(META_STORE_NAME).getAll() as IDBRequest<unknown[]>

  const [questionRows, metaRows] = await Promise.all([requestToPromise(questionRequest), requestToPromise(metaRequest)])
  await transactionToPromise(transaction)

  const metaMap = metaEntriesToMap(Array.isArray(metaRows) ? metaRows : [])
  const syncedPageHashes = getMetaStringRecord(metaMap, META_KEY_SYNCED_PAGES)

  return {
    manifestSignature: getMetaString(metaMap, META_KEY_MANIFEST_SIGNATURE),
    syncedPageHashes,
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

async function readQuestionCacheStateFromDb(): Promise<QuestionBankCacheState> {
  const db = await openQuestionBankDb()
  const transaction = db.transaction([QUESTION_STORE_NAME, META_STORE_NAME], 'readonly')

  const countRequest = transaction.objectStore(QUESTION_STORE_NAME).count()
  const metaRequest = transaction.objectStore(META_STORE_NAME).getAll() as IDBRequest<unknown[]>

  const [questionCount, metaRows] = await Promise.all([requestToPromise(countRequest), requestToPromise(metaRequest)])
  await transactionToPromise(transaction)

  const metaMap = metaEntriesToMap(Array.isArray(metaRows) ? metaRows : [])
  const manifestSignature = getMetaString(metaMap, META_KEY_MANIFEST_SIGNATURE)
  const syncedPageHashes = getMetaStringRecord(metaMap, META_KEY_SYNCED_PAGES)

  return {
    manifestSignature,
    syncedPageCount: Object.keys(syncedPageHashes).length,
    questionCount: typeof questionCount === 'number' ? questionCount : 0,
  }
}

async function readQuestionCacheStateSafe(): Promise<QuestionBankCacheState> {
  if (!isIndexedDbAvailable()) {
    return {
      manifestSignature: null,
      syncedPageCount: 0,
      questionCount: 0,
    }
  }

  try {
    return await readQuestionCacheStateFromDb()
  } catch {
    return {
      manifestSignature: null,
      syncedPageCount: 0,
      questionCount: 0,
    }
  }
}

async function loadCachedQuestionsPreview(limit: number): Promise<QuestionItem[]> {
  if (!isIndexedDbAvailable()) return []

  const safeLimit = Math.max(1, Math.floor(limit))

  try {
    const db = await openQuestionBankDb()
    const transaction = db.transaction(QUESTION_STORE_NAME, 'readonly')
    const store = transaction.objectStore(QUESTION_STORE_NAME)
    const request = store.getAll(undefined, safeLimit) as IDBRequest<unknown[]>
    const rows = await requestToPromise(request)
    await transactionToPromise(transaction)
    return parseArrayPayload(Array.isArray(rows) ? (rows as RawQuestionArrayPayload[]) : [])
  } catch {
    return []
  }
}

async function writeCacheMeta(manifestSignature: string, syncedPageHashes: Record<string, string>): Promise<void> {
  const db = await openQuestionBankDb()
  const transaction = db.transaction(META_STORE_NAME, 'readwrite')
  const store = transaction.objectStore(META_STORE_NAME)

  store.put({
    key: META_KEY_MANIFEST_SIGNATURE,
    value: manifestSignature,
  })
  store.put({
    key: META_KEY_SYNCED_PAGES,
    value: { ...syncedPageHashes },
  })

  await transactionToPromise(transaction)
}

async function hydrateCacheMetaFromManifest(
  manifest: ParsedManifest,
  cacheState: QuestionBankCacheState,
  localManifestSignature: string | null,
): Promise<QuestionBankCacheState> {
  if (!isIndexedDbAvailable()) return cacheState

  const signatureCompatible =
    (cacheState.manifestSignature === null || cacheState.manifestSignature === manifest.signature) &&
    (localManifestSignature === null || localManifestSignature === manifest.signature)
  const cacheLooksComplete = manifest.total > 0 && cacheState.questionCount >= manifest.total
  const metadataIncomplete =
    cacheState.manifestSignature !== manifest.signature ||
    cacheState.syncedPageCount < manifest.pages.length ||
    localManifestSignature === null

  if (!signatureCompatible || !cacheLooksComplete || !metadataIncomplete) {
    return cacheState
  }

  try {
    await writeCacheMeta(manifest.signature, buildSyncedHashesFromPages(manifest.pages))
    setStoredManifestSignature(manifest.signature)

    return {
      manifestSignature: manifest.signature,
      syncedPageCount: manifest.pages.length,
      questionCount: cacheState.questionCount,
    }
  } catch {
    return cacheState
  }
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

function buildQuestionReferenceLookups(questions: QuestionItem[]): {
  byHash: Map<string, QuestionItem>
  bySourceId: Map<string, QuestionItem>
} {
  const byHash = new Map<string, QuestionItem>()
  const bySourceId = new Map<string, QuestionItem>()

  for (const question of questions) {
    const questionHash = buildQuestionHash(question.question)
    if (questionHash.length > 0 && !byHash.has(questionHash)) {
      byHash.set(questionHash, question)
    }

    const normalizedSourceId = typeof question.sourceId === 'string' ? question.sourceId.trim() : ''
    if (normalizedSourceId.length > 0 && !bySourceId.has(normalizedSourceId)) {
      bySourceId.set(normalizedSourceId, question)
    }
  }

  return { byHash, bySourceId }
}

function resolveQuestionReferencesFromPool(references: QuestionReference[], questions: QuestionItem[]): QuestionItem[] {
  if (references.length === 0 || questions.length === 0) return []

  const { byHash, bySourceId } = buildQuestionReferenceLookups(questions)

  return references.flatMap((reference) => {
    const normalizedSourceId = typeof reference.sourceId === 'string' ? reference.sourceId.trim() : ''
    const matched =
      (normalizedSourceId.length > 0 ? bySourceId.get(normalizedSourceId) : null) ??
      byHash.get(reference.questionHash) ??
      null

    return matched ? [matched] : []
  })
}

async function tryLoadCachedQuestions(): Promise<QuestionItem[]> {
  const snapshot = await readCacheSnapshotSafe()
  return snapshot.questions
}

async function loadQuestionBankFromNetwork(signal?: AbortSignal): Promise<QuestionItem[]> {
  const payload = await fetchQuestionPayload(QUESTION_BANK_URL, signal)
  // 解析全部题目（含 deleted），由 loadQuestionBank 统一过滤
  return parseQuestionPayloadIncludeDeleted(payload)
}

function pickBootstrapPage(manifest: ParsedManifest, syncedPageHashes: Record<string, string>): ParsedManifestPage | null {
  if (manifest.pages.length === 0) return null

  const pending = selectPagesToSync(manifest.pages, syncedPageHashes)
  if (pending.length > 0) {
    return shuffle(pending)[0]
  }

  return manifest.pages[0]
}

async function bootstrapFromSinglePage(
  manifest: ParsedManifest,
  syncedPageHashes: Record<string, string>,
  signal?: AbortSignal,
): Promise<{ questions: QuestionItem[]; syncedPageHashes: Record<string, string> }> {
  const page = pickBootstrapPage(manifest, syncedPageHashes)
  if (!page) {
    return {
      questions: [],
      syncedPageHashes: { ...syncedPageHashes },
    }
  }

  try {
    const payload = await fetchQuestionPayload(resolvePageUrl(page.file), signal)
    const allQuestions = parseQuestionPayloadIncludeDeleted(payload)
    if (allQuestions.length === 0) {
      return {
        questions: [],
        syncedPageHashes: { ...syncedPageHashes },
      }
    }

    const nextSyncedPageHashes = { ...syncedPageHashes, [page.file]: typeof page.hash === 'string' ? page.hash : '' }
    // 存储全部题目（含 deleted），确保 IndexedDB 中旧记录被覆盖
    await upsertQuestionsInCache(allQuestions)
    await writeCacheMeta(manifest.signature, nextSyncedPageHashes)

    return {
      questions: allQuestions.filter(isValidQuestion),
      syncedPageHashes: nextSyncedPageHashes,
    }
  } catch {
    return {
      questions: [],
      syncedPageHashes: { ...syncedPageHashes },
    }
  }
}

/**
 * 增量同步分页到 IndexedDB：
 * - 只重新下载 hash 与缓存记录不一致（或从未同步）的分页，命中缓存的分页直接跳过。
 * - 签名变化不再整库清空——更新题目/末尾追加只会命中少数分页，其余原样保留。
 * - 已下载的分页按题目文本为 key `upsert` 覆盖；manifest 中被移除的分页仅清理同步记录，
 *   遗留题目条目留待题库整体重构时通过 DB 版本号 +1 一次性重建收敛。
 */
async function syncManifestPagesToCache(manifest: ParsedManifest): Promise<void> {
  if (!isIndexedDbAvailable()) return

  const snapshot = await readCacheSnapshotSafe()
  const syncedPageHashes = { ...snapshot.syncedPageHashes }
  const pending = selectPagesToSync(manifest.pages, syncedPageHashes)

  for (const page of pending) {
    try {
      const payload = await fetchQuestionPayload(resolvePageUrl(page.file))
      // 存储全部题目（含 deleted），确保 IndexedDB 中旧记录被覆盖
      const rows = parseQuestionPayloadIncludeDeleted(payload)
      if (rows.length > 0) {
        await upsertQuestionsInCache(rows)
      }
      syncedPageHashes[page.file] = typeof page.hash === 'string' ? page.hash : ''
      await writeCacheMeta(manifest.signature, syncedPageHashes)
    } catch {
      // Skip failed pages and keep existing cache.
    }
  }

  for (const file of findStalePageFiles(manifest.pages, syncedPageHashes)) {
    delete syncedPageHashes[file]
  }

  // 即便所有分页都命中缓存，也要把签名写回，避免反复判定为「manifest 已变化」。
  await writeCacheMeta(manifest.signature, syncedPageHashes)
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
      // 解析全部题目（含 deleted），由调用方统一过滤
      const rows = parseQuestionPayloadIncludeDeleted(pagePayload)
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
    // 存储全部题目（含 deleted），确保 IndexedDB 中旧记录被覆盖
    void upsertQuestionsInCache(network).catch(() => undefined)
  }

  return network.filter(isValidQuestion)
}

export async function loadCachedQuestionBank(): Promise<QuestionItem[]> {
  return tryLoadCachedQuestions()
}

export async function loadCachedQuestionBankPreview(limit: number): Promise<QuestionItem[]> {
  return loadCachedQuestionsPreview(limit)
}

export async function resolveQuestionReferences(references: QuestionReference[]): Promise<QuestionItem[]> {
  const normalizedReferences = references.filter(isQuestionReference)
  if (normalizedReferences.length === 0) return []

  const cached = await tryLoadCachedQuestions()
  const resolvedFromCache = resolveQuestionReferencesFromPool(normalizedReferences, cached)
  if (resolvedFromCache.length >= normalizedReferences.length) {
    return resolvedFromCache
  }

  try {
    const bank = await loadQuestionBank()
    return resolveQuestionReferencesFromPool(normalizedReferences, bank)
  } catch {
    return resolvedFromCache
  }
}

export async function loadQuestionBankCacheState(): Promise<QuestionBankCacheState> {
  return readQuestionCacheStateSafe()
}

export async function inspectQuestionBankCacheSync(signal?: AbortSignal): Promise<QuestionBankCacheSyncState> {
  try {
    const manifestPayload = await fetchQuestionPayload(QUESTION_BANK_MANIFEST_URL, signal)
    const manifest = parseManifest(manifestPayload)
    if (!manifest) {
      return {
        shouldSync: false,
        reason: 'manifest_unavailable',
      }
    }

    const localManifestSignature = getStoredManifestSignature()
    let cacheState = await readQuestionCacheStateSafe()
    cacheState = await hydrateCacheMetaFromManifest(manifest, cacheState, localManifestSignature)

    const nextLocalManifestSignature =
      cacheState.manifestSignature === manifest.signature ? manifest.signature : getStoredManifestSignature()
    const localSignatureChanged =
      nextLocalManifestSignature !== null && nextLocalManifestSignature !== manifest.signature
    const dbSignatureChanged = cacheState.manifestSignature !== null && cacheState.manifestSignature !== manifest.signature

    if (localSignatureChanged || dbSignatureChanged) {
      return {
        shouldSync: true,
        reason: 'manifest_changed',
      }
    }

    if (cacheState.questionCount <= 0) {
      return {
        shouldSync: true,
        reason: 'cache_empty',
      }
    }

    if (cacheState.manifestSignature === manifest.signature && cacheState.syncedPageCount >= manifest.pages.length) {
      return {
        shouldSync: false,
        reason: 'up_to_date',
      }
    }

    return {
      shouldSync: true,
      reason: 'cache_incomplete',
    }
  } catch {
    return {
      shouldSync: false,
      reason: 'manifest_unavailable',
    }
  }
}

/**
 * 获取线上题库清单信息（题目总数、分页大小、分页数）。
 * 只请求轻量的 manifest 文件，不下载题目数据本身。
 * 用于题库页面显示「线上题库 vs 本地缓存」的数据差异。
 */
export async function loadManifestInfo(signal?: AbortSignal): Promise<QuestionBankManifestInfo | null> {
  try {
    const payload = await fetchQuestionPayload(QUESTION_BANK_MANIFEST_URL, signal)
    const manifest = parseManifest(payload)
    if (!manifest) return null
    return {
      total: manifest.total,
      pageSize: manifest.pageSize,
      pageCount: manifest.pages.length,
    }
  } catch {
    return null
  }
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

    // manifest 变化时不再整库清空：先复用已有缓存立即出题，变化的分页交给后台增量同步覆盖。
    const snapshot = await readCacheSnapshotSafe()
    let questionSource = snapshot.questions

    if (questionSource.length === 0) {
      const bootstrap = await bootstrapFromSinglePage(manifest, snapshot.syncedPageHashes, signal)
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
      // 存储全部题目（含 deleted），确保 IndexedDB 中旧记录被覆盖
      void upsertQuestionsInCache(remotePool).catch(() => undefined)
    }

    return remotePool.filter(isValidQuestion)
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

export function shuffleQuestionOptions(
  question: QuestionItem,
  shuffleFn: <T>(array: T[]) => T[] = shuffle,
): QuestionItem {
  const originalOptions = question.options.slice(0, 4)
  if (originalOptions.length !== 4) {
    return {
      ...question,
      options: originalOptions,
    }
  }

  const indexedOptions = originalOptions.map((option, index) => ({
    option,
    index,
  }))
  const shuffledOptions = shuffleFn(indexedOptions)
  const correctAnswer = shuffledOptions.findIndex((entry) => entry.index === question.answer)

  return {
    ...question,
    options: shuffledOptions.map((entry) => entry.option),
    answer: correctAnswer >= 0 ? correctAnswer : question.answer,
  }
}

export function buildRoundQuestion(question: QuestionItem): {
  question: string
  options: string[]
  correctAnswer: number
} {
  const shuffledQuestion = shuffleQuestionOptions(question)

  return {
    question: shuffledQuestion.question,
    options: shuffledQuestion.options,
    correctAnswer: shuffledQuestion.answer,
  }
}
