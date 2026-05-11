// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { exportUserData, importUserData } from './userDataTransfer'

class FakeBlob {
  parts: string[]

  constructor(parts: unknown[]) {
    this.parts = parts.map((part) => String(part))
  }
}

function isFakeBlob(value: unknown): value is FakeBlob {
  return value instanceof FakeBlob
}

describe('userDataTransfer', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.stubGlobal('Blob', FakeBlob as unknown as typeof Blob)
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => 'blob:test',
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: () => undefined,
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  })

  it('exports only battle app keys', async () => {
    localStorage.setItem('sooon-question-stats', '{"a":1}')
    localStorage.setItem('question-bank-filter-state', '{"b":1}')
    localStorage.setItem('questionSelectionStrategy', 'all_questions')
    localStorage.setItem('lastLoadedData', '[1,2,3]')

    const result = exportUserData()
    expect(result.ok).toBe(true)

    const [blob] = vi.mocked(URL.createObjectURL).mock.calls.at(-1) ?? []
    expect(isFakeBlob(blob)).toBe(true)
    if (!isFakeBlob(blob)) {
      throw new Error('Expected export blob to use FakeBlob in test environment')
    }
    const text = blob.parts.join('')
    const payload = JSON.parse(text) as { items: Array<{ key: string; value: string }> }
    const keys = payload.items.map((item) => item.key).sort()

    expect(keys).toEqual(['question-bank-filter-state', 'questionSelectionStrategy', 'sooon-question-stats'])
  })

  it('imports only battle app keys from older full exports', async () => {
    localStorage.setItem('sooon-question-stats', '{"old":1}')
    localStorage.setItem('lastLoadedData', 'stale')

    const file: Pick<File, 'text'> = {
      text: async () =>
        JSON.stringify({
          version: 1,
          app: 'sooon-battle-simulate',
          exportedAt: '2026-05-10T00:00:00.000Z',
          items: [
            { key: 'sooon-question-stats', value: '{"new":1}' },
            { key: 'lastLoadedData', value: 'huge-cache' },
            { key: 'questionSelectionStrategy', value: 'all_questions' },
          ],
        }),
    }

    const result = await importUserData(file as File)
    expect(result.ok).toBe(true)
    expect(localStorage.getItem('sooon-question-stats')).toBe('{"new":1}')
    expect(localStorage.getItem('questionSelectionStrategy')).toBe('all_questions')
    expect(localStorage.getItem('lastLoadedData')).toBe('stale')
  })
})
