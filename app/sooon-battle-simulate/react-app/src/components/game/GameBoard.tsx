import { AnimatePresence, motion } from 'framer-motion'

import { rankTextVariants } from '../../animations/motionPresets'
import type { GameStore } from '../../domain/types'
import { EndScreen } from './EndScreen'
import { QuestionSection } from './QuestionSection'
import { ScoreFlyAnimation } from './ScoreFlyAnimation'
import { ScoreHeader } from './ScoreHeader'

interface GameBoardProps {
  state: Pick<
    GameStore,
    | 'playerScore'
    | 'opponentScore'
    | 'timeLeft'
    | 'currentMaxTime'
    | 'opponent'
    | 'animations'
    | 'currentQuestion'
    | 'questionOptions'
    | 'playerSelection'
    | 'opponentSelection'
    | 'playerCorrect'
    | 'opponentCorrect'
    | 'correctAnswer'
    | 'gamePhase'
    | 'maxScore'
    | 'practiceQueueMode'
    | 'practiceQueueTotal'
    | 'practiceQueuePracticed'
  >
  playerAvatarHtml: string
  playerId: string
  opponentId: string
  optionWrapChars: number
  titleSpacingPx: number
  titleWrapChars: number
  autoSkipEndScreen: boolean
  onSelectOption: (index: number) => void
  onQuestionShown: () => void
  onClickPlayerAvatar: () => void
  onClickOpponentAvatar: () => void
  onToggleAutoSkipEndScreen: (enabled: boolean) => void
  onContinue: () => void
}

export function GameBoard({
  state,
  playerAvatarHtml,
  playerId,
  opponentId,
  optionWrapChars,
  titleSpacingPx,
  titleWrapChars,
  autoSkipEndScreen,
  onSelectOption,
  onQuestionShown,
  onClickPlayerAvatar,
  onClickOpponentAvatar,
  onToggleAutoSkipEndScreen,
  onContinue,
}: GameBoardProps) {
  const isGameEnded = state.gamePhase === 'ended'

  return (
    <div className="quiz-container">
      <ScoreFlyAnimation scoreAnimation={state.animations.scoreAnimation} />

      <ScoreHeader
        currentMaxTime={state.currentMaxTime}
        opponent={state.opponent}
        opponentId={opponentId}
        opponentScore={state.opponentScore}
        playerAvatarHtml={playerAvatarHtml}
        playerId={playerId}
        playerScore={state.playerScore}
        timeLeft={state.timeLeft}
        onClickOpponentAvatar={onClickOpponentAvatar}
        onClickPlayerAvatar={onClickPlayerAvatar}
      />

      <AnimatePresence mode="wait">
        {state.animations.rankText ? (
          <motion.div
            key={state.animations.rankText.timestamp}
            animate="animate"
            className="rank-text"
            exit="exit"
            id="rank-text"
            initial="initial"
            variants={rankTextVariants}
          >
            {state.animations.rankText.text}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <QuestionSection
        correctAnswer={state.correctAnswer}
        gamePhase={state.gamePhase}
        maxScore={state.maxScore}
        optionsExitAnimationTimestamp={
          state.animations.optionsExitAnimation === false ? null : state.animations.optionsExitAnimation.timestamp
        }
        opponentCorrect={state.opponentCorrect}
        opponentScore={state.opponentScore}
        opponentSelection={state.opponentSelection}
        options={state.questionOptions}
        playerCorrect={state.playerCorrect}
        playerScore={state.playerScore}
        playerSelection={state.playerSelection}
        question={state.currentQuestion}
        optionWrapChars={optionWrapChars}
        titleSpacingPx={titleSpacingPx}
        titleWrapChars={titleWrapChars}
        onQuestionShown={onQuestionShown}
        onSelect={onSelectOption}
      />

      <EndScreen
        autoSkipEndScreen={autoSkipEndScreen}
        opponentScore={state.opponentScore}
        playerScore={state.playerScore}
        practiceQueueMode={state.practiceQueueMode}
        practiceQueuePracticed={state.practiceQueuePracticed}
        practiceQueueTotal={state.practiceQueueTotal}
        visible={isGameEnded}
        onToggleAutoSkipEndScreen={onToggleAutoSkipEndScreen}
        onContinue={onContinue}
      />
    </div>
  )
}
