import { describe, expect, it } from 'vitest'

import { buildRoundQuestion, shuffleQuestionOptions } from './questionBank'

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
