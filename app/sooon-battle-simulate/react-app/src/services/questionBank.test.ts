import { describe, expect, it } from 'vitest'

import { buildRoundQuestion, selectPagesToSync, shuffleQuestionOptions } from './questionBank'

describe('selectPagesToSync', () => {
  const pages = [
    { file: 'qb.page.001.json', count: 240, hash: 'h1' },
    { file: 'qb.page.002.json', count: 240, hash: 'h2' },
    { file: 'qb.page.003.json', count: 120, hash: 'h3' },
  ]

  it('skips pages whose cached hash matches the manifest', () => {
    const result = selectPagesToSync(pages, {
      'qb.page.001.json': 'h1',
      'qb.page.002.json': 'h2',
      'qb.page.003.json': 'h3',
    })

    expect(result).toEqual([])
  })

  it('only re-downloads pages whose hash changed', () => {
    const result = selectPagesToSync(pages, {
      'qb.page.001.json': 'h1',
      'qb.page.002.json': 'CHANGED',
      'qb.page.003.json': 'h3',
    })

    expect(result.map((page) => page.file)).toEqual(['qb.page.002.json'])
  })

  it('treats never-synced pages (appended pages) as pending', () => {
    const result = selectPagesToSync(pages, {
      'qb.page.001.json': 'h1',
      'qb.page.002.json': 'h2',
    })

    expect(result.map((page) => page.file)).toEqual(['qb.page.003.json'])
  })

  it('re-downloads conservatively when a page has no hash information', () => {
    const result = selectPagesToSync([{ file: 'qb.page.001.json', count: 240 }], {
      'qb.page.001.json': 'h1',
    })

    expect(result.map((page) => page.file)).toEqual(['qb.page.001.json'])
  })
})

describe('questionBank option shuffling', () => {
  it('remaps the answer when preprocessing loaded questions', () => {
    const question = {
      question: 'q-1',
      options: ['A', 'B', 'C', 'D'],
      answer: 2,
    }

    const shuffled = shuffleQuestionOptions(question, (items) => [items[2], items[0], items[3], items[1]])

    expect(shuffled.options).toEqual(['C', 'A', 'D', 'B'])
    expect(shuffled.answer).toBe(0)
    expect(shuffled.options[shuffled.answer]).toBe('C')
  })

  it('tracks the original correct option by index when option text is duplicated', () => {
    const question = {
      question: 'q-duplicates',
      options: ['Same', 'Wrong', 'Same', 'Other'],
      answer: 2,
    }

    const shuffled = shuffleQuestionOptions(question, (items) => [items[0], items[2], items[1], items[3]])

    expect(shuffled.options).toEqual(['Same', 'Same', 'Wrong', 'Other'])
    expect(shuffled.answer).toBe(1)
  })

  it('keeps the original correct option aligned after round shuffling', () => {
    const question = {
      question: 'q-2',
      options: ['A', 'B', 'C', 'D'],
      answer: 1,
    }

    const roundQuestion = buildRoundQuestion(question)

    expect(roundQuestion.options).toHaveLength(4)
    expect(new Set(roundQuestion.options)).toEqual(new Set(question.options))
    expect(roundQuestion.options[roundQuestion.correctAnswer]).toBe('B')
  })
})
