import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'

import { APP_ROUTES } from '../app/paths'
import { GameBoard } from '../components/game/GameBoard'
import { AppLayout } from '../components/layout/AppLayout'
import { DEFAULT_AVATAR_SRC } from '../domain/avatar'
import {
  advanceLastPracticeQueueProgress,
  consumePracticeQueue,
  loadLastPracticeQueueSession,
  MIN_PRACTICE_QUEUE_ITEMS,
  saveLastPracticeQueueSession,
} from '../services/practiceQueue'
import { getQuestionStat, loadQuestionStatsMap } from '../services/questionStats'
import { detachDebugSettle, attachDebugSettle } from '../store/actions/debug'
import { useGameStore } from '../store/gameStore'

function rotateQueueByCursor<T>(list: T[], cursor: number): T[] {
  if (list.length <= 1) return [...list]
  const offset = ((Math.floor(cursor) % list.length) + list.length) % list.length
  if (offset === 0) return [...list]
  return [...list.slice(offset), ...list.slice(0, offset)]
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
  const committedEndedRoundRef = useRef<number | null>(null)

  const queueTotal = Math.max(0, Math.floor(gameState.practiceQueueTotal))
  const queuePracticed = Math.min(queueTotal, Math.max(0, Math.floor(gameState.practiceQueuePracticed)))
  const queueRemaining = Math.max(0, queueTotal - queuePracticed)
  const queueInFlight =
    gameState.gamePhase === 'question' || gameState.gamePhase === 'waiting' || gameState.gamePhase === 'result' ? 1 : 0
  const queueProgressCurrent = Math.min(queueTotal, queuePracticed + queueInFlight)
  const queueProgressRatio = queueTotal > 0 ? Math.min(1, queueProgressCurrent / queueTotal) : 0

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      const shouldResumeQueue = new URLSearchParams(window.location.search).get('resumeQueue') === '1'
      let practiceQueue = consumePracticeQueue()
      if (practiceQueue.length > 0) {
        saveLastPracticeQueueSession(practiceQueue, 0, 0)
      } else {
        const lastSession = loadLastPracticeQueueSession()
        if (lastSession && (shouldResumeQueue || lastSession.questions.length > 0)) {
          practiceQueue = rotateQueueByCursor(lastSession.questions, lastSession.cursor)
          saveLastPracticeQueueSession(practiceQueue, 0, lastSession.practicedCount)
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

      setPracticeQueue(practiceQueue)
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
    if (gameState.gamePhase !== 'ended') {
      committedEndedRoundRef.current = null
      return
    }
    if (committedEndedRoundRef.current === currentRound) return

    const session = loadLastPracticeQueueSession()
    if (!session || session.questions.length <= 0) return

    const delta = Math.max(0, Math.floor(currentRound))
    if (delta <= 0) return

    advanceLastPracticeQueueProgress(delta)
    committedEndedRoundRef.current = currentRound
  }, [currentRound, gameState.gamePhase, gameState.practiceQueueMode, gameState.practiceQueuePracticed])

  const footer = useMemo(
    () => (
      <div className="footer-attribution">
        <p>
          刷题模式，仅保留题目与选项。返回 <Link to={APP_ROUTES.questionBank}>题库页</Link> 或 <Link to={APP_ROUTES.home}>首页</Link>。
        </p>
      </div>
    ),
    [],
  )

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
        optionWrapChars={24}
        playerAvatarHtml={DEFAULT_AVATAR_SRC}
        playerId="Practice"
        state={gameState}
        titleSpacingPx={16}
        titleWrapChars={20}
        onClickOpponentAvatar={() => undefined}
        onClickPlayerAvatar={() => undefined}
        onContinue={() => {
          startNewGame().catch(() => undefined)
        }}
        onQuestionShown={() => {
          activateQuestion()
        }}
        onSelectOption={(index) => {
          selectAnswer(index)
        }}
        onToggleAutoSkipEndScreen={() => undefined}
      />
    </AppLayout>
  )
}
