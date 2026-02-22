import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { optionListVariants, optionVariants, questionTextVariants } from '../../animations/motionPresets'
import {
  DEFAULT_OPTION_WRAP_CHARS,
  DEFAULT_TITLE_WRAP_CHARS,
  normalizeOptionWrapChars,
  normalizeTitleSpacingPx,
  normalizeTitleWrapChars,
} from '../../domain/validation'
import type { GamePhase } from '../../domain/types'

interface QuestionSectionProps {
  question: string | null
  options: string[]
  playerSelection: number | null
  opponentSelection: number | null
  playerCorrect: boolean | null
  opponentCorrect: boolean | null
  correctAnswer: number | null
  gamePhase: GamePhase
  optionsExitAnimationTimestamp: number | null
  playerScore: number
  opponentScore: number
  maxScore: number
  optionWrapChars: number
  titleSpacingPx: number
  titleWrapChars: number
  onQuestionShown: () => void
  onSelect: (index: number) => void
}

function shouldShowOpponentResult(
  gamePhase: GamePhase,
  playerSelection: number | null,
  opponentSelection: number | null,
): boolean {
  if (opponentSelection === null) return false
  if (playerSelection !== null) return true
  return gamePhase === 'result' || gamePhase === 'ended'
}

function formatTextByWrapChars(text: string, wrapChars: number): string {
  const codePoints = Array.from(text)
  if (codePoints.length <= wrapChars) {
    return text
  }

  const lines: string[] = []
  for (let index = 0; index < codePoints.length; index += wrapChars) {
    lines.push(codePoints.slice(index, index + wrapChars).join(''))
  }

  return lines.join('\n')
}

function formatOptionText(text: string, wrapChars: number): string {
  const normalizedWrapChars = normalizeOptionWrapChars(wrapChars || DEFAULT_OPTION_WRAP_CHARS)
  return formatTextByWrapChars(text, normalizedWrapChars)
}

function formatQuestionText(text: string, wrapChars: number): string {
  const normalizedWrapChars = normalizeTitleWrapChars(wrapChars || DEFAULT_TITLE_WRAP_CHARS)
  if (normalizedWrapChars <= 0) {
    return text
  }

  return formatTextByWrapChars(text, normalizedWrapChars)
}

function OpponentResultIcon({ isCorrect }: { isCorrect: boolean }) {
  return (
    <svg aria-hidden="true" height="24" viewBox="0 0 24 24" width="24">
      {isCorrect ? (
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      ) : (
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
      )}
    </svg>
  )
}

function PlayerSelectionIcon({ isCorrect }: { isCorrect: boolean }) {
  return (
    <div className={`player-selection-icon ${isCorrect ? 'correct' : 'incorrect'}`}>
      <svg aria-hidden="true" height="24" viewBox="0 0 24 24" width="24">
        {isCorrect ? (
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        ) : (
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        )}
      </svg>
    </div>
  )
}

export function QuestionSection({
  question,
  options,
  playerSelection,
  opponentSelection,
  playerCorrect,
  opponentCorrect,
  correctAnswer,
  gamePhase,
  optionsExitAnimationTimestamp,
  playerScore,
  opponentScore,
  maxScore,
  optionWrapChars,
  titleSpacingPx,
  titleWrapChars,
  onQuestionShown,
  onSelect,
}: QuestionSectionProps) {
  const showOpponentResult = shouldShowOpponentResult(gamePhase, playerSelection, opponentSelection)
  const [optionsVisible, setOptionsVisible] = useState(true)
  const [questionShownNotified, setQuestionShownNotified] = useState(false)
  const [previousScores, setPreviousScores] = useState({
    player: playerScore,
    opponent: opponentScore,
  })

  const safeMaxScore = maxScore > 0 ? maxScore : 1
  const leftProgress = Math.min(100, Number(((playerScore / safeMaxScore) * 100).toFixed(3)))
  const rightProgress = Math.min(100, Number(((opponentScore / safeMaxScore) * 100).toFixed(3)))
  const leftProgressClassName = previousScores.player !== playerScore ? 'progress-fill' : 'progress-fill no-transition'
  const rightProgressClassName = previousScores.opponent !== opponentScore ? 'progress-fill' : 'progress-fill no-transition'
  const normalizedTitleSpacingPx = normalizeTitleSpacingPx(titleSpacingPx)
  const renderedQuestionText = formatQuestionText(question ?? 'Loading question...', titleWrapChars)

  useEffect(() => {
    if (gamePhase === 'question' || gamePhase === 'waiting') {
      setOptionsVisible(true)
    }
  }, [gamePhase, question, options])

  useEffect(() => {
    setQuestionShownNotified(false)
  }, [question, options])

  useEffect(() => {
    if (gamePhase !== 'waiting') return
    if (options.length > 0) return
    if (questionShownNotified) return

    setQuestionShownNotified(true)
    onQuestionShown()
  }, [gamePhase, onQuestionShown, options.length, questionShownNotified])

  useEffect(() => {
    if (optionsExitAnimationTimestamp === null) return
    setOptionsVisible(false)
  }, [optionsExitAnimationTimestamp])

  useEffect(() => {
    setPreviousScores({
      player: playerScore,
      opponent: opponentScore,
    })
  }, [opponentScore, playerScore])

  return (
    <div className="question-section" style={{ display: gamePhase === 'ended' ? 'none' : '' }}>
      <div className="progress-bar left-progress">
        <div className={leftProgressClassName} id="left-progress-fill" style={{ height: `${leftProgress}%` }} />
      </div>

      <div className="question-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={question ?? 'question-loading'}
            animate="animate"
            className="question-text"
            exit="exit"
            initial="initial"
            style={{ marginBottom: `calc(${normalizedTitleSpacingPx}px * var(--scale-factor))` }}
            variants={questionTextVariants}
          >
            {renderedQuestionText}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {optionsVisible ? (
            <motion.div
              key={question ?? 'question-loading'}
              animate="animate"
              className={`options-container ${playerSelection !== null ? 'has-selection' : ''}`.trim()}
              exit="exit"
              initial="initial"
              variants={optionListVariants}
            >
              {options.map((option, index) => {
                const isSelected = playerSelection === index
                const isCorrectOption = correctAnswer === index
                const isWrongSelected = isSelected && playerCorrect === false
                const revealCorrect = (gamePhase === 'result' || gamePhase === 'ended') && isCorrectOption
                const disabled = playerSelection !== null || gamePhase !== 'question'
                const renderedOptionText = formatOptionText(option, optionWrapChars)

                const classNames = [
                  'option',
                  isSelected ? 'selected' : '',
                  isWrongSelected ? 'wrong' : '',
                  revealCorrect ? 'correct' : '',
                  disabled ? 'disabled' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                const showOpponentIcon = showOpponentResult && opponentSelection === index && opponentCorrect !== null
                const opponentClassName = [
                  'opponent-result',
                  showOpponentIcon ? 'show' : '',
                  showOpponentIcon ? (opponentCorrect ? 'correct' : 'incorrect') : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <motion.div
                    key={`${question ?? 'question-loading'}-${index}`}
                    className={classNames}
                    data-option={index + 1}
                    variants={optionVariants}
                    onAnimationComplete={(definition) => {
                      if (definition !== 'animate') return
                      if (index !== options.length - 1) return
                      if (gamePhase !== 'waiting') return
                      if (questionShownNotified) return

                      setQuestionShownNotified(true)
                      onQuestionShown()
                    }}
                    onClick={() => {
                      if (!disabled) onSelect(index)
                    }}
                  >
                    {isSelected && playerCorrect !== null ? <PlayerSelectionIcon isCorrect={Boolean(playerCorrect)} /> : null}
                    <div className="option-text">{renderedOptionText}</div>
                    <div className={opponentClassName} data-option={index + 1}>
                      {showOpponentIcon ? <OpponentResultIcon isCorrect={opponentCorrect} /> : null}
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="progress-bar right-progress">
        <div className={rightProgressClassName} id="right-progress-fill" style={{ height: `${rightProgress}%` }} />
      </div>
    </div>
  )
}
