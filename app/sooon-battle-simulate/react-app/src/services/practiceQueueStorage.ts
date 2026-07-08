import type { PracticeQueuePayload } from './practiceQueue'

const DB_NAME = 'sooon-practice-queue'
const DB_VERSION = 1
const PENDING_STORE_NAME = 'pendingQueue'
const PENDING_KEY = 'pending'

let dbPromise: Promise<IDBDatabase> | null = null

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openPracticeQueueDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  if (!isIndexedDbAvailable()) {
    dbPromise = Promise.reject(new Error('IndexedDB is not available'))
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PENDING_STORE_NAME)) {
        db.createObjectStore(PENDING_STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open practice queue IndexedDB'))
    }
  })

  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function buildPendingRecord(payload: PracticeQueuePayload): PracticeQueuePayload & { id: string } {
  const record: PracticeQueuePayload & { id: string } = { ...payload, id: PENDING_KEY }
  return record
}

export async function savePendingQueue(payload: PracticeQueuePayload): Promise<void> {
  const db = await openPracticeQueueDb()
  const transaction = db.transaction(PENDING_STORE_NAME, 'readwrite')
  const store = transaction.objectStore(PENDING_STORE_NAME)
  store.put(buildPendingRecord(payload))
  await transactionToPromise(transaction)
}

export async function loadPendingQueue(): Promise<PracticeQueuePayload | null> {
  try {
    const db = await openPracticeQueueDb()
    const transaction = db.transaction(PENDING_STORE_NAME, 'readonly')
    const store = transaction.objectStore(PENDING_STORE_NAME)
    const request = store.get(PENDING_KEY)
    const result = await requestToPromise(request)
    await transactionToPromise(transaction)

    if (!result || typeof result !== 'object') return null
    const record = result as Record<string, unknown>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...payload } = record
    return payload as PracticeQueuePayload
  } catch {
    return null
  }
}

export async function clearPendingQueue(): Promise<void> {
  try {
    const db = await openPracticeQueueDb()
    const transaction = db.transaction(PENDING_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(PENDING_STORE_NAME)
    store.delete(PENDING_KEY)
    await transactionToPromise(transaction)
  } catch {
    // no-op
  }
}
