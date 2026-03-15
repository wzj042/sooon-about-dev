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
  loadQuestionBank: vi.fn(async () => mockPoolRef.current),
  shuffle: vi.fn((items: QuestionItem[]) => items),
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
  isCommonSenseType: vi.fn((type?: string) => {
    const normalized = typeof type === 'string' ? type.trim().toLowerCase() : ''
    return normalized.length > 0 && normalized !== '素问' && normalized !== 'sooon_ai' && normalized !== 'ethics' && normalized !== '伦理'
  }),
  isEthicsType: vi.fn((type?: string) => {
    const normalized = typeof type === 'string' ? type.trim().toLowerCase() : ''
    return normalized === 'sooon_ai' || normalized === '素问' || normalized === '伦理'
  }),
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
    mockPoolRef.current = [createQuestion('suwen-a', '素问'), createQuestion('suwen-b', '素问')]

    useGameStore.getState().updateQuestionSelectionStrategy('common_sense_only')
    await useGameStore.getState().startNewGame()

    expect(useGameStore.getState().questionLoadError).toContain('当前答题策略下没有可用题目')
    expect(useGameStore.getState().gamePhase).toBe('ready')
    expect(useGameStore.getState().currentQuestion).toBeNull()
  })

  it('keeps mastered questions in queue practice instead of filtering them out', async () => {
    const useGameStore = await loadStore()
    const queue = [createQuestion('qa'), createQuestion('qb'), createQuestion('qc'), createQuestion('qd'), createQuestion('qe')]
    mockStatsRef.current = {
      'q-qa': { mastered: true },
      'q-qb': { mastered: true },
      'q-qc': { mastered: true },
      'q-qd': { mastered: true },
      'q-qe': { mastered: true },
    }

    useGameStore.getState().setPracticeQueue(queue)
    await useGameStore.getState().startNewGame()

    expect(useGameStore.getState().currentQuestion).toBe('q-qa')
    expect(useGameStore.getState().totalRounds).toBe(5)
    expect(useGameStore.getState().questionLoadError).toBeNull()
  })

  it('does not fall back to unrelated questions for mastered_only strategy', async () => {
    const useGameStore = await loadStore()
    mockPoolRef.current = [createQuestion('a'), createQuestion('b')]
    mockStatsRef.current = {
      'q-a': { mastered: false },
      'q-b': { mastered: false },
    }

    useGameStore.getState().updateQuestionSelectionStrategy('mastered_only')
    await useGameStore.getState().startNewGame()

    expect(useGameStore.getState().questionLoadError).toContain('当前答题策略下没有可用题目')
    expect(useGameStore.getState().gamePhase).toBe('ready')
    expect(useGameStore.getState().currentQuestion).toBeNull()
  })

  it('limits unmastered_only strategy to non-mastered questions', async () => {
    const useGameStore = await loadStore()
    mockPoolRef.current = [createQuestion('a'), createQuestion('b'), createQuestion('c')]
    mockStatsRef.current = {
      'q-a': { mastered: true },
      'q-b': { mastered: false },
      'q-c': { mastered: true },
    }

    useGameStore.getState().updateQuestionSelectionStrategy('unmastered_only')
    await useGameStore.getState().startNewGame()

    expect(useGameStore.getState().currentQuestion).toBe('q-b')
    expect(useGameStore.getState().totalRounds).toBe(1)
    expect(useGameStore.getState().questionLoadError).toBeNull()
  })

  it('limits common_sense_only strategy to the selected subtype', async () => {
    const useGameStore = await loadStore()
    mockPoolRef.current = [createQuestion('chemistry-a', '化学'), createQuestion('physics-a', '物理'), createQuestion('base', '常识'), createQuestion('suwen', '素问')]

    useGameStore.getState().updateQuestionSelectionStrategy('common_sense_only')
    useGameStore.getState().updateQuestionSelectionCommonSenseType('化学')
    await useGameStore.getState().startNewGame()

    expect(useGameStore.getState().currentQuestion).toBe('q-chemistry-a')
    expect(useGameStore.getState().totalRounds).toBe(1)
    expect(useGameStore.getState().questionLoadError).toBeNull()
  })

  it('keeps default rounds in per_round_random mode even when candidate pool is small', async () => {
    const useGameStore = await loadStore()
    mockPoolRef.current = [createQuestion('solo')]

    useGameStore.getState().updateQuestionRandomMode('per_round_random')
    await useGameStore.getState().startNewGame()

    expect(useGameStore.getState().currentQuestion).toBe('q-solo')
    expect(useGameStore.getState().totalRounds).toBe(5)
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
