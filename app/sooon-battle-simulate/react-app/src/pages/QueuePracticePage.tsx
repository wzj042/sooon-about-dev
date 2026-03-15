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
  saveLastPracticeQueueSession,
} from '../services/practiceQueue'
import { loadQuestionStatsMap, setQuestionMastered } from '../services/questionStats'
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
  const totalRounds = useGameStore((state) => state.totalRounds)
  const activateQuestion = useGameStore((state) => state.activateQuestion)
  const selectAnswer = useGameStore((state) => state.selectAnswer)
  const continuePracticeQueueAfterReview = useGameStore((state) => state.continuePracticeQueueAfterReview)
  const showRankText = useGameStore((state) => state.showRankText)
  const setPracticeQueue = useGameStore((state) => state.setPracticeQueue)
  const updatePracticeQueueFlowSettings = useGameStore((state) => state.updatePracticeQueueFlowSettings)
  const [bootError, setBootError] = useState<string | null>(null)
  const committedResultRoundRef = useRef<number | null>(null)
  const autoMasterRoundRef = useRef<number | null>(null)
  const questionShownAtRef = useRef<number | null>(null)
  const answerElapsedMsRef = useRef<number | null>(null)
  const questionWasMasteredRef = useRef(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [currentQuestionMastered, setCurrentQuestionMastered] = useState(false)
  const [elapsedDisplayMs, setElapsedDisplayMs] = useState(0)
  const [initialPracticeSettings] = useState(() => loadPracticeQueueSettings())
  const [practiceSettings, setPracticeSettings] = useState(initialPracticeSettings)
  const [practiceDraft, setPracticeDraft] = useState(() => ({
    optionWrapChars: String(initialPracticeSettings.optionWrapChars),
    titleSpacingPx: String(initialPracticeSettings.titleSpacingPx),
    titleWrapChars: String(initialPracticeSettings.titleWrapChars),
    autoMasterWithinSeconds: String(initialPracticeSettings.autoMasterWithinSeconds),
    autoUnmasterOverSeconds: String(initialPracticeSettings.autoUnmasterOverSeconds),
    autoNextDelaySeconds: String(initialPracticeSettings.autoNextDelaySeconds),
    manualNextOnWrong: initialPracticeSettings.manualNextOnWrong,
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
      autoUnmasterOverSeconds: String(practiceSettings.autoUnmasterOverSeconds),
      autoNextDelaySeconds: String(practiceSettings.autoNextDelaySeconds),
      manualNextOnWrong: practiceSettings.manualNextOnWrong,
    })
  }, [practiceSettings, settingsOpen])

  const commitPracticeSettings = () => {
    const nextOptionWrapChars = normalizeOptionWrapChars(Number.parseInt(practiceDraft.optionWrapChars, 10))
    const nextTitleSpacingPx = normalizeTitleSpacingPx(Number.parseInt(practiceDraft.titleSpacingPx, 10))
    const nextTitleWrapChars = normalizeTitleWrapChars(Number.parseInt(practiceDraft.titleWrapChars, 10))
    const nextAutoMasterWithinSeconds = Number.parseInt(practiceDraft.autoMasterWithinSeconds, 10)
    const nextAutoUnmasterOverSeconds = Number.parseInt(practiceDraft.autoUnmasterOverSeconds, 10)
    const nextAutoNextDelaySeconds = Number.parseInt(practiceDraft.autoNextDelaySeconds, 10)
    const normalizedAutoMasterWithinSeconds = Number.isFinite(nextAutoMasterWithinSeconds)
      ? Math.max(0, Math.round(nextAutoMasterWithinSeconds))
      : 0
    const normalizedAutoUnmasterOverSeconds = Number.isFinite(nextAutoUnmasterOverSeconds)
      ? Math.max(0, Math.round(nextAutoUnmasterOverSeconds))
      : 0
    const normalizedAutoNextDelaySeconds = Number.isFinite(nextAutoNextDelaySeconds)
      ? Math.max(0, Math.round(nextAutoNextDelaySeconds))
      : 1

    const nextSettings = {
      optionWrapChars: nextOptionWrapChars,
      titleSpacingPx: nextTitleSpacingPx,
      titleWrapChars: nextTitleWrapChars,
      autoMasterWithinSeconds: normalizedAutoMasterWithinSeconds,
      autoUnmasterOverSeconds: normalizedAutoUnmasterOverSeconds,
      autoNextDelaySeconds: normalizedAutoNextDelaySeconds,
      manualNextOnWrong: practiceDraft.manualNextOnWrong,
    }

    setPracticeSettings(nextSettings)
    setPracticeDraft({
      optionWrapChars: String(nextOptionWrapChars),
      titleSpacingPx: String(nextTitleSpacingPx),
      titleWrapChars: String(nextTitleWrapChars),
      autoMasterWithinSeconds: String(normalizedAutoMasterWithinSeconds),
      autoUnmasterOverSeconds: String(normalizedAutoUnmasterOverSeconds),
      autoNextDelaySeconds: String(normalizedAutoNextDelaySeconds),
      manualNextOnWrong: practiceDraft.manualNextOnWrong,
    })
    savePracticeQueueSettings(nextSettings)
  }

  useEffect(() => {
    updatePracticeQueueFlowSettings({
      autoNextDelayMs: practiceSettings.autoNextDelaySeconds * 1000,
      manualNextOnWrong: practiceSettings.manualNextOnWrong,
    })
  }, [practiceSettings.autoNextDelaySeconds, practiceSettings.manualNextOnWrong, updatePracticeQueueFlowSettings])

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
    setElapsedDisplayMs(0)
    if (!gameState.currentQuestion) {
      questionWasMasteredRef.current = false
      setCurrentQuestionMastered(false)
      return
    }
    const statsMap = loadQuestionStatsMap()
    questionWasMasteredRef.current = statsMap[gameState.currentQuestion]?.mastered === true
    setCurrentQuestionMastered(questionWasMasteredRef.current)
  }, [gameState.currentQuestion])

  useEffect(() => {
    if (questionShownAtRef.current === null) {
      setElapsedDisplayMs(answerElapsedMsRef.current ?? 0)
      return
    }
    if (answerElapsedMsRef.current !== null) {
      setElapsedDisplayMs(answerElapsedMsRef.current)
      return
    }

    const updateElapsed = () => {
      if (questionShownAtRef.current === null) {
        setElapsedDisplayMs(0)
        return
      }
      setElapsedDisplayMs(Math.max(0, Date.now() - questionShownAtRef.current))
    }

    updateElapsed()
    const timer = window.setInterval(updateElapsed, 100)
    return () => {
      window.clearInterval(timer)
    }
  }, [gameState.currentQuestion, gameState.gamePhase, gameState.playerSelection])

  useEffect(() => {
    if (!gameState.practiceQueueMode) return
    const waitingForManualReview =
      practiceSettings.manualNextOnWrong &&
      gameState.gamePhase === 'question' &&
      gameState.playerSelection !== null &&
      gameState.playerCorrect === false

    if (gameState.gamePhase !== 'result' && !waitingForManualReview) {
      if ((gameState.gamePhase === 'waiting' || gameState.gamePhase === 'question') && gameState.playerSelection === null) {
        autoMasterRoundRef.current = null
      }
      return
    }
    if (autoMasterRoundRef.current === currentRound) return
    if (!gameState.currentQuestion) return
    if (answerElapsedMsRef.current === null) return
    if (questionWasMasteredRef.current) {
      const shouldUnmasterByWrong = gameState.playerCorrect === false
      const shouldUnmasterBySlow =
        practiceSettings.autoUnmasterOverSeconds > 0 && answerElapsedMsRef.current > practiceSettings.autoUnmasterOverSeconds * 1000
      if (shouldUnmasterByWrong || shouldUnmasterBySlow) {
        setQuestionMastered(gameState.currentQuestion, false)
        setCurrentQuestionMastered(false)
        showRankText('已取消掌握')
        autoMasterRoundRef.current = currentRound
        return
      }
    }
    if (practiceSettings.autoMasterWithinSeconds <= 0) return
    if (gameState.playerCorrect !== true) return
    if (answerElapsedMsRef.current > practiceSettings.autoMasterWithinSeconds * 1000) return

    setQuestionMastered(gameState.currentQuestion, true)
    setCurrentQuestionMastered(true)
    showRankText('已标注掌握')
    autoMasterRoundRef.current = currentRound
  }, [
    currentRound,
    gameState.currentQuestion,
    gameState.gamePhase,
    gameState.playerCorrect,
    gameState.playerSelection,
    gameState.practiceQueueMode,
    practiceSettings.autoMasterWithinSeconds,
    practiceSettings.manualNextOnWrong,
    practiceSettings.autoUnmasterOverSeconds,
    showRankText,
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
    setElapsedDisplayMs(0)
    activateQuestion()
  }

  const handleSelectOption = (index: number) => {
    if (answerElapsedMsRef.current === null && questionShownAtRef.current !== null) {
      answerElapsedMsRef.current = Date.now() - questionShownAtRef.current
      setElapsedDisplayMs(answerElapsedMsRef.current)
    }
    selectAnswer(index)
  }

  const elapsedSeconds = Math.max(0, Math.ceil(elapsedDisplayMs / 1000))
  const activeThresholdSeconds = currentQuestionMastered ? practiceSettings.autoUnmasterOverSeconds : practiceSettings.autoMasterWithinSeconds
  const activeThresholdLabel = currentQuestionMastered ? '取消掌握阈值' : '标注掌握阈值'
  const activeThresholdProgress =
    activeThresholdSeconds > 0 ? Math.max(0, Math.min(1, elapsedDisplayMs / (activeThresholdSeconds * 1000))) : 0
  const shouldManualAdvanceOnWrong =
    gameState.practiceQueueMode &&
    gameState.gamePhase === 'question' &&
    gameState.playerSelection !== null &&
    gameState.playerCorrect === false &&
    practiceSettings.manualNextOnWrong

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
      {gameState.currentQuestion ? (
        <div className="queue-practice-status">
          <div className="queue-practice-status-row">
            <span className={`queue-practice-mastery-badge ${currentQuestionMastered ? 'is-mastered' : 'is-unmastered'}`}>
              {currentQuestionMastered ? '已掌握' : '未掌握'}
            </span>
            <span className="queue-practice-timer">{elapsedSeconds}s</span>
          </div>
          {activeThresholdSeconds > 0 ? (
            <>
              <div className="queue-practice-threshold-label">
                {activeThresholdLabel} {activeThresholdSeconds}s
              </div>
              <div className="queue-practice-threshold-track">
                <div
                  className={`queue-practice-threshold-fill ${currentQuestionMastered ? 'is-unmaster' : 'is-master'}`}
                  style={{ width: `${(activeThresholdProgress * 100).toFixed(2)}%` }}
                />
              </div>
            </>
          ) : (
            <div className="queue-practice-threshold-label">当前掌握状态未设置对应秒数阈值</div>
          )}
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

          <div className="setting-group">
            <label className="setting-label" htmlFor="queue-auto-unmaster-over">
              自动取消掌握阈值（秒）
            </label>
            <input
              className="setting-input"
              id="queue-auto-unmaster-over"
              inputMode="numeric"
              max="999"
              min="0"
              pattern="[0-9]*"
              placeholder="留空表示关闭"
              step="1"
              type="text"
              value={practiceDraft.autoUnmasterOverSeconds}
              onBlur={commitPracticeSettings}
              onChange={(event) => {
                setPracticeDraft((prev) => ({
                  ...prev,
                  autoUnmasterOverSeconds: sanitizeDigitsInput(event.target.value),
                }))
              }}
              onKeyDown={(event) => {
                onlyNumericKeyboard(event)
                if (event.key === 'Enter') {
                  commitPracticeSettings()
                }
              }}
            />
            <div className="setting-description">本轮开始前已掌握的题，作答超过指定秒数后自动取消掌握</div>
          </div>

          <div className="setting-group">
            <label className="setting-label" htmlFor="queue-auto-next-delay">
              自动切下一题（秒）
            </label>
            <input
              className="setting-input"
              id="queue-auto-next-delay"
              inputMode="numeric"
              max="999"
              min="0"
              pattern="[0-9]*"
              placeholder="0 表示立刻切题"
              step="1"
              type="text"
              value={practiceDraft.autoNextDelaySeconds}
              onBlur={commitPracticeSettings}
              onChange={(event) => {
                setPracticeDraft((prev) => ({
                  ...prev,
                  autoNextDelaySeconds: sanitizeDigitsInput(event.target.value),
                }))
              }}
              onKeyDown={(event) => {
                onlyNumericKeyboard(event)
                if (event.key === 'Enter') {
                  commitPracticeSettings()
                }
              }}
            />
            <div className="setting-description">显示本题结果后，经过指定秒数自动切到下一题</div>
          </div>

          <div className="setting-group">
            <label className="setting-label" htmlFor="queue-manual-next-on-wrong">
              答错时手动切题
            </label>
            <div className="checkbox-setting">
              <input
                checked={practiceDraft.manualNextOnWrong}
                className="setting-checkbox"
                id="queue-manual-next-on-wrong"
                type="checkbox"
                onChange={(event) => {
                  setPracticeDraft((prev) => ({
                    ...prev,
                    manualNextOnWrong: event.target.checked,
                  }))
                }}
              />
              <label className="checkbox-label" htmlFor="queue-manual-next-on-wrong">
                答错后停留在结果页，由我手动切到下一题
              </label>
            </div>
            <div className="setting-description">开启后，自动切题秒数仅对答对题生效</div>
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

      {shouldManualAdvanceOnWrong ? (
        <div className="queue-next-floating">
          <button className="cta-button primary" type="button" onClick={continuePracticeQueueAfterReview}>
            {currentRound < totalRounds ? '下一题' : '结束本轮'}
          </button>
        </div>
      ) : null}
    </AppLayout>
  )
}
