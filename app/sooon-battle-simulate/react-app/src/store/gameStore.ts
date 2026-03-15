import { create } from 'zustand'

import { DEFAULT_AVATAR_SRC } from '../domain/avatar'
import { calculateScore } from '../domain/scoring'
import type { AnimationState, GameStore, OpponentState, QuestionItem, QuestionRandomMode, QuestionSelectionStrategy, RoundHistory } from '../domain/types'
import { generateRandomAvatar } from '../services/avatarService'
import { buildRoundQuestion, loadQuestionBank, shuffle } from '../services/questionBank'
import { buildQuestionSelectionPool } from '../services/questionSelection'
import { loadQuestionStatsMap, recordQuestionAttempt } from '../services/questionStats'
import { TimerRegistry } from './timers'

const DEFAULT_TOTAL_ROUNDS = 5
const TIMER_TICK_MS = 80
const DEFAULT_MAX_SCORE = 900
const DEFAULT_QUESTION_SELECTION_STRATEGY: QuestionSelectionStrategy = 'all_questions'
const DEFAULT_QUESTION_RANDOM_MODE: QuestionRandomMode = 'shuffled_cycle'
const DEFAULT_PRACTICE_QUEUE_AUTO_NEXT_DELAY_MS = 1000
const DEFAULT_PRACTICE_QUEUE_MANUAL_NEXT_ON_WRONG = false
const PRACTICE_QUEUE_MANUAL_ADVANCE_DELAY_MS = 140
const FAST_RESULT_DELAY_MS = 280
const FAST_WRONG_RESULT_DELAY_MS = 650

const getDefaultAnimations = (): AnimationState => ({
  rankText: false,
  scoreAnimation: false,
  optionAnimations: false,
  optionsExitAnimation: false,
})

const DEFAULT_OPPONENT: OpponentState = {
  avatar: DEFAULT_AVATAR_SRC,
  avatarFixed: false,
  ai: {
    accuracy: 0.5,
    speedMsRange: [750, 1200],
  },
}

const DEFAULT_STATE = {
  gamePhase: 'ready' as const,
  currentRound: 1,
  totalRounds: DEFAULT_TOTAL_ROUNDS,

  playerScore: 0,
  opponentScore: 0,
  maxScore: DEFAULT_MAX_SCORE,

  currentQuestion: null,
  questionOptions: [] as string[],
  correctAnswer: null,

  playerSelection: null,
  opponentSelection: null,
  playerCorrect: null,
  opponentCorrect: null,
  bothSelected: false,

  timeLeft: 150,
  maxTime: 150,
  currentMaxTime: 150,
  timerRunning: false,

  animations: getDefaultAnimations(),
  buttonStates: {
    options: [] as string[],
    initialized: false,
  },
  history: [] as RoundHistory[],

  opponent: DEFAULT_OPPONENT,
  aiSpeedRange: [1280, 2900] as [number, number],
  aiAccuracy: 0.6,
  questionSelectionStrategy: DEFAULT_QUESTION_SELECTION_STRATEGY,
  questionSelectionCommonSenseType: '',
  questionRandomMode: DEFAULT_QUESTION_RANDOM_MODE,
  practiceQueueMode: false,
  practiceQueueTotal: 0,
  practiceQueuePracticed: 0,

  questionLoadError: null as string | null,
}

function normalizeQueueCursor(cursor: number, length: number): number {
  if (!Number.isFinite(cursor) || length <= 0) return 0
  const normalized = Math.floor(cursor) % length
  return normalized >= 0 ? normalized : normalized + length
}

function rotateByCursor<T>(items: T[], cursor: number): T[] {
  if (items.length <= 1) return [...items]
  const offset = normalizeQueueCursor(cursor, items.length)
  if (offset === 0) return [...items]
  return [...items.slice(offset), ...items.slice(0, offset)]
}

export const useGameStore = create<GameStore>((set, get) => {
  const timers = new TimerRegistry()

  let questionBank: QuestionItem[] = []
  let selectedQuestions: QuestionItem[] = []
  let questionSelectionPool: QuestionItem[] = []
  let practiceQueueQuestions: QuestionItem[] = []
  let practiceQueueCursor = 0
  let practiceQueueProgress = 0
  let practiceQueueAutoNextDelayMs = DEFAULT_PRACTICE_QUEUE_AUTO_NEXT_DELAY_MS
  let practiceQueueManualNextOnWrong = DEFAULT_PRACTICE_QUEUE_MANUAL_NEXT_ON_WRONG

  let timerIntervalId: number | null = null
  let opponentTimeoutId: number | null = null
  let resultTimeoutId: number | null = null

  const clearOpponentTimeout = () => {
    timers.clearTrackedTimeout(opponentTimeoutId)
    opponentTimeoutId = null
  }

  const stopTimer = () => {
    timers.clearTrackedInterval(timerIntervalId)
    timerIntervalId = null
    set({ timerRunning: false })
  }

  const triggerScoreAnimation = (score: number, isPlayer: boolean) => {
    if (!Number.isFinite(score) || score <= 0) return

    set((state) => ({
      animations: {
        ...state.animations,
        scoreAnimation: { score, isPlayer, timestamp: Date.now() },
      },
    }))
  }

  const showRoundText = (text: string) => {
    set((state) => ({
      animations: {
        ...state.animations,
        rankText: {
          text,
          timestamp: Date.now(),
        },
      },
    }))
  }

  const ensureQuestionsPrepared = async (count: number) => {
    const requiredCount = Math.max(1, Math.floor(count))

    if (practiceQueueQuestions.length > 0) {
      const used = new Set<string>()
      const queueWindow = rotateByCursor(practiceQueueQuestions, practiceQueueCursor)
      const preferred = queueWindow.filter((item) => {
        if (used.has(item.question)) return false
        used.add(item.question)
        return true
      })

      selectedQuestions = preferred.slice(0, requiredCount)
      questionSelectionPool = selectedQuestions
      set({
        questionLoadError: selectedQuestions.length === 0 ? 'No practiceable items in queue. Please re-filter in Question Bank.' : null,
      })

      if (selectedQuestions.length > 0 && selectedQuestions.length !== get().totalRounds) {
        set({ totalRounds: selectedQuestions.length })
      }

      return
    }

    if (questionBank.length === 0) {
      try {
        questionBank = await loadQuestionBank()
        set({ questionLoadError: null })
      } catch (error) {
        questionBank = []
        set({ questionLoadError: error instanceof Error ? error.message : 'Failed to load question bank' })
      }
    }

    if (questionBank.length === 0) {
      selectedQuestions = []
      questionSelectionPool = []
      return
    }

    const state = get()
    questionSelectionPool = buildQuestionSelectionPool(
      questionBank,
      state.questionSelectionStrategy,
      loadQuestionStatsMap(),
      state.questionSelectionCommonSenseType,
    )

    if (questionSelectionPool.length === 0) {
      selectedQuestions = []
      set({ questionLoadError: '当前答题策略下没有可用题目，请切换策略。' })
      return
    }

    set({ questionLoadError: null })

    if (state.questionRandomMode === 'per_round_random') {
      selectedQuestions = []
      return
    }

    selectedQuestions = shuffle(questionSelectionPool).slice(0, requiredCount)
    if (selectedQuestions.length > 0 && selectedQuestions.length < requiredCount) {
      set({ totalRounds: selectedQuestions.length })
    }
  }

  const getRoundQuestion = (round: number): { question: string; options: string[]; correctAnswer: number } | null => {
    if (practiceQueueQuestions.length === 0 && get().questionRandomMode === 'per_round_random') {
      if (questionSelectionPool.length === 0) return null
      const randomIndex = Math.floor(Math.random() * questionSelectionPool.length)
      return buildRoundQuestion(questionSelectionPool[randomIndex])
    }

    if (selectedQuestions.length === 0) return null

    const index = (round - 1) % selectedQuestions.length
    return buildRoundQuestion(selectedQuestions[index])
  }

  const maybeGoNext = () => {
    const state = get()
    if (state.currentRound < state.totalRounds) {
      get().nextRound()
      return
    }

    get().endGame()
  }

  const showResultsInternal = (forcePracticeAdvance = false) => {
    const state = get()
    if (state.gamePhase !== 'question') return

    stopTimer()
    clearOpponentTimeout()

    const roundResult: RoundHistory = {
      round: state.currentRound,
      question: state.currentQuestion,
      playerSelection: state.playerSelection,
      opponentSelection: state.opponentSelection,
      playerCorrect: state.playerCorrect,
      opponentCorrect: state.opponentCorrect,
      playerScore: state.playerScore,
      opponentScore: state.opponentScore,
    }

    if (state.currentQuestion) {
      const elapsedTicks = Math.max(0, state.currentMaxTime - state.timeLeft)
      const responseMs = elapsedTicks * TIMER_TICK_MS

      recordQuestionAttempt({
        question: state.currentQuestion,
        answered: state.playerSelection !== null,
        correct: state.playerCorrect === true,
        responseMs,
      })
    }

    const queuePracticedInSession = state.practiceQueueMode ? practiceQueueProgress + state.currentRound : 0

    set((current) => ({
      gamePhase: 'result',
      history: [...current.history, roundResult],
      practiceQueuePracticed: queuePracticedInSession,
      animations: {
        ...current.animations,
        optionsExitAnimation: { timestamp: Date.now() },
      },
    }))

    timers.clearTrackedTimeout(resultTimeoutId)
    if (state.practiceQueueMode) {
      if (state.playerCorrect === false && practiceQueueManualNextOnWrong && !forcePracticeAdvance) {
        resultTimeoutId = null
        return
      }
      resultTimeoutId = timers.setTrackedTimeout(() => {
        maybeGoNext()
      }, forcePracticeAdvance ? PRACTICE_QUEUE_MANUAL_ADVANCE_DELAY_MS : Math.max(0, practiceQueueAutoNextDelayMs))
      return
    }
    resultTimeoutId = timers.setTrackedTimeout(() => {
      maybeGoNext()
    }, state.playerCorrect === false ? FAST_WRONG_RESULT_DELAY_MS : FAST_RESULT_DELAY_MS)
  }

  const timeUpInternal = () => {
    const state = get()
    if (state.gamePhase !== 'question') return

    stopTimer()
    clearOpponentTimeout()

    set((current) => ({
      timeLeft: 0,
      playerCorrect: current.playerSelection === null ? false : current.playerCorrect,
      opponentCorrect: current.opponentSelection === null ? false : current.opponentCorrect,
    }))

    showResultsInternal()
  }

  const startTimerInternal = () => {
    stopTimer()

    set({ timerRunning: true })

    timerIntervalId = timers.setTrackedInterval(() => {
      const current = get()

      if (current.gamePhase !== 'question') {
        stopTimer()
        return
      }

      if (current.timeLeft > 0) {
        set({ timeLeft: Math.max(0, current.timeLeft - 1) })
        return
      }

      timeUpInternal()
    }, TIMER_TICK_MS)
  }

  const checkBothSelected = () => {
    const state = get()
    const playerSelected = state.playerSelection !== null
    const opponentSelected = state.opponentSelection !== null
    const resultDelayMs = state.playerCorrect === false ? FAST_WRONG_RESULT_DELAY_MS : FAST_RESULT_DELAY_MS

    if (state.practiceQueueMode && playerSelected) {
      stopTimer()
      clearOpponentTimeout()
      timers.clearTrackedTimeout(resultTimeoutId)
      resultTimeoutId = null
      if (state.playerCorrect === false && practiceQueueManualNextOnWrong) {
        return
      }
      showResultsInternal()
      return
    }

    if (playerSelected && opponentSelected) {
      stopTimer()
      timers.clearTrackedTimeout(resultTimeoutId)
      resultTimeoutId = timers.setTrackedTimeout(() => {
        showResultsInternal()
      }, resultDelayMs)
      return
    }

    if (playerSelected && !opponentSelected) {
      const currentStore = get()
      currentStore.simulateOpponentAnswer()
    }
  }

  const simulateOpponentAnswerInternal = () => {
    const state = get()
    if (state.gamePhase !== 'question') return
    if (state.practiceQueueMode) return
    if (state.opponentSelection !== null) return

    let choice = state.correctAnswer ?? 0
    const shouldCorrect = Math.random() < Math.max(0, Math.min(1, state.aiAccuracy))

    if (!shouldCorrect) {
      const wrongChoices = [0, 1, 2, 3].filter((index) => index !== state.correctAnswer)
      choice = wrongChoices[Math.floor(Math.random() * wrongChoices.length)]
    }

    const selectedText = state.questionOptions[choice]
    const correctText = state.questionOptions[state.correctAnswer ?? 0]
    const isCorrect = selectedText === correctText
    const score = calculateScore(isCorrect, state.timeLeft)

    set((current) => ({
      opponentSelection: choice,
      opponentCorrect: isCorrect,
      opponentScore: current.opponentScore + score,
    }))

    triggerScoreAnimation(score, false)
    checkBothSelected()
  }

  const waitForOpponentInternal = () => {
    const state = get()
    if (state.practiceQueueMode) return
    if (state.gamePhase !== 'question' || state.opponentSelection !== null) return
    if (opponentTimeoutId !== null) return

    const [minMs, maxMs] = state.aiSpeedRange
    const delay = Math.random() * (maxMs - minMs) + minMs

    opponentTimeoutId = timers.setTrackedTimeout(() => {
      opponentTimeoutId = null
      simulateOpponentAnswerInternal()
    }, delay)
  }

  const activateQuestionInternal = () => {
    const state = get()
    if (state.gamePhase !== 'waiting') return

    if (state.practiceQueueMode) {
      set({ gamePhase: 'question' })
      return
    }

    set({ gamePhase: 'question' })
    startTimerInternal()
    waitForOpponentInternal()
  }

  const startRoundInternal = async (round: number) => {
    stopTimer()
    clearOpponentTimeout()
    timers.clearTrackedTimeout(resultTimeoutId)

    const beforePrepare = get()
    await ensureQuestionsPrepared(beforePrepare.totalRounds)
    const current = get()

    const questionData = getRoundQuestion(round)
    if (!questionData) {
      set({
        gamePhase: 'ready',
        currentQuestion: null,
        questionOptions: [],
        correctAnswer: null,
        playerSelection: null,
        opponentSelection: null,
        playerCorrect: null,
        opponentCorrect: null,
        bothSelected: false,
        timerRunning: false,
        buttonStates: {
          options: [],
          initialized: false,
        },
      })
      return
    }

    const isFinalRound = round === current.totalRounds
    const timeForRound = isFinalRound ? current.maxTime * 2 : current.maxTime

    set((state) => ({
      currentRound: round,
      currentQuestion: questionData.question,
      questionOptions: questionData.options,
      correctAnswer: questionData.correctAnswer,
      gamePhase: 'waiting',
      playerSelection: null,
      opponentSelection: null,
      playerCorrect: null,
      opponentCorrect: null,
      bothSelected: false,
      timeLeft: timeForRound,
      currentMaxTime: timeForRound,
      timerRunning: false,
      buttonStates: {
        options: questionData.options,
        initialized: true,
      },
      animations: {
        ...state.animations,
        optionAnimations: true,
        optionsExitAnimation: false,
      },
    }))

    const roundText = isFinalRound ? '最后一题，双倍得分' : `第 ${round} 题`
    showRoundText(roundText)

  }

  const startNewGameInternal = async () => {
    stopTimer()
    clearOpponentTimeout()
    timers.clearTrackedTimeout(resultTimeoutId)

    const state = get()

    if (state.practiceQueueMode && practiceQueueQuestions.length > 0 && state.gamePhase === 'ended') {
      const advancedBy = Math.max(0, Math.floor(state.practiceQueuePracticed))
      if (advancedBy > 0) {
        const delta = Math.max(0, advancedBy - practiceQueueProgress)
        practiceQueueCursor = normalizeQueueCursor(practiceQueueCursor + delta, practiceQueueQuestions.length)
        practiceQueueProgress += delta
      }
    }

    const resetTotalRounds = state.practiceQueueMode && practiceQueueQuestions.length > 0 ? Math.max(1, practiceQueueQuestions.length) : DEFAULT_TOTAL_ROUNDS

    set({
      gamePhase: 'ready',
      currentRound: 1,
      totalRounds: resetTotalRounds,
      playerScore: 0,
      opponentScore: 0,
      practiceQueuePracticed: state.practiceQueueMode ? practiceQueueProgress : 0,
      timeLeft: state.maxTime,
      currentMaxTime: state.maxTime,
      timerRunning: false,
      history: [],
      questionLoadError: null,
      animations: getDefaultAnimations(),
    })

    selectedQuestions = []
    questionSelectionPool = []
    if (!state.practiceQueueMode) {
      practiceQueueQuestions = []
    }

    if (!state.opponent.avatarFixed) {
      const avatar = await generateRandomAvatar()
      set((current) => ({
        opponent: {
          ...current.opponent,
          avatar: avatar.svg,
        },
      }))
    }

    await startRoundInternal(1)
  }

  return {
    ...DEFAULT_STATE,

    startNewGame: startNewGameInternal,

    startRound: async (round: number) => {
      await startRoundInternal(round)
    },

    activateQuestion: () => {
      activateQuestionInternal()
    },

    selectAnswer: (optionIndex: number) => {
      const state = get()
      if (state.gamePhase !== 'question') return
      if (state.playerSelection !== null) return
      if (optionIndex < 0 || optionIndex > 3) return

      const selectedText = state.questionOptions[optionIndex]
      const correctText = state.questionOptions[state.correctAnswer ?? 0]
      const isCorrect = selectedText === correctText
      const score = state.practiceQueueMode ? 0 : calculateScore(isCorrect, state.timeLeft)

      set((current) => ({
        playerSelection: optionIndex,
        playerCorrect: isCorrect,
        playerScore: current.playerScore + score,
      }))

      if (!state.practiceQueueMode) {
        triggerScoreAnimation(score, true)
      }
      checkBothSelected()
    },

    simulateOpponentAnswer: () => {
      waitForOpponentInternal()
    },

    showResults: () => {
      showResultsInternal()
    },

    nextRound: () => {
      const state = get()
      stopTimer()
      startRoundInternal(state.currentRound + 1).catch(() => {
        set({ questionLoadError: 'Failed to start next round' })
      })
    },

    endGame: () => {
      stopTimer()
      clearOpponentTimeout()
      timers.clearTrackedTimeout(resultTimeoutId)
      set({ gamePhase: 'ended' })
    },

    configureOpponent: (config) => {
      set((state) => {
        const next: OpponentState = {
          avatar: config.avatar ?? state.opponent.avatar,
          avatarFixed: typeof config.avatarFixed === 'boolean' ? config.avatarFixed : state.opponent.avatarFixed,
          ai: {
            accuracy: config.ai?.accuracy ?? state.opponent.ai.accuracy,
            speedMsRange: config.ai?.speedMsRange ?? state.opponent.ai.speedMsRange,
          },
        }

        return { opponent: next }
      })
    },

    setAvatarFixed: (fixed: boolean) => {
      set((state) => ({
        opponent: {
          ...state.opponent,
          avatarFixed: fixed,
        },
      }))
    },

    updateAIConfig: (params) => {
      set((state) => ({
        aiAccuracy: params.accuracy ?? state.aiAccuracy,
        aiSpeedRange: params.speedMsRange ?? state.aiSpeedRange,
        opponent: {
          ...state.opponent,
          ai: {
            accuracy: params.accuracy ?? state.opponent.ai.accuracy,
            speedMsRange: params.speedMsRange ?? state.opponent.ai.speedMsRange,
          },
        },
      }))
    },

    updateQuestionSelectionStrategy: (strategy) => {
      selectedQuestions = []
      questionSelectionPool = []
      set({
        questionSelectionStrategy: strategy,
      })
    },

    updateQuestionSelectionCommonSenseType: (type) => {
      selectedQuestions = []
      questionSelectionPool = []
      set({
        questionSelectionCommonSenseType: type.trim(),
      })
    },

    updateQuestionRandomMode: (mode) => {
      selectedQuestions = []
      questionSelectionPool = []
      set({
        questionRandomMode: mode,
      })
    },

    updatePracticeQueueFlowSettings: (params) => {
      if (typeof params.autoNextDelayMs === 'number' && Number.isFinite(params.autoNextDelayMs)) {
        practiceQueueAutoNextDelayMs = Math.max(0, Math.round(params.autoNextDelayMs))
      }
      if (typeof params.manualNextOnWrong === 'boolean') {
        practiceQueueManualNextOnWrong = params.manualNextOnWrong
      }
    },

    continuePracticeQueueAfterReview: () => {
      const state = get()
      if (!state.practiceQueueMode) return
      if (state.gamePhase !== 'question') return
      if (state.playerSelection === null) return
      showResultsInternal(true)
    },

    showRankText: (text) => {
      if (typeof text !== 'string' || text.trim().length === 0) return
      showRoundText(text.trim())
    },

    setPracticeQueue: (questions, practicedCount = 0) => {
      practiceQueueQuestions = questions
      practiceQueueCursor = 0
      practiceQueueProgress = Math.max(0, Math.floor(practicedCount))
      selectedQuestions = []
      questionSelectionPool = []
      const normalizedTotalRounds = Math.max(1, questions.length)
      set({
        totalRounds: normalizedTotalRounds,
        practiceQueueMode: questions.length > 0,
        practiceQueueTotal: questions.length > 0 ? questions.length : 0,
        practiceQueuePracticed: questions.length > 0 ? practiceQueueProgress : 0,
      })
    },

    reset: () => {
      stopTimer()
      clearOpponentTimeout()
      timers.clearTrackedTimeout(resultTimeoutId)

      const state = get()

      set({
        gamePhase: 'ready',
        currentRound: 1,
        totalRounds: DEFAULT_TOTAL_ROUNDS,
        playerScore: 0,
        opponentScore: 0,
        currentQuestion: null,
        questionOptions: [],
        correctAnswer: null,
        playerSelection: null,
        opponentSelection: null,
        playerCorrect: null,
        opponentCorrect: null,
        bothSelected: false,
        timeLeft: state.maxTime,
        currentMaxTime: state.maxTime,
        timerRunning: false,
        history: [],
        animations: getDefaultAnimations(),
        buttonStates: {
          options: [],
          initialized: false,
        },
        practiceQueueMode: false,
        practiceQueueTotal: 0,
        practiceQueuePracticed: 0,
        questionLoadError: null,
      })
      practiceQueueQuestions = []
      practiceQueueCursor = 0
      practiceQueueProgress = 0
      practiceQueueAutoNextDelayMs = DEFAULT_PRACTICE_QUEUE_AUTO_NEXT_DELAY_MS
      practiceQueueManualNextOnWrong = DEFAULT_PRACTICE_QUEUE_MANUAL_NEXT_ON_WRONG
      selectedQuestions = []
      questionSelectionPool = []
    },

    destroy: () => {
      get().reset()
      timers.clearAll()
      timerIntervalId = null
      opponentTimeoutId = null
      resultTimeoutId = null
    },

    debugSettle: (mode = 2) => {
      const state = get()
      let player = Number(state.playerScore) || 0
      let opponent = Number(state.opponentScore) || 0

      const delta = 10
      if (mode === 1) {
        if (player <= opponent) player = opponent + delta
      } else if (mode === 0) {
        if (opponent <= player) opponent = player + delta
      } else {
        const max = Math.max(player, opponent)
        player = max
        opponent = max
      }

      set({
        playerScore: player,
        opponentScore: opponent,
        gamePhase: 'ended',
      })
      stopTimer()
      clearOpponentTimeout()
      timers.clearTrackedTimeout(resultTimeoutId)
    },
  }
})
