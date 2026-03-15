import type { AvatarData } from '../domain/types'
import type { QuestionRandomMode, QuestionSelectionStrategy } from '../domain/types'
import {
  DEFAULT_OPPONENT_ID,
  DEFAULT_OPTION_WRAP_CHARS,
  DEFAULT_PLAYER_ID,
  DEFAULT_TITLE_SPACING_PX,
  DEFAULT_TITLE_WRAP_CHARS,
  normalizeDisplayId,
  normalizeOptionWrapChars,
  normalizeTitleSpacingPx,
  normalizeTitleWrapChars,
} from '../domain/validation'
import { getBoolean, getJson, getNumber, getString, setValue } from './storage'

export const LEGACY_KEYS = {
  aiSpeedMin: 'aiSpeedMin',
  aiSpeedMax: 'aiSpeedMax',
  aiAccuracy: 'aiAccuracy',
  avatarFixed: 'avatarFixed',
  autoSkipEndScreen: 'autoSkipEndScreen',
  opponentAvatarData: 'sooon-avatar-data',
  playerAvatarData: 'sooon-player-avatar-data',
  playerId: 'playerId',
  opponentId: 'opponentId',
  optionWrapChars: 'optionWrapChars',
  titleSpacingPx: 'titleSpacingPx',
  titleWrapChars: 'titleWrapChars',
  questionSelectionStrategy: 'questionSelectionStrategy',
  questionSelectionCommonSenseType: 'questionSelectionCommonSenseType',
  questionRandomMode: 'questionRandomMode',
  autoMasterTimeLeft: 'autoMasterTimeLeft',
  autoUnmasterOverSeconds: 'autoUnmasterOverSeconds',
} as const

export interface LegacyConfigSnapshot {
  aiSpeedMin: number
  aiSpeedMax: number
  aiAccuracyPercent: number
  avatarFixed: boolean
  autoSkipEndScreen: boolean
  opponentAvatarData: AvatarData | null
  playerAvatarData: AvatarData | null
  playerId: string
  opponentId: string
  optionWrapChars: number
  titleSpacingPx: number
  titleWrapChars: number
  questionSelectionStrategy: QuestionSelectionStrategy
  questionSelectionCommonSenseType: string
  questionRandomMode: QuestionRandomMode
  autoMasterTimeLeft: number
  autoUnmasterOverSeconds: number
}

const DEFAULT_QUESTION_SELECTION_STRATEGY: QuestionSelectionStrategy = 'all_questions'
const DEFAULT_QUESTION_RANDOM_MODE: QuestionRandomMode = 'shuffled_cycle'

function normalizeQuestionSelectionStrategy(raw: string): QuestionSelectionStrategy {
  if (raw === 'all_questions') return raw
  if (raw === 'unseen_first') return raw
  if (raw === 'mistake_focused') return raw
  if (raw === 'slow_thinking_focused') return raw
  if (raw === 'common_sense_only') return raw
  if (raw === 'ethics_only') return raw
  if (raw === 'unmastered_only') return raw
  if (raw === 'mastered_only') return raw
  return DEFAULT_QUESTION_SELECTION_STRATEGY
}

function normalizeQuestionRandomMode(raw: string): QuestionRandomMode {
  if (raw === 'shuffled_cycle') return raw
  if (raw === 'per_round_random') return raw
  return DEFAULT_QUESTION_RANDOM_MODE
}

function normalizeLegacyQuestionSettings(rawStrategy: string, rawRandomMode: string): {
  questionSelectionStrategy: QuestionSelectionStrategy
  questionRandomMode: QuestionRandomMode
} {
  if (rawStrategy === 'repeatable_random') {
    return {
      questionSelectionStrategy: 'all_questions',
      questionRandomMode: 'per_round_random',
    }
  }

  if (rawStrategy === 'shuffled_traversal_recent_first') {
    return {
      questionSelectionStrategy: 'all_questions',
      questionRandomMode: 'shuffled_cycle',
    }
  }

  return {
    questionSelectionStrategy: normalizeQuestionSelectionStrategy(rawStrategy),
    questionRandomMode: normalizeQuestionRandomMode(rawRandomMode),
  }
}

function normalizeAvatarPayload(value: unknown): AvatarData | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Record<string, unknown>
  const avatar = (candidate.avatar ?? candidate) as Record<string, unknown>

  if (typeof avatar.svg !== 'string' || avatar.svg.length === 0) return null

  return {
    svg: avatar.svg,
    style: typeof avatar.style === 'string' ? avatar.style : 'imported',
    seed: typeof avatar.seed === 'string' ? avatar.seed : `legacy-${Date.now()}`,
    size: typeof avatar.size === 'number' ? avatar.size : 64,
    isFallback: Boolean(avatar.isFallback),
    timestamp: typeof avatar.timestamp === 'number' ? avatar.timestamp : Date.now(),
  }
}

function normalizeLegacyAccuracyPercent(raw: number): number {
  if (!Number.isFinite(raw)) return 60

  // Backward compatibility: some old data may store 0~1 ratio.
  if (raw > 0 && raw <= 1) {
    return Math.round(raw * 100)
  }

  return Math.round(raw)
}

export function loadLegacyConfig(): LegacyConfigSnapshot {
  const aiAccuracyStored = getNumber(LEGACY_KEYS.aiAccuracy, 60)
  const normalizedQuestionSettings = normalizeLegacyQuestionSettings(
    getString(LEGACY_KEYS.questionSelectionStrategy, DEFAULT_QUESTION_SELECTION_STRATEGY),
    getString(LEGACY_KEYS.questionRandomMode, DEFAULT_QUESTION_RANDOM_MODE),
  )

  return {
    aiSpeedMin: getNumber(LEGACY_KEYS.aiSpeedMin, 1280),
    aiSpeedMax: getNumber(LEGACY_KEYS.aiSpeedMax, 2900),
    aiAccuracyPercent: normalizeLegacyAccuracyPercent(aiAccuracyStored),
    avatarFixed: getBoolean(LEGACY_KEYS.avatarFixed, false),
    autoSkipEndScreen: getBoolean(LEGACY_KEYS.autoSkipEndScreen, false),
    opponentAvatarData: normalizeAvatarPayload(getJson<unknown>(LEGACY_KEYS.opponentAvatarData, null)),
    playerAvatarData: normalizeAvatarPayload(getJson<unknown>(LEGACY_KEYS.playerAvatarData, null)),
    playerId: normalizeDisplayId(getString(LEGACY_KEYS.playerId, DEFAULT_PLAYER_ID), DEFAULT_PLAYER_ID),
    opponentId: normalizeDisplayId(getString(LEGACY_KEYS.opponentId, DEFAULT_OPPONENT_ID), DEFAULT_OPPONENT_ID),
    optionWrapChars: normalizeOptionWrapChars(getNumber(LEGACY_KEYS.optionWrapChars, DEFAULT_OPTION_WRAP_CHARS)),
    titleSpacingPx: normalizeTitleSpacingPx(getNumber(LEGACY_KEYS.titleSpacingPx, DEFAULT_TITLE_SPACING_PX)),
    titleWrapChars: normalizeTitleWrapChars(getNumber(LEGACY_KEYS.titleWrapChars, DEFAULT_TITLE_WRAP_CHARS)),
    questionSelectionStrategy: normalizedQuestionSettings.questionSelectionStrategy,
    questionSelectionCommonSenseType: getString(LEGACY_KEYS.questionSelectionCommonSenseType, '').trim(),
    questionRandomMode: normalizedQuestionSettings.questionRandomMode,
    autoMasterTimeLeft: Math.max(0, Math.round(getNumber(LEGACY_KEYS.autoMasterTimeLeft, 0))),
    autoUnmasterOverSeconds: Math.max(0, Math.round(getNumber(LEGACY_KEYS.autoUnmasterOverSeconds, 0))),
  }
}

export function saveLegacyAIConfig(config: {
  minSpeedMs: number
  maxSpeedMs: number
  accuracyPercent: number
}): void {
  setValue(LEGACY_KEYS.aiSpeedMin, config.minSpeedMs)
  setValue(LEGACY_KEYS.aiSpeedMax, config.maxSpeedMs)
  setValue(LEGACY_KEYS.aiAccuracy, config.accuracyPercent)
}

export function saveLegacyAvatarFixed(fixed: boolean): void {
  setValue(LEGACY_KEYS.avatarFixed, JSON.stringify(fixed))
}

export function saveLegacyAutoSkipEndScreen(enabled: boolean): void {
  setValue(LEGACY_KEYS.autoSkipEndScreen, JSON.stringify(enabled))
}

export function saveLegacyAvatar(context: 'player' | 'opponent', avatar: AvatarData): void {
  const key = context === 'player' ? LEGACY_KEYS.playerAvatarData : LEGACY_KEYS.opponentAvatarData
  setValue(key, avatar)
}

export function saveLegacyDisplayConfig(config: {
  playerId: string
  opponentId: string
  optionWrapChars: number
  titleSpacingPx: number
  titleWrapChars: number
}): void {
  setValue(LEGACY_KEYS.playerId, normalizeDisplayId(config.playerId, DEFAULT_PLAYER_ID))
  setValue(LEGACY_KEYS.opponentId, normalizeDisplayId(config.opponentId, DEFAULT_OPPONENT_ID))
  setValue(LEGACY_KEYS.optionWrapChars, normalizeOptionWrapChars(config.optionWrapChars))
  setValue(LEGACY_KEYS.titleSpacingPx, normalizeTitleSpacingPx(config.titleSpacingPx))
  setValue(LEGACY_KEYS.titleWrapChars, normalizeTitleWrapChars(config.titleWrapChars))
}

export function saveLegacyQuestionSelectionStrategy(strategy: QuestionSelectionStrategy): void {
  setValue(LEGACY_KEYS.questionSelectionStrategy, normalizeQuestionSelectionStrategy(strategy))
}

export function saveLegacyQuestionSelectionCommonSenseType(type: string): void {
  setValue(LEGACY_KEYS.questionSelectionCommonSenseType, type.trim())
}

export function saveLegacyQuestionRandomMode(mode: QuestionRandomMode): void {
  setValue(LEGACY_KEYS.questionRandomMode, normalizeQuestionRandomMode(mode))
}

export function saveLegacyAutoMasterTimeLeft(value: number): void {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
  setValue(LEGACY_KEYS.autoMasterTimeLeft, normalized)
}

export function saveLegacyAutoUnmasterOverSeconds(value: number): void {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
  setValue(LEGACY_KEYS.autoUnmasterOverSeconds, normalized)
}
