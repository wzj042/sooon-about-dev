export type GamePhase = 'ready' | 'question' | 'waiting' | 'result' | 'ended'
export type QuestionSelectionStrategy =
  | 'all_questions'
  | 'unseen_first'
  | 'mistake_focused'
  | 'slow_thinking_focused'
  | 'common_sense_only'
  | 'ethics_only'
  | 'unmastered_only'
  | 'mastered_only'
export type QuestionRandomMode = 'shuffled_cycle' | 'per_round_random'

export interface OpponentAI {
  accuracy: number
  speedMsRange: [number, number]
}

export interface OpponentState {
  avatar: string
  avatarFixed: boolean
  ai: OpponentAI
}

export interface AvatarData {
  svg: string
  style: string
  seed: string
  size?: number
  isFallback?: boolean
  timestamp?: number
}

export interface AnimationState {
  rankText: false | { text: string; timestamp: number }
  scoreAnimation: false | { score: number; isPlayer: boolean; timestamp: number }
  optionAnimations: boolean
  optionsExitAnimation: false | { timestamp: number }
}

export interface ButtonStates {
  options: string[]
  initialized: boolean
}

export interface RoundHistory {
  round: number
  question: string | null
  playerSelection: number | null
  opponentSelection: number | null
  playerCorrect: boolean | null
  opponentCorrect: boolean | null
  playerScore: number
  opponentScore: number
}

export interface QuestionItem {
  question: string
  options: string[]
  answer: number
  type?: string
  updatedAt?: string
}

export interface GameState {
  gamePhase: GamePhase
  currentRound: number
  totalRounds: number

  playerScore: number
  opponentScore: number
  maxScore: number

  currentQuestion: string | null
  questionOptions: string[]
  correctAnswer: number | null

  playerSelection: number | null
  opponentSelection: number | null
  playerCorrect: boolean | null
  opponentCorrect: boolean | null
  bothSelected: boolean

  timeLeft: number
  maxTime: number
  currentMaxTime: number
  timerRunning: boolean
  timeDecrement: number

  animations: AnimationState
  buttonStates: ButtonStates
  history: RoundHistory[]

  opponent: OpponentState
  aiSpeedRange: [number, number]
  aiAccuracy: number
  questionSelectionStrategy: QuestionSelectionStrategy
  questionSelectionCommonSenseType: string
  questionRandomMode: QuestionRandomMode
  practiceQueueMode: boolean
  practiceQueueTotal: number
  practiceQueuePracticed: number

  questionLoadError: string | null
}

export interface GameActions {
  startNewGame(): Promise<void>
  startRound(round: number): Promise<void>
  activateQuestion(): void
  selectAnswer(optionIndex: number): void
  simulateOpponentAnswer(): void
  showResults(): void
  nextRound(): void
  endGame(): void
  configureOpponent(config: Partial<OpponentState>): void
  setAvatarFixed(fixed: boolean): void
  updateAIConfig(params: { accuracy?: number; speedMsRange?: [number, number] }): void
  updateQuestionSelectionStrategy(strategy: QuestionSelectionStrategy): void
  updateQuestionSelectionCommonSenseType(type: string): void
  updateQuestionRandomMode(mode: QuestionRandomMode): void
  updatePracticeQueueFlowSettings(params: { autoNextDelayMs?: number; manualNextOnWrong?: boolean }): void
  continuePracticeQueueAfterReview(): void
  showRankText(text: string): void
  setPracticeQueue(questions: QuestionItem[], practicedCount?: number): void
  reset(): void
  destroy(): void
  debugSettle(mode?: number): void
}

export type GameStore = GameState & GameActions
