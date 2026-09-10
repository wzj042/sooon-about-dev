// @vitest-environment jsdom

import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const manifest = {
  total: 2,
  pageSize: 1,
  pages: [
    { file: 'first.json', count: 1, hash: 'first' },
    { file: 'last.json', count: 1, hash: 'last' },
  ],
}
const question = (name: string) => ({ question: name, options: ['A', 'B', 'C', 'D'], answer: 0 })
const response = (payload: unknown) => new Response(JSON.stringify(payload))

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('indexedDB', new IDBFactory())
  localStorage.clear()
})

afterEach(() => vi.unstubAllGlobals())

describe('question bank synchronization completion', () => {
  it('waits for the last page and joins an existing background download', async () => {
    let releaseLastPage!: (value: Response) => void
    const lastPage = new Promise<Response>((resolve) => { releaseLastPage = resolve })
    let requestedLastPage = false
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('qb.manifest.json')) return Promise.resolve(response(manifest))
      if (url.endsWith('first.json')) return Promise.resolve(response([question('first')]))
      requestedLastPage = true
      return lastPage
    })
    vi.stubGlobal('fetch', fetchMock)
    const bank = await import('./questionBank')
    let completed = false
    const sync = bank.triggerBackgroundCacheSync().then(() => { completed = true })
    await vi.waitFor(() => expect(requestedLastPage).toBe(true))
    let joinedCompleted = false
    const joined = bank.triggerBackgroundCacheSync().then(() => { joinedCompleted = true })
    await vi.waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('qb.manifest.json'))).toHaveLength(2))

    expect(completed).toBe(false)
    expect(joinedCompleted).toBe(false)
    expect((await bank.loadQuestionBankCacheState()).questionCount).toBe(1)
    releaseLastPage(response([question('last')]))
    await Promise.all([sync, joined])

    expect(await bank.loadQuestionBankCacheState()).toMatchObject({ questionCount: 2, syncedPageCount: 2 })
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('last.json'))).toHaveLength(1)
  })

  it('finishes after a failed page, keeps downloaded data, and retries the missing page', async () => {
    let failLastPage = true
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.endsWith('qb.manifest.json')) return Promise.resolve(response(manifest))
      if (url.endsWith('last.json') && failLastPage) return Promise.reject(new Error('offline'))
      return Promise.resolve(response([question(url.endsWith('first.json') ? 'first' : 'last')]))
    }))
    const bank = await import('./questionBank')
    await bank.triggerBackgroundCacheSync()
    expect(await bank.loadQuestionBankCacheState()).toMatchObject({ questionCount: 1, syncedPageCount: 1 })
    expect(await bank.inspectQuestionBankCacheSync()).toMatchObject({ shouldSync: true })

    failLastPage = false
    await bank.triggerBackgroundCacheSync()
    expect(await bank.loadQuestionBankCacheState()).toMatchObject({ questionCount: 2, syncedPageCount: 2 })
  })
})
