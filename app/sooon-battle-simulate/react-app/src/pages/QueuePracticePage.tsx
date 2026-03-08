import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'

import { APP_ROUTES } from '../app/paths'
import { DisplaySettingsFields } from '../components/settings/DisplaySettingsFields'
import { GameBoard } from '../components/game/GameBoard'
import { AppLayout } from '../components/layout/AppLayout'
import { Modal } from '../components/shared/Modal'
import { DEFAULT_AVATAR_SRC } from '../domain/avatar'
import {
  normalizeOptionWrapChars,
  normalizeTitleSpacingPx,
  normalizeTitleWrapChars,
  sanitizeDigitsInput,
} from '../domain/validation'
import { loadPracticeQueueSettings, savePracticeQueueSettings } from '../services/practiceQueueSettings'
import {
  advanceLastPracticeQueueProgress,
  consumePracticeQueue,
  loadLastPracticeQueueSession,
  MIN_PRACTICE_QUEUE_ITEMS,
  saveLastPracticeQueueSession,
} from '../services/practiceQueue'
import { getQuestionStat, loadQuestionStatsMap, setQuestionMastered } from '../services/questionStats'
import { detachDebugSettle, attachDebugSettle } from '../store/actions/debug'
import { useGameStore } from '../store/gameStore'

function rotateQueueByCursor<T>(list: T[], cursor: number): T[] {
  if (list.length <= 1) return [...list]
  const offset = ((Math.floor(cursor) % list.length) + list.length) % list.length
  if (offset === 0) return [...list]
  return [...list.slice(offset), ...list.slice(0, offset)]
}

function onlyNumericKeyboard(event: ReactKeyboardEvent<HTMLInputElement>) {
  const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (allowed.includes(event.key)) return

  if (!/^[0-9]$/.test(event.key)) {
    event.preventDefault()
  }
}

export function QueuePracticePage() {
  const gameState = useGameStore(
    useShallow((state) => ({
      playerScore: state.playerScore,
      opponentScore: state.opponentScore,
      timeLeft: state.timeLeft,
      currentMaxTime: state.currentMaxTime,
      opponent: state.opponent,
      animations: state.animations,
      currentQuestion: state.currentQuestion,
      questionOptions: state.questionOptions,
      playerSelection: state.playerSelection,
      opponentSelection: state.opponentSelection,
      playerCorrect: state.playerCorrect,
      opponentCorrect: state.opponentCorrect,
      correctAnswer: state.correctAnswer,
      gamePhase: state.gamePhase,
      maxScore: state.maxScore,
      practiceQueueMode: state.practiceQueueMode,
      practiceQueueTotal: state.practiceQueueTotal,
      practiceQueuePracticed: state.practiceQueuePracticed,
      questionLoadError: state.questionLoadError,
    })),
  )

  const startNewGame = useGameStore((state) => state.startNewGame)
  const currentRound = useGameStore((state) => state.currentRound)
  const activateQuestion = useGameStore((state) => state.activateQuestion)
  const selectAnswer = useGameStore((state) => state.selectAnswer)
  const setPracticeQueue = useGameStore((state) => state.setPracticeQueue)
  const [bootError, setBootError] = useState<string | null>(null)
  const committedResultRoundRef = useRef<number | null>(null)
  const autoMasterRoundRef = useRef<number | null>(null)
  const questionShownAtRef = useRef<number | null>(null)
  const answerElapsedMsRef = useRef<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const initialPracticeSettingsRef = useRef(loadPracticeQueueSettings())
  const [practiceSettings, setPracticeSettings] = useState(() => initialPracticeSettingsRef.current)
  const [practiceDraft, setPracticeDraft] = useState(() => ({
    optionWrapChars: String(initialPracticeSettingsRef.current.optionWrapChars),
    titleSpacingPx: String(initialPracticeSettingsRef.current.titleSpacingPx),
    titleWrapChars: String(initialPracticeSettingsRef.current.titleWrapChars),
    autoMasterWithinSeconds: String(initialPracticeSettingsRef.current.autoMasterWithinSeconds),
  }))

  const queueTotal = Math.max(0, Math.floor(gameState.practiceQueueTotal))
  const queuePracticed = Math.min(queueTotal, Math.max(0, Math.floor(gameState.practiceQueuePracticed)))
  const queueRemaining = Math.max(0, queueTotal - queuePracticed)
  const queueInFlight =
    gameState.gamePhase === 'question' || gameState.gamePhase === 'waiting' || gameState.gamePhase === 'result' ? 1 : 0
  const queueProgressCurrent = Math.min(queueTotal, queuePracticed + queueInFlight)
  const queueProgressRatio = queueTotal > 0 ? Math.min(1, queueProgressCurrent / queueTotal) : 0

  useEffect(() => {
    if (!settingsOpen) return
    setPracticeDraft({
      optionWrapChars: String(practiceSettings.optionWrapChars),
      titleSpacingPx: String(practiceSettings.titleSpacingPx),
      titleWrapChars: String(practiceSettings.titleWrapChars),
      autoMasterWithinSeconds: String(practiceSettings.autoMasterWithinSeconds),
    })
  }, [practiceSettings, settingsOpen])

  const commitPracticeSettings = () => {
    const nextOptionWrapChars = normalizeOptionWrapChars(Number.parseInt(practiceDraft.optionWrapChars, 10))
    const nextTitleSpacingPx = normalizeTitleSpacingPx(Number.parseInt(practiceDraft.titleSpacingPx, 10))
    const nextTitleWrapChars = normalizeTitleWrapChars(Number.parseInt(practiceDraft.titleWrapChars, 10))
    const nextAutoMasterWithinSeconds = Number.parseInt(practiceDraft.autoMasterWithinSeconds, 10)
    const normalizedAutoMasterWithinSeconds = Number.isFinite(nextAutoMasterWithinSeconds)
      ? Math.max(0, Math.round(nextAutoMasterWithinSeconds))
      : 0

    const nextSettings = {
      optionWrapChars: nextOptionWrapChars,
      titleSpacingPx: nextTitleSpacingPx,
      titleWrapChars: nextTitleWrapChars,
      autoMasterWithinSeconds: normalizedAutoMasterWithinSeconds,
    }

    setPracticeSettings(nextSettings)
    setPracticeDraft({
      optionWrapChars: String(nextOptionWrapChars),
      titleSpacingPx: String(nextTitleSpacingPx),
      titleWrapChars: String(nextTitleWrapChars),
      autoMasterWithinSeconds: String(normalizedAutoMasterWithinSeconds),
    })
    savePracticeQueueSettings(nextSettings)
  }

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      const shouldResumeQueue = new URLSearchParams(window.location.search).get('resumeQueue') === '1'
      const lastSession = loadLastPracticeQueueSession()
      let practiceQueue = [] as ReturnType<typeof consumePracticeQueue>
      let initialPracticedCount = 0

      if (shouldResumeQueue && lastSession) {
        practiceQueue = rotateQueueByCursor(lastSession.questions, lastSession.cursor)
        initialPracticedCount = lastSession.practicedCount
        saveLastPracticeQueueSession(practiceQueue, 0, initialPracticedCount)
      } else {
        practiceQueue = consumePracticeQueue()
        if (practiceQueue.length > 0) {
          saveLastPracticeQueueSession(practiceQueue, 0, 0)
        } else if (lastSession) {
          practiceQueue = rotateQueueByCursor(lastSession.questions, lastSession.cursor)
          initialPracticedCount = lastSession.practicedCount
          saveLastPracticeQueueSession(practiceQueue, 0, initialPracticedCount)
        }
      }

      if (practiceQueue.length <= 0) {
        setBootError('没有可用队列，请先在题库页按筛选结果创建刷题队列。')
        return
      }

      const stats = loadQuestionStatsMap()
      const nonMasteredQueueCount = practiceQueue.filter((item) => getQuestionStat(item.question, stats)?.mastered !== true).length
      if (nonMasteredQueueCount < MIN_PRACTICE_QUEUE_ITEMS) {
        setBootError(`当前队列未掌握题仅 ${nonMasteredQueueCount} 题，最少需要 ${MIN_PRACTICE_QUEUE_ITEMS} 题。`)
        return
      }

      setPracticeQueue(practiceQueue, initialPracticedCount)
      if (cancelled) return
      await startNewGame()
    }

    void bootstrap()

    attachDebugSettle((mode) => {
      useGameStore.getState().debugSettle(mode)
    })

    return () => {
      cancelled = true
      detachDebugSettle()
      useGameStore.getState().destroy()
    }
  }, [setPracticeQueue, startNewGame])

  useEffect(() => {
    if (!gameState.practiceQueueMode) return
    if (gameState.gamePhase !== 'result') {
      if (gameState.gamePhase === 'waiting' || gameState.gamePhase === 'question') {
        committedResultRoundRef.current = null
      }
      return
    }
    if (committedResultRoundRef.current === currentRound) return

    advanceLastPracticeQueueProgress(1)
    committedResultRoundRef.current = currentRound
  }, [currentRound, gameState.gamePhase, gameState.practiceQueueMode])

  useEffect(() => {
    questionShownAtRef.current = null
    answerElapsedMsRef.current = null
  }, [gameState.currentQuestion])

  useEffect(() => {
    if (!gameState.practiceQueueMode) return
    if (gameState.gamePhase !== 'result') {
      if (gameState.gamePhase === 'waiting' || gameState.gamePhase === 'question') {
        autoMasterRoundRef.current = null
      }
      return
    }
    if (autoMasterRoundRef.current === currentRound) return
    if (practiceSettings.autoMasterWithinSeconds <= 0) return
    if (!gameState.currentQuestion) return
    if (gameState.playerCorrect !== true) return
    if (answerElapsedMsRef.current === null) return
    if (answerElapsedMsRef.current > practiceSettings.autoMasterWithinSeconds * 1000) return

    setQuestionMastered(gameState.currentQuestion, true)
    autoMasterRoundRef.current = currentRound
  }, [
    currentRound,
    gameState.currentQuestion,
    gameState.gamePhase,
    gameState.playerCorrect,
    gameState.practiceQueueMode,
    practiceSettings.autoMasterWithinSeconds,
  ])

  const footer = useMemo(
    () => (
      <div className="footer-attribution">
        <p>
          刷题模式，仅保留题目与选项。返回 <Link to={APP_ROUTES.questionBank}>题库页</Link> 或 <Link to={APP_ROUTES.home}>首页</Link>，可通过{' '}
          <a
            href="#"
            onClick={(event) => {
              event.preventDefault()
              setSettingsOpen(true)
            }}
          >
            设置
          </a>{' '}
          调整显示与掌握阈值。
        </p>
      </div>
    ),
    [],
  )

  const handleQuestionShown = () => {
    questionShownAtRef.current = Date.now()
    answerElapsedMsRef.current = null
    activateQuestion()
  }

  const handleSelectOption = (index: number) => {
    if (answerElapsedMsRef.current === null && questionShownAtRef.current !== null) {
      answerElapsedMsRef.current = Date.now() - questionShownAtRef.current
    }
    selectAnswer(index)
  }

  return (
    <AppLayout footer={footer}>
      {bootError ? <div className="mb-3 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800">{bootError}</div> : null}
      {gameState.practiceQueueMode ? (
        <div className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <div className="font-semibold">当前队列刷题进度 {queueProgressCurrent} / {queueTotal}</div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-sky-100">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${(queueProgressRatio * 100).toFixed(2)}%` }} />
          </div>
          <div className="mt-1">已练习 {queuePracticed} | 剩余 {queueRemaining}</div>
        </div>
      ) : null}

      <GameBoard
        autoSkipEndScreen={false}
        opponentId="Practice"
        optionWrapChars={practiceSettings.optionWrapChars}
        playerAvatarHtml={DEFAULT_AVATAR_SRC}
        playerId="Practice"
        state={gameState}
        titleSpacingPx={practiceSettings.titleSpacingPx}
        titleWrapChars={practiceSettings.titleWrapChars}
        onClickOpponentAvatar={() => undefined}
        onClickPlayerAvatar={() => undefined}
        onContinue={() => {
          startNewGame().catch(() => undefined)
        }}
        onQuestionShown={handleQuestionShown}
        onSelectOption={handleSelectOption}
        onToggleAutoSkipEndScreen={() => undefined}
      />

      <Modal open={settingsOpen} title="刷题设置" onClose={() => setSettingsOpen(false)}>
        <div className="modal-body">
          <DisplaySettingsFields
            idPrefix="queue"
            optionWrapChars={practiceDraft.optionWrapChars}
            titleSpacingPx={practiceDraft.titleSpacingPx}
            titleWrapChars={practiceDraft.titleWrapChars}
            onChangeOptionWrapChars={(value) => {
              setPracticeDraft((prev) => ({
                ...prev,
                optionWrapChars: value,
              }))
            }}
            onChangeTitleSpacingPx={(value) => {
              setPracticeDraft((prev) => ({
                ...prev,
                titleSpacingPx: value,
              }))
            }}
            onChangeTitleWrapChars={(value) => {
              setPracticeDraft((prev) => ({
                ...prev,
                titleWrapChars: value,
              }))
            }}
            onCommit={commitPracticeSettings}
          />

          <div className="setting-group">
            <label className="setting-label" htmlFor="queue-auto-master-within">
              自动标注掌握阈值（秒）
            </label>
            <input
              className="setting-input"
              id="queue-auto-master-within"
              inputMode="numeric"
              max="999"
              min="0"
              pattern="[0-9]*"
              placeholder="留空表示关闭"
              step="1"
              type="text"
              value={practiceDraft.autoMasterWithinSeconds}
              onBlur={commitPracticeSettings}
              onChange={(event) => {
                setPracticeDraft((prev) => ({
                  ...prev,
                  autoMasterWithinSeconds: sanitizeDigitsInput(event.target.value),
                }))
              }}
              onKeyDown={(event) => {
                onlyNumericKeyboard(event)
                if (event.key === 'Enter') {
                  commitPracticeSettings()
                }
              }}
            />
            <div className="setting-description">题目出现后指定秒数内答对，自动标注掌握</div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              commitPracticeSettings()
              setSettingsOpen(false)
            }}
          >
            保存
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => setSettingsOpen(false)}>
            取消
          </button>
        </div>
      </Modal>
    </AppLayout>
  )
}
