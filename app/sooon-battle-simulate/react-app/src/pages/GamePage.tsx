import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { APP_ROUTES } from '../app/paths'
import { useShallow } from 'zustand/react/shallow'

import { AvatarModal } from '../components/avatar/AvatarModal'
import { GameBoard } from '../components/game/GameBoard'
import { AppLayout } from '../components/layout/AppLayout'
import { SettingsModal } from '../components/settings/SettingsModal'
import { DEFAULT_AVATAR_SRC } from '../domain/avatar'
import type { AvatarData } from '../domain/types'
import type { QuestionRandomMode, QuestionSelectionStrategy } from '../domain/types'
import {
  DEFAULT_OPPONENT_ID,
  DEFAULT_OPTION_WRAP_CHARS,
  DEFAULT_PLAYER_ID,
  DEFAULT_TITLE_SPACING_PX,
  DEFAULT_TITLE_WRAP_CHARS,
  normalizeSettings,
  toAccuracyRatio,
} from '../domain/validation'
import {
  loadLegacyConfig,
  saveLegacyAIConfig,
  saveLegacyAutoSkipEndScreen,
  saveLegacyAutoMasterTimeLeft,
  saveLegacyAvatar,
  saveLegacyAvatarFixed,
  saveLegacyDisplayConfig,
  saveLegacyQuestionRandomMode,
  saveLegacyQuestionSelectionCommonSenseType,
  saveLegacyQuestionSelectionStrategy,
} from '../services/legacyStorageCompat'
import { loadQuestionBank } from '../services/questionBank'
import {
  buildCommonSenseSubtypeCounts,
  buildQuestionSelectionCounts,
  DEFAULT_QUESTION_SELECTION_COUNTS,
  type CommonSenseSubtypeCounts,
  type QuestionSelectionCounts,
} from '../services/questionSelection'
import { loadQuestionStatsMap, setQuestionMastered, subscribeQuestionStats } from '../services/questionStats'
import { detachDebugSettle, attachDebugSettle } from '../store/actions/debug'
import { useGameStore } from '../store/gameStore'

interface SettingsState {
  accuracyPercent: number
  minSpeedMs: number
  maxSpeedMs: number
  avatarFixed: boolean
  autoSkipEndScreen: boolean
  playerId: string
  opponentId: string
  optionWrapChars: number
  titleSpacingPx: number
  titleWrapChars: number
  questionSelectionStrategy: QuestionSelectionStrategy
  questionSelectionCommonSenseType: string
  questionRandomMode: QuestionRandomMode
  autoMasterTimeLeft: number
}

function normalizeAvatarForSave(avatar: AvatarData, fallbackAvatarSrc: string): AvatarData {
  return {
    ...avatar,
    svg: avatar.svg || fallbackAvatarSrc,
    timestamp: Date.now(),
  }
}

export function GamePage() {
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
      currentRound: state.currentRound,
      totalRounds: state.totalRounds,
      maxScore: state.maxScore,
      practiceQueueMode: state.practiceQueueMode,
      practiceQueueTotal: state.practiceQueueTotal,
      practiceQueuePracticed: state.practiceQueuePracticed,
      questionLoadError: state.questionLoadError,
    })),
  )

  const startNewGame = useGameStore((state) => state.startNewGame)
  const activateQuestion = useGameStore((state) => state.activateQuestion)
  const selectAnswer = useGameStore((state) => state.selectAnswer)
  const configureOpponent = useGameStore((state) => state.configureOpponent)
  const updateAIConfig = useGameStore((state) => state.updateAIConfig)
  const setAvatarFixed = useGameStore((state) => state.setAvatarFixed)
  const updateQuestionSelectionStrategy = useGameStore((state) => state.updateQuestionSelectionStrategy)
  const updateQuestionSelectionCommonSenseType = useGameStore((state) => state.updateQuestionSelectionCommonSenseType)
  const updateQuestionRandomMode = useGameStore((state) => state.updateQuestionRandomMode)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [avatarContext, setAvatarContext] = useState<'player' | 'opponent'>('player')
  const [playerAvatarHtml, setPlayerAvatarHtml] = useState(DEFAULT_AVATAR_SRC)
  const [questionSelectionCounts, setQuestionSelectionCounts] = useState<QuestionSelectionCounts>(DEFAULT_QUESTION_SELECTION_COUNTS)
  const [commonSenseSubtypeCounts, setCommonSenseSubtypeCounts] = useState<CommonSenseSubtypeCounts>({})
  const [questionSelectionCountsLoading, setQuestionSelectionCountsLoading] = useState(true)
  const [settings, setSettings] = useState<SettingsState>({
    accuracyPercent: 60,
    minSpeedMs: 1280,
    maxSpeedMs: 2900,
    avatarFixed: false,
    autoSkipEndScreen: false,
    playerId: DEFAULT_PLAYER_ID,
    opponentId: DEFAULT_OPPONENT_ID,
    optionWrapChars: DEFAULT_OPTION_WRAP_CHARS,
    titleSpacingPx: DEFAULT_TITLE_SPACING_PX,
    titleWrapChars: DEFAULT_TITLE_WRAP_CHARS,
    questionSelectionStrategy: 'all_questions',
    questionSelectionCommonSenseType: '',
    questionRandomMode: 'shuffled_cycle',
    autoMasterTimeLeft: 0,
  })
  const autoMasterRoundRef = useRef<number | null>(null)

  const normalizedSettings = useMemo(
    () =>
      normalizeSettings({
        accuracyPercent: settings.accuracyPercent,
        minSpeedMs: settings.minSpeedMs,
        maxSpeedMs: settings.maxSpeedMs,
        optionWrapChars: settings.optionWrapChars,
        titleSpacingPx: settings.titleSpacingPx,
        titleWrapChars: settings.titleWrapChars,
      }),
    [settings.accuracyPercent, settings.maxSpeedMs, settings.minSpeedMs, settings.optionWrapChars, settings.titleSpacingPx, settings.titleWrapChars],
  )

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      const legacy = loadLegacyConfig()
      const normalized = normalizeSettings({
        accuracyPercent: legacy.aiAccuracyPercent,
        minSpeedMs: legacy.aiSpeedMin,
        maxSpeedMs: legacy.aiSpeedMax,
        optionWrapChars: legacy.optionWrapChars,
        titleSpacingPx: legacy.titleSpacingPx,
        titleWrapChars: legacy.titleWrapChars,
      })

      if (cancelled) return

      const store = useGameStore.getState()
      setSettings({
        accuracyPercent: normalized.accuracyPercent,
        minSpeedMs: normalized.minSpeedMs,
        maxSpeedMs: normalized.maxSpeedMs,
        avatarFixed: legacy.avatarFixed,
        autoSkipEndScreen: legacy.autoSkipEndScreen,
        playerId: legacy.playerId,
        opponentId: legacy.opponentId,
        optionWrapChars: normalized.optionWrapChars,
        titleSpacingPx: normalized.titleSpacingPx,
        titleWrapChars: normalized.titleWrapChars,
        questionSelectionStrategy: legacy.questionSelectionStrategy,
        questionSelectionCommonSenseType: legacy.questionSelectionCommonSenseType,
        questionRandomMode: legacy.questionRandomMode,
        autoMasterTimeLeft: legacy.autoMasterTimeLeft,
      })

      store.updateAIConfig({
        accuracy: toAccuracyRatio(normalized.accuracyPercent),
        speedMsRange: [normalized.minSpeedMs, normalized.maxSpeedMs],
      })

      store.setAvatarFixed(legacy.avatarFixed)
      store.updateQuestionSelectionStrategy(legacy.questionSelectionStrategy)
      store.updateQuestionSelectionCommonSenseType(legacy.questionSelectionCommonSenseType)
      store.updateQuestionRandomMode(legacy.questionRandomMode)

      if (legacy.playerAvatarData?.svg) {
        setPlayerAvatarHtml(legacy.playerAvatarData.svg)
      }

      if (legacy.opponentAvatarData?.svg) {
        store.configureOpponent({ avatar: legacy.opponentAvatarData.svg })
      }

      await startNewGame()
    }

    bootstrap().catch(() => {
      if (cancelled) return
      startNewGame().catch(() => undefined)
    })

    attachDebugSettle((mode) => {
      useGameStore.getState().debugSettle(mode)
    })

    return () => {
      cancelled = true
      detachDebugSettle()
      useGameStore.getState().destroy()
    }
  }, [startNewGame])

  useEffect(() => {
    if (gameState.gamePhase === 'question' || gameState.gamePhase === 'waiting') {
      autoMasterRoundRef.current = null
    }
  }, [gameState.gamePhase])

  useEffect(() => {
    if (gameState.gamePhase !== 'result') return
    if (autoMasterRoundRef.current === gameState.currentRound) return
    if (settings.autoMasterTimeLeft <= 0) return
    if (!gameState.currentQuestion) return
    if (gameState.playerCorrect !== true) return
    const isFinalRound = gameState.totalRounds > 0 && gameState.currentRound === gameState.totalRounds
    const effectiveTimeLeft = isFinalRound ? Math.floor(gameState.timeLeft / 2) : gameState.timeLeft
    if (effectiveTimeLeft < settings.autoMasterTimeLeft) return

    setQuestionMastered(gameState.currentQuestion, true)
    autoMasterRoundRef.current = gameState.currentRound
  }, [
    gameState.currentQuestion,
    gameState.currentRound,
    gameState.gamePhase,
    gameState.playerCorrect,
    gameState.totalRounds,
    gameState.timeLeft,
    settings.autoMasterTimeLeft,
  ])

  useEffect(() => {
    let cancelled = false

    const refreshCounts = async () => {
      try {
        const bank = await loadQuestionBank()
        if (cancelled) return
        const statsMap = loadQuestionStatsMap()
        setQuestionSelectionCounts(buildQuestionSelectionCounts(bank, statsMap))
        setCommonSenseSubtypeCounts(buildCommonSenseSubtypeCounts(bank))
      } finally {
        if (!cancelled) {
          setQuestionSelectionCountsLoading(false)
        }
      }
    }

    void refreshCounts()
    const unsubscribe = subscribeQuestionStats(() => {
      void refreshCounts()
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const applySettings = (params: {
    accuracyPercent: number
    minSpeedMs: number
    maxSpeedMs: number
    avatarFixed: boolean
    autoSkipEndScreen: boolean
    accuracyRatio: number
    speedRange: [number, number]
    playerId: string
    opponentId: string
    optionWrapChars: number
    titleSpacingPx: number
    titleWrapChars: number
    questionSelectionStrategy: QuestionSelectionStrategy
    questionSelectionCommonSenseType: string
    questionRandomMode: QuestionRandomMode
    autoMasterTimeLeft: number
  }) => {
    setSettings({
      accuracyPercent: params.accuracyPercent,
      minSpeedMs: params.minSpeedMs,
      maxSpeedMs: params.maxSpeedMs,
      avatarFixed: params.avatarFixed,
      autoSkipEndScreen: params.autoSkipEndScreen,
      playerId: params.playerId,
      opponentId: params.opponentId,
      optionWrapChars: params.optionWrapChars,
      titleSpacingPx: params.titleSpacingPx,
      titleWrapChars: params.titleWrapChars,
      questionSelectionStrategy: params.questionSelectionStrategy,
      questionSelectionCommonSenseType: params.questionSelectionCommonSenseType,
      questionRandomMode: params.questionRandomMode,
      autoMasterTimeLeft: params.autoMasterTimeLeft,
    })

    updateAIConfig({
      accuracy: params.accuracyRatio,
      speedMsRange: params.speedRange,
    })

    setAvatarFixed(params.avatarFixed)
    updateQuestionSelectionStrategy(params.questionSelectionStrategy)
    updateQuestionSelectionCommonSenseType(params.questionSelectionCommonSenseType)
    updateQuestionRandomMode(params.questionRandomMode)

    saveLegacyAIConfig({
      accuracyPercent: params.accuracyPercent,
      minSpeedMs: params.minSpeedMs,
      maxSpeedMs: params.maxSpeedMs,
    })
    saveLegacyAvatarFixed(params.avatarFixed)
    saveLegacyAutoSkipEndScreen(params.autoSkipEndScreen)
    saveLegacyDisplayConfig({
      playerId: params.playerId,
      opponentId: params.opponentId,
      optionWrapChars: params.optionWrapChars,
      titleSpacingPx: params.titleSpacingPx,
      titleWrapChars: params.titleWrapChars,
    })
    saveLegacyQuestionSelectionStrategy(params.questionSelectionStrategy)
    saveLegacyQuestionSelectionCommonSenseType(params.questionSelectionCommonSenseType)
    saveLegacyQuestionRandomMode(params.questionRandomMode)
    saveLegacyAutoMasterTimeLeft(params.autoMasterTimeLeft)

    if (params.avatarFixed) {
      saveLegacyAvatar('opponent', {
        svg: gameState.opponent.avatar || DEFAULT_AVATAR_SRC,
        style: 'current',
        seed: `fixed-${Date.now()}`,
        size: 64,
        timestamp: Date.now(),
      })
    }
  }

  const handleToggleAutoSkipEndScreen = (enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      autoSkipEndScreen: enabled,
    }))
    saveLegacyAutoSkipEndScreen(enabled)
  }

  const handleSaveAvatar = (context: 'player' | 'opponent', avatar: AvatarData) => {
    if (context === 'player') {
      const normalized = normalizeAvatarForSave(avatar, DEFAULT_AVATAR_SRC)
      setPlayerAvatarHtml(normalized.svg)
      saveLegacyAvatar('player', normalized)
      return
    }

    const normalized = normalizeAvatarForSave(avatar, DEFAULT_AVATAR_SRC)
    configureOpponent({ avatar: normalized.svg })
    saveLegacyAvatar('opponent', normalized)
  }

  const footer = (
    <div className="footer-attribution">
      <p>
        题库来源：
        <a href="https://sooon.ai/" rel="noopener" target="_blank">
          素问
        </a>
        ，详情见 <Link to={APP_ROUTES.about}>关于</Link>，或返回 <Link to={APP_ROUTES.home}>首页</Link>，可通过{' '}
        <a
          href="#"
          id="settings-link"
          onClick={(event) => {
            event.preventDefault()
            setSettingsOpen(true)
          }}
        >
          设置
        </a>{' '}
        修改答题 AI 表现
      </p>
    </div>
  )

  return (
    <AppLayout footer={footer}>
      {gameState.questionLoadError ? (
        <div className="mb-3 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800">{gameState.questionLoadError}</div>
      ) : null}
      <GameBoard
        opponentId={settings.opponentId}
        optionWrapChars={normalizedSettings.optionWrapChars}
        playerAvatarHtml={playerAvatarHtml}
        playerId={settings.playerId}
        titleSpacingPx={normalizedSettings.titleSpacingPx}
        titleWrapChars={normalizedSettings.titleWrapChars}
        autoSkipEndScreen={settings.autoSkipEndScreen}
        state={gameState}
        onClickOpponentAvatar={() => {
          setAvatarContext('opponent')
          setAvatarOpen(true)
        }}
        onClickPlayerAvatar={() => {
          setAvatarContext('player')
          setAvatarOpen(true)
        }}
        onContinue={() => {
          startNewGame().catch(() => undefined)
        }}
        onQuestionShown={() => {
          activateQuestion()
        }}
        onSelectOption={(index) => {
          selectAnswer(index)
        }}
        onToggleAutoSkipEndScreen={handleToggleAutoSkipEndScreen}
      />

      <SettingsModal
        open={settingsOpen}
        opponentAvatarHtml={gameState.opponent.avatar}
        playerAvatarHtml={playerAvatarHtml}
        values={{
          accuracyPercent: normalizedSettings.accuracyPercent,
          minSpeedMs: normalizedSettings.minSpeedMs,
          maxSpeedMs: normalizedSettings.maxSpeedMs,
          avatarFixed: settings.avatarFixed,
          autoSkipEndScreen: settings.autoSkipEndScreen,
          playerId: settings.playerId,
          opponentId: settings.opponentId,
          optionWrapChars: normalizedSettings.optionWrapChars,
          titleSpacingPx: normalizedSettings.titleSpacingPx,
          titleWrapChars: normalizedSettings.titleWrapChars,
          questionSelectionStrategy: settings.questionSelectionStrategy,
          questionSelectionCommonSenseType: settings.questionSelectionCommonSenseType,
          questionRandomMode: settings.questionRandomMode,
          autoMasterTimeLeft: settings.autoMasterTimeLeft,
        }}
        commonSenseSubtypeCounts={commonSenseSubtypeCounts}
        questionSelectionCounts={questionSelectionCounts}
        questionSelectionCountsLoading={questionSelectionCountsLoading}
        onApply={applySettings}
        disableQuestionSelectionStrategy={gameState.practiceQueueMode}
        onClose={() => setSettingsOpen(false)}
        onOpenAvatarModal={(context) => {
          setAvatarContext(context)
          setAvatarOpen(true)
        }}
      />

      <AvatarModal
        context={avatarContext}
        currentAvatarHtml={avatarContext === 'player' ? playerAvatarHtml : gameState.opponent.avatar}
        open={avatarOpen}
        onClose={() => setAvatarOpen(false)}
        onSave={handleSaveAvatar}
      />
    </AppLayout>
  )
}


