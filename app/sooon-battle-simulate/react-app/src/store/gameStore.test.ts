// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuestionItem } from '../domain/types'

interface MockQuestionStatEntry {
  mastered?: boolean
  seenCount?: number
  answeredCount?: number
  wrongCount?: number
  totalResponseMs?: number
}

const mockPoolRef: { current: QuestionItem[] } = { current: [] }
const mockStatsRef: { current: Record<string, MockQuestionStatEntry> } = { current: {} }

vi.mock('../services/avatarService', () => ({
  generateRandomAvatar: vi.fn(async () => ({ svg: '<svg></svg>' })),
}))

vi.mock('../services/questionBank', () => ({
  loadQuestionPool: vi.fn(async () => mockPoolRef.current),
  buildRoundQuestion: vi.fn((question: QuestionItem) => ({
    question: question.question,
    options: question.options,
    correctAnswer: question.answer,
  })),
}))

vi.mock('../services/questionStats', () => ({
  loadQuestionStatsMap: vi.fn(() => mockStatsRef.current),
  getQuestionStat: vi.fn((question: string, map: Record<string, MockQuestionStatEntry>) => map[question] ?? null),
  averageResponseMs: vi.fn((entry: MockQuestionStatEntry | null) => {
    if (!entry || !entry.answeredCount || entry.answeredCount <= 0) return 0
    return (entry.totalResponseMs ?? 0) / entry.answeredCount
  }),
  recordQuestionAttempt: vi.fn(() => undefined),
  isCommonSenseType: vi.fn((type?: string) => typeof type === 'string' && type.trim().toLowerCase() === 'common_sense'),
  isEthicsType: vi.fn((type?: string) => typeof type === 'string' && type.trim().toLowerCase() === 'sooon_ai'),
}))

function createQuestion(id: string, type?: string): QuestionItem {
  return {
    question: `q-${id}`,
    options: [`A-${id}`, `B-${id}`, `C-${id}`, `D-${id}`],
    answer: 0,
    type,
  }
}

async function loadStore() {
  const mod = await import('./gameStore')
  return mod.useGameStore
}

describe('gameStore battle scenarios', () => {
  beforeEach(async () => {
    vi.resetModules()
    mockPoolRef.current = []
    mockStatsRef.current = {}
    const useGameStore = await loadStore()
    useGameStore.getState().reset()
  })

  it('advances queue window after a finished queue game', async () => {
    const useGameStore = await loadStore()
    const queue = [createQuestion('1'), createQuestion('2'), createQuestion('3'), createQuestion('4'), createQuestion('5'), createQuestion('6')]

    useGameStore.getState().setPracticeQueue(queue)
    await useGameStore.getState().startNewGame()
    expect(useGameStore.getState().currentQuestion).toBe('q-1')

    useGameStore.setState({
      gamePhase: 'ended',
      practiceQueuePracticed: 5,
      currentRound: 5,
    })

    await useGameStore.getState().startNewGame()
    expect(useGameStore.getState().currentQuestion).toBe('q-6')
    expect(useGameStore.getState().practiceQueuePracticed).toBe(5)
  })

  it('does not enter placeholder round when strict strategy has no matching questions', async () => {
    const useGameStore = await loadStore()
    mockPoolRef.current = [createQuestion('ethics-a', 'ethics'), createQuestion('ethics-b', 'ethics')]

    useGameStore.getState().updateQuestionSelectionStrategy('common_sense_only')
    await useGameStore.getState().startNewGame()

    expect(useGameStore.getState().questionLoadError).toContain('No questions available for current strategy')
    expect(useGameStore.getState().gamePhase).toBe('ready')
    expect(useGameStore.getState().currentQuestion).toBeNull()
  })

  it('does not mix in non-queue questions when queue has too few non-mastered items', async () => {
    const useGameStore = await loadStore()
    const queue = [createQuestion('qa'), createQuestion('qb'), createQuestion('qc'), createQuestion('qd'), createQuestion('qe')]
    mockPoolRef.current = [createQuestion('pool-1', 'common_sense'), createQuestion('pool-2', 'common_sense')]
    mockStatsRef.current = {
      'q-qa': { mastered: true },
      'q-qb': { mastered: true },
      'q-qc': { mastered: true },
      'q-qd': { mastered: true },
      'q-qe': { mastered: false },
    }

    useGameStore.getState().setPracticeQueue(queue)
    await useGameStore.getState().startNewGame()

    expect(useGameStore.getState().currentQuestion).toBe('q-qe')
    expect(useGameStore.getState().totalRounds).toBe(1)
    expect(useGameStore.getState().questionLoadError).toBeNull()
  })

  it('keeps last-round double time when available questions shrink total rounds', async () => {
    const useGameStore = await loadStore()
    mockPoolRef.current = [createQuestion('single')]

    await useGameStore.getState().startNewGame()

    expect(useGameStore.getState().totalRounds).toBe(1)
    expect(useGameStore.getState().currentMaxTime).toBe(300)
    expect(useGameStore.getState().timeLeft).toBe(300)
  })
})
