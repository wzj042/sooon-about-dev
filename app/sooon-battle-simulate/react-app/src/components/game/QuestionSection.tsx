import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Variants } from 'framer-motion'

import { optionListVariants, optionVariants, questionTextVariants } from '../../animations/motionPresets'
import { MOTION_EASE } from '../../animations/transitions'
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
  practiceMode: boolean
  optionWrapChars: number
  titleSpacingPx: number
  titleWrapChars: number
  onQuestionShown: () => void
  onSelect: (index: number) => void
}

const QUESTION_ACTIVATION_DELAY_MS = 850
const PRACTICE_QUESTION_ACTIVATION_DELAY_MS = 120

const practiceQuestionTextVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.14, ease: MOTION_EASE.inOut },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.95,
    transition: { duration: 0.12, ease: MOTION_EASE.inOut },
  },
}

const practiceOptionListVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      delayChildren: 0.04,
      staggerChildren: 0.03,
      staggerDirection: 1,
    },
  },
  exit: {
    y: -10,
    scale: 0.95,
    opacity: 0,
    transition: {
      duration: 0.12,
      ease: MOTION_EASE.inOut,
      staggerChildren: 0.02,
      staggerDirection: 1,
    },
  },
}

const practiceOptionVariants: Variants = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.16, ease: MOTION_EASE.inOut },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.1, ease: MOTION_EASE.inOut },
  },
}

function shouldShowOpponentResult(
  practiceMode: boolean,
  gamePhase: GamePhase,
  playerSelection: number | null,
  opponentSelection: number | null,
): boolean {
  if (practiceMode) return false
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
  practiceMode,
  optionWrapChars,
  titleSpacingPx,
  titleWrapChars,
  onQuestionShown,
  onSelect,
}: QuestionSectionProps) {
  const showOpponentResult = shouldShowOpponentResult(practiceMode, gamePhase, playerSelection, opponentSelection)
  const [optionsVisible, setOptionsVisible] = useState(true)
  const [roundContentVisible, setRoundContentVisible] = useState(true)
  const [questionShownNotified, setQuestionShownNotified] = useState(false)
  const questionShownNotifiedRef = useRef(false)
  const activationTimerRef = useRef<number | null>(null)

  const safeMaxScore = maxScore > 0 ? maxScore : 1
  const leftProgress = Math.min(100, Number(((playerScore / safeMaxScore) * 100).toFixed(3)))
  const rightProgress = Math.min(100, Number(((opponentScore / safeMaxScore) * 100).toFixed(3)))
  const normalizedTitleSpacingPx = normalizeTitleSpacingPx(titleSpacingPx)
  const renderedQuestionText = formatQuestionText(question ?? 'Loading question...', titleWrapChars)
  const questionActivationDelay = practiceMode ? PRACTICE_QUESTION_ACTIVATION_DELAY_MS : QUESTION_ACTIVATION_DELAY_MS
  const currentQuestionTextVariants = practiceMode ? practiceQuestionTextVariants : questionTextVariants
  const currentOptionListVariants = practiceMode ? practiceOptionListVariants : optionListVariants
  const currentOptionVariants = practiceMode ? practiceOptionVariants : optionVariants

  useEffect(() => {
    if (gamePhase === 'question' || gamePhase === 'waiting') {
      setOptionsVisible(true)
      setRoundContentVisible(true)
    }
  }, [gamePhase, question, options])

  useEffect(() => {
    if (activationTimerRef.current !== null) {
      window.clearTimeout(activationTimerRef.current)
      activationTimerRef.current = null
    }
    questionShownNotifiedRef.current = false
    setQuestionShownNotified(false)
  }, [question, options])

  useEffect(() => {
    return () => {
      if (activationTimerRef.current !== null) {
        window.clearTimeout(activationTimerRef.current)
        activationTimerRef.current = null
      }
    }
  }, [])

  const scheduleQuestionShown = useCallback(() => {
    if (questionShownNotifiedRef.current) return
    questionShownNotifiedRef.current = true
    setQuestionShownNotified(true)

    if (activationTimerRef.current !== null) {
      window.clearTimeout(activationTimerRef.current)
    }
    activationTimerRef.current = window.setTimeout(() => {
      activationTimerRef.current = null
      onQuestionShown()
    }, questionActivationDelay)
  }, [onQuestionShown, questionActivationDelay])

  useEffect(() => {
    if (gamePhase !== 'waiting') return
    if (questionShownNotified) return

    scheduleQuestionShown()
  }, [gamePhase, questionShownNotified, scheduleQuestionShown])

  useEffect(() => {
    if (optionsExitAnimationTimestamp === null) return
    if (practiceMode) {
      // In practice mode, let title and options leave together to avoid title-only drop.
      setRoundContentVisible(false)
      setOptionsVisible(false)
      return
    }
    setOptionsVisible(false)
  }, [optionsExitAnimationTimestamp, practiceMode])

  return (
    <div className="question-section" style={{ display: gamePhase === 'ended' ? 'none' : '' }}>
      {!practiceMode ? (
        <div className="progress-bar left-progress">
          <div className="progress-fill" id="left-progress-fill" style={{ height: `${leftProgress}%` }} />
        </div>
      ) : null}

      <div className="question-content">
        <AnimatePresence mode={practiceMode ? 'sync' : 'wait'}>
          {roundContentVisible ? (
            <motion.div
              key={question ?? 'question-loading'}
              animate="animate"
              className="question-text"
              exit="exit"
              initial="initial"
              style={{ marginBottom: `calc(${normalizedTitleSpacingPx}px * var(--scale-factor))` }}
              variants={currentQuestionTextVariants}
            >
              {renderedQuestionText}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {roundContentVisible && optionsVisible ? (
            <motion.div
              key={question ?? 'question-loading'}
              animate="animate"
              className={`options-container ${playerSelection !== null ? 'has-selection' : ''}`.trim()}
              exit="exit"
              initial="initial"
              variants={currentOptionListVariants}
            >
              {options.map((option, index) => {
                const isSelected = playerSelection === index
                const isCorrectOption = correctAnswer === index
                const isWrongSelected = isSelected && playerCorrect === false
                const revealCorrect =
                  ((gamePhase === 'result' || gamePhase === 'ended') || (practiceMode && playerSelection !== null && playerCorrect === false)) &&
                  isCorrectOption
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
                const showPracticeCorrectIcon =
                  practiceMode && revealCorrect && playerSelection !== index && playerCorrect === false
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
                    variants={currentOptionVariants}
                    onClick={() => {
                      if (!disabled) onSelect(index)
                    }}
                  >
                    {isSelected && playerCorrect !== null ? <PlayerSelectionIcon isCorrect={Boolean(playerCorrect)} /> : null}
                    {showPracticeCorrectIcon ? <PlayerSelectionIcon isCorrect /> : null}
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

      {!practiceMode ? (
        <div className="progress-bar right-progress">
          <div className="progress-fill" id="right-progress-fill" style={{ height: `${rightProgress}%` }} />
        </div>
      ) : null}
    </div>
  )
}
