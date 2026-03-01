export type GamePhase = 'ready' | 'question' | 'waiting' | 'result' | 'ended'
export type QuestionSelectionStrategy =
  | 'repeatable_random'
  | 'shuffled_traversal_recent_first'
  | 'unseen_first'
  | 'mistake_focused'
  | 'slow_thinking_focused'
  | 'common_sense_only'
  | 'ethics_only'
  | 'mastered_only'

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

  animations: AnimationState
  buttonStates: ButtonStates
  history: RoundHistory[]

  opponent: OpponentState
  aiSpeedRange: [number, number]
  aiAccuracy: number
  questionSelectionStrategy: QuestionSelectionStrategy
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
  setPracticeQueue(questions: QuestionItem[], practicedCount?: number): void
  reset(): void
  destroy(): void
  debugSettle(mode?: number): void
}

export type GameStore = GameState & GameActions
