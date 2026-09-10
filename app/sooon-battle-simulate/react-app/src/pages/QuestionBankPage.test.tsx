// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { QuestionItem } from '../domain/types'
import * as bank from '../services/questionBank'
import { QuestionBankPage } from './QuestionBankPage'

vi.mock('../services/questionBank')

let container: HTMLDivElement
let root: Root
const first: QuestionItem = { question: 'First cached question', options: ['A', 'B', 'C', 'D'], answer: 0 }
const last: QuestionItem = { question: 'Last downloaded question', options: ['A', 'B', 'C', 'D'], answer: 0 }

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  sessionStorage.clear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

it.each([true, false])('refreshes after a download longer than five seconds (existing cache: %s)', async (hasCache) => {
  let cachedRows = hasCache ? [first] : []
  let finishSync!: () => void
  vi.mocked(bank.loadManifestInfo).mockResolvedValue({ total: 2, pageSize: 1, pageCount: 2, dropped: 0 })
  vi.mocked(bank.loadQuestionBankCacheState).mockImplementation(async () => ({
    questionCount: cachedRows.length,
    syncedPageCount: cachedRows.length,
    manifestSignature: 'manifest',
  }))
  vi.mocked(bank.loadCachedQuestionBank).mockImplementation(async () => cachedRows)
  vi.mocked(bank.loadCachedQuestionBankPreview).mockImplementation(async () => cachedRows.slice(0, 1))
  vi.mocked(bank.inspectQuestionBankCacheSync).mockResolvedValue({ shouldSync: true, reason: 'cache_incomplete' })
  vi.mocked(bank.loadQuestionPool).mockImplementation(async () => {
    cachedRows = [first]
    return cachedRows
  })
  vi.mocked(bank.triggerBackgroundCacheSync).mockReturnValue(new Promise<void>((resolve) => { finishSync = resolve }))

  await act(async () => root.render(<MemoryRouter><QuestionBankPage /></MemoryRouter>))
  expect(bank.triggerBackgroundCacheSync).toHaveBeenCalledOnce()
  expect(container.textContent).toContain('First cached question')

  await act(async () => vi.advanceTimersByTimeAsync(6_000))
  expect(container.textContent).toContain('后台增量同步中')
  expect(container.textContent).not.toContain('Last downloaded question')

  await act(async () => {
    cachedRows = [first, last]
    finishSync()
  })
  expect(container.textContent).toContain('Last downloaded question')
  expect(container.textContent).toContain('已是最新')
  expect(container.textContent).not.toContain('后台增量同步中')
  const reads = vi.mocked(bank.loadQuestionBankCacheState).mock.calls.length
  await act(async () => vi.advanceTimersByTimeAsync(6_000))
  expect(bank.loadQuestionBankCacheState).toHaveBeenCalledTimes(reads)
})
