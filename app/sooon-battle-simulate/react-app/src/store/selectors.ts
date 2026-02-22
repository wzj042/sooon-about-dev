import type { GameStore } from '../domain/types'

export const selectScoreState = (state: GameStore) => ({
  playerScore: state.playerScore,
  opponentScore: state.opponentScore,
  maxScore: state.maxScore,
})

export const selectQuestionState = (state: GameStore) => ({
  currentQuestion: state.currentQuestion,
  questionOptions: state.questionOptions,
  playerSelection: state.playerSelection,
  opponentSelection: state.opponentSelection,
  playerCorrect: state.playerCorrect,
  opponentCorrect: state.opponentCorrect,
  correctAnswer: state.correctAnswer,
  gamePhase: state.gamePhase,
})
