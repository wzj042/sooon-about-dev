import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

import type { QuestionRandomMode, QuestionSelectionStrategy } from '../../domain/types'
import type { CommonSenseSubtypeCounts, QuestionSelectionCounts } from '../../services/questionSelection'
import { DEFAULT_AVATAR_SRC, isImageAvatarSource } from '../../domain/avatar'
import { normalizePublicAssetUrl } from '../../utils/publicAsset'
import {
  DEFAULT_OPPONENT_ID,
  DEFAULT_OPTION_WRAP_CHARS,
  DEFAULT_PLAYER_ID,
  DEFAULT_TITLE_SPACING_PX,
  DEFAULT_TITLE_WRAP_CHARS,
  normalizeDisplayId,
  normalizeSettings,
  sanitizeDigitsInput,
  toAccuracyRatio,
} from '../../domain/validation'
import { DisplaySettingsFields } from './DisplaySettingsFields'
import { Modal } from '../shared/Modal'

interface SettingsModalProps {
  open: boolean
  values: {
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
  commonSenseSubtypeCounts: CommonSenseSubtypeCounts
  questionSelectionCounts: QuestionSelectionCounts
  questionSelectionCountsLoading?: boolean
  playerAvatarHtml: string
  opponentAvatarHtml: string
  onOpenAvatarModal: (context: 'player' | 'opponent') => void
  onApply: (params: {
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
  }) => void
  disableQuestionSelectionStrategy?: boolean
  onClose: () => void
}

interface DraftState {
  accuracy: string
  min: string
  max: string
  avatarFixed: boolean
  autoSkipEndScreen: boolean
  playerId: string
  opponentId: string
  optionWrapChars: string
  titleSpacingPx: string
  titleWrapChars: string
  questionSelectionStrategy: QuestionSelectionStrategy
  questionSelectionCommonSenseType: string
  questionRandomMode: QuestionRandomMode
  autoMasterTimeLeft: string
}

function renderAvatar(html: string, fallbackSrc = DEFAULT_AVATAR_SRC) {
  const trimmed = html.trim()

  if (trimmed.includes('<svg')) {
    return <span dangerouslySetInnerHTML={{ __html: trimmed }} />
  }

  if (isImageAvatarSource(trimmed)) {
    return <img alt="avatar" src={normalizePublicAssetUrl(trimmed)} />
  }

  if (trimmed.length > 0) {
    return <span>{trimmed}</span>
  }

  return <img alt="default avatar" src={fallbackSrc} />
}

function onlyNumericKeyboard(event: ReactKeyboardEvent<HTMLInputElement>) {
  const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (allowed.includes(event.key)) return

  if (!/^[0-9]$/.test(event.key)) {
    event.preventDefault()
  }
}

export function SettingsModal({
  open,
  values,
  commonSenseSubtypeCounts,
  questionSelectionCounts,
  questionSelectionCountsLoading = false,
  playerAvatarHtml,
  opponentAvatarHtml,
  onOpenAvatarModal,
  onApply,
  disableQuestionSelectionStrategy = false,
  onClose,
}: SettingsModalProps) {
  const {
    accuracyPercent,
    minSpeedMs,
    maxSpeedMs,
    avatarFixed,
    autoSkipEndScreen,
    playerId,
    opponentId,
    optionWrapChars,
    titleSpacingPx,
    titleWrapChars,
    questionSelectionStrategy,
    questionSelectionCommonSenseType,
    questionRandomMode,
    autoMasterTimeLeft,
  } = values

  const [draft, setDraft] = useState<DraftState>({
    accuracy: '0',
    min: '1280',
    max: '2900',
    avatarFixed: false,
    autoSkipEndScreen: false,
    playerId: DEFAULT_PLAYER_ID,
    opponentId: DEFAULT_OPPONENT_ID,
    optionWrapChars: String(DEFAULT_OPTION_WRAP_CHARS),
    titleSpacingPx: String(DEFAULT_TITLE_SPACING_PX),
    titleWrapChars: String(DEFAULT_TITLE_WRAP_CHARS),
    questionSelectionStrategy: 'all_questions',
    questionSelectionCommonSenseType: '',
    questionRandomMode: 'shuffled_cycle',
    autoMasterTimeLeft: '0',
  })

  useEffect(() => {
    if (!open) return
    setDraft({
      accuracy: String(accuracyPercent),
      min: String(minSpeedMs),
      max: String(maxSpeedMs),
      avatarFixed,
      autoSkipEndScreen,
      playerId,
      opponentId,
      optionWrapChars: String(optionWrapChars),
      titleSpacingPx: String(titleSpacingPx),
      titleWrapChars: String(titleWrapChars),
      questionSelectionStrategy,
      questionSelectionCommonSenseType,
      questionRandomMode,
      autoMasterTimeLeft: String(autoMasterTimeLeft),
    })
  }, [
    accuracyPercent,
    avatarFixed,
    autoSkipEndScreen,
    maxSpeedMs,
    minSpeedMs,
    open,
    optionWrapChars,
    opponentId,
    playerId,
    questionRandomMode,
    questionSelectionStrategy,
    questionSelectionCommonSenseType,
    titleSpacingPx,
    titleWrapChars,
    autoMasterTimeLeft,
  ])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  const normalized = useMemo(() => {
    const nextAccuracyPercent = Number.parseInt(draft.accuracy, 10)
    const nextMinSpeedMs = Number.parseInt(draft.min, 10)
    const nextMaxSpeedMs = Number.parseInt(draft.max, 10)
    const nextOptionWrapChars = Number.parseInt(draft.optionWrapChars, 10)
    const nextTitleSpacingPx = Number.parseInt(draft.titleSpacingPx, 10)
    const nextTitleWrapChars = Number.parseInt(draft.titleWrapChars, 10)
    const nextAutoMasterTimeLeft = Number.parseInt(draft.autoMasterTimeLeft, 10)
    const normalizedAutoMasterTimeLeft = Number.isFinite(nextAutoMasterTimeLeft) ? Math.max(0, nextAutoMasterTimeLeft) : 0

    const normalizedSettings = normalizeSettings({
      accuracyPercent: nextAccuracyPercent,
      minSpeedMs: nextMinSpeedMs,
      maxSpeedMs: nextMaxSpeedMs,
      optionWrapChars: nextOptionWrapChars,
      titleSpacingPx: nextTitleSpacingPx,
      titleWrapChars: nextTitleWrapChars,
    })
    return {
      ...normalizedSettings,
      autoMasterTimeLeft: normalizedAutoMasterTimeLeft,
    }
  }, [
    draft.accuracy,
    draft.autoMasterTimeLeft,
    draft.max,
    draft.min,
    draft.optionWrapChars,
    draft.titleSpacingPx,
    draft.titleWrapChars,
  ])

  const commit = (shouldClose = false) => {
    const normalizedPlayerId = normalizeDisplayId(draft.playerId, DEFAULT_PLAYER_ID)
    const normalizedOpponentId = normalizeDisplayId(draft.opponentId, DEFAULT_OPPONENT_ID)

    onApply({
      ...normalized,
      avatarFixed: draft.avatarFixed,
      autoSkipEndScreen: draft.autoSkipEndScreen,
      accuracyRatio: toAccuracyRatio(normalized.accuracyPercent),
      speedRange: [normalized.minSpeedMs, normalized.maxSpeedMs],
      playerId: normalizedPlayerId,
      opponentId: normalizedOpponentId,
      optionWrapChars: normalized.optionWrapChars,
      titleSpacingPx: normalized.titleSpacingPx,
      titleWrapChars: normalized.titleWrapChars,
      questionSelectionStrategy: draft.questionSelectionStrategy,
      questionSelectionCommonSenseType: draft.questionSelectionCommonSenseType,
      questionRandomMode: draft.questionRandomMode,
      autoMasterTimeLeft: normalized.autoMasterTimeLeft,
    })

    setDraft((prev) => ({
      ...prev,
      accuracy: String(normalized.accuracyPercent),
      min: String(normalized.minSpeedMs),
      max: String(normalized.maxSpeedMs),
      playerId: normalizedPlayerId,
      opponentId: normalizedOpponentId,
      optionWrapChars: String(normalized.optionWrapChars),
      titleSpacingPx: String(normalized.titleSpacingPx),
      titleWrapChars: String(normalized.titleWrapChars),
      questionSelectionStrategy: prev.questionSelectionStrategy,
      questionSelectionCommonSenseType: prev.questionSelectionCommonSenseType,
      questionRandomMode: prev.questionRandomMode,
      autoMasterTimeLeft: String(normalized.autoMasterTimeLeft),
    }))

    if (shouldClose) {
      onClose()
    }
  }

  const strategyAvailableCount =
    draft.questionSelectionStrategy === 'common_sense_only' && draft.questionSelectionCommonSenseType
      ? (commonSenseSubtypeCounts[draft.questionSelectionCommonSenseType] ?? 0)
      : (questionSelectionCounts[draft.questionSelectionStrategy] ?? 0)
  const totalQuestionCount = questionSelectionCounts.all_questions
  const strategyAvailabilityText = questionSelectionCountsLoading
    ? '正在统计当前策略可用题数...'
    : `当前策略可选题数 ${strategyAvailableCount} / ${totalQuestionCount}`
  const randomModeDescription = questionSelectionCountsLoading
    ? '正在统计题目池...'
    : draft.questionRandomMode === 'shuffled_cycle'
      ? `从这 ${strategyAvailableCount} 题中打乱后依次出题，不重复`
      : `从这 ${strategyAvailableCount} 题中每轮随机抽取，可重复`
  const formatCount = (count: number) => (questionSelectionCountsLoading ? '...' : String(count))
  const strategyOptions: Array<{ value: QuestionSelectionStrategy; label: string }> = [
    { value: 'all_questions', label: `全部题目 (${formatCount(questionSelectionCounts.all_questions)})` },
    { value: 'unseen_first', label: `做未做过的题 (${formatCount(questionSelectionCounts.unseen_first)})` },
    { value: 'mistake_focused', label: `做易错题 (${formatCount(questionSelectionCounts.mistake_focused)})` },
    { value: 'slow_thinking_focused', label: `做想得久的题 (${formatCount(questionSelectionCounts.slow_thinking_focused)})` },
    { value: 'common_sense_only', label: `做常识题 (${formatCount(questionSelectionCounts.common_sense_only)})` },
    { value: 'ethics_only', label: `做素问题 (${formatCount(questionSelectionCounts.ethics_only)})` },
    { value: 'unmastered_only', label: `做未掌握题 (${formatCount(questionSelectionCounts.unmastered_only)})` },
    { value: 'mastered_only', label: `做掌握题 (${formatCount(questionSelectionCounts.mastered_only)})` },
  ]
  const commonSenseSubtypeOptions = useMemo(
    () =>
      Object.entries(commonSenseSubtypeCounts).sort(([left], [right]) => left.localeCompare(right, 'zh-CN')),
    [commonSenseSubtypeCounts],
  )

  return (
    <Modal open={open} title="游戏设置" onClose={onClose}>
      <div className="modal-body">
        <div className="setting-group">
          <label className="setting-label">头像设置</label>
          <div className="avatar-settings">
            <div className="avatar-setting-item">
              <div className="avatar-preview" id="user-avatar-preview">
                <div className="avatar">{renderAvatar(playerAvatarHtml)}</div>
              </div>
              <div className="avatar-info">
                <div className="avatar-name">玩家头像</div>
                <button className="btn btn-outline" id="change-user-avatar" type="button" onClick={() => onOpenAvatarModal('player')}>
                  更换玩家头像
                </button>
              </div>
            </div>
            <div className="avatar-setting-item">
              <div className="avatar-preview" id="ai-avatar-preview">
                <div className="opponent-avatar">{renderAvatar(opponentAvatarHtml)}</div>
              </div>
              <div className="avatar-info">
                <div className="avatar-name">AI 头像</div>
                <button className="btn btn-outline" id="change-ai-avatar" type="button" onClick={() => onOpenAvatarModal('opponent')}>
                  更换 AI 头像
                </button>
              </div>
            </div>
          </div>
          <div className="setting-description">点击可更换玩家或 AI 头像</div>
        </div>

        <div className="setting-group">
          <label className="setting-label" htmlFor="player-id">
            玩家ID
          </label>
          <input
            className="setting-input"
            id="player-id"
            maxLength={24}
            placeholder="玩家ID"
            type="text"
            value={draft.playerId}
            onBlur={() => commit(false)}
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                playerId: event.target.value,
              }))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commit(false)
              }
            }}
          />
          <div className="setting-description">显示在玩家分数下方</div>
        </div>

        <div className="setting-group">
          <label className="setting-label" htmlFor="opponent-id">
            对手ID
          </label>
          <input
            className="setting-input"
            id="opponent-id"
            maxLength={24}
            placeholder="对手ID"
            type="text"
            value={draft.opponentId}
            onBlur={() => commit(false)}
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                opponentId: event.target.value,
              }))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commit(false)
              }
            }}
          />
          <div className="setting-description">显示在对手分数下方</div>
        </div>

        <DisplaySettingsFields
          idPrefix="game"
          optionWrapChars={draft.optionWrapChars}
          titleSpacingPx={draft.titleSpacingPx}
          titleWrapChars={draft.titleWrapChars}
          onChangeOptionWrapChars={(value) => {
            setDraft((prev) => ({
              ...prev,
              optionWrapChars: value,
            }))
          }}
          onChangeTitleSpacingPx={(value) => {
            setDraft((prev) => ({
              ...prev,
              titleSpacingPx: value,
            }))
          }}
          onChangeTitleWrapChars={(value) => {
            setDraft((prev) => ({
              ...prev,
              titleWrapChars: value,
            }))
          }}
          onCommit={() => commit(false)}
        />

        <div className="setting-group">
          <label className="setting-label" htmlFor="question-selection-strategy">
            答题策略
          </label>
          <select
            className="setting-input"
            disabled={disableQuestionSelectionStrategy}
            id="question-selection-strategy"
            value={draft.questionSelectionStrategy}
            onBlur={() => commit(false)}
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                questionSelectionStrategy: event.target.value as QuestionSelectionStrategy,
              }))
            }}
          >
            {strategyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="setting-description">
            {disableQuestionSelectionStrategy ? '当前为队列顺序答题模式，题目来源策略已禁用' : strategyAvailabilityText}
          </div>
        </div>

        {draft.questionSelectionStrategy === 'common_sense_only' ? (
          <div className="setting-group">
            <label className="setting-label" htmlFor="question-selection-common-sense-type">
              常识细分类型
            </label>
            <select
              className="setting-input"
              disabled={disableQuestionSelectionStrategy}
              id="question-selection-common-sense-type"
              value={draft.questionSelectionCommonSenseType}
              onBlur={() => commit(false)}
              onChange={(event) => {
                setDraft((prev) => ({
                  ...prev,
                  questionSelectionCommonSenseType: event.target.value,
                }))
              }}
            >
              <option value="">全部常识 ({formatCount(questionSelectionCounts.common_sense_only)})</option>
              {commonSenseSubtypeOptions.map(([type, count]) => (
                <option key={type} value={type}>
                  {type} ({count})
                </option>
              ))}
            </select>
            <div className="setting-description">列出当前题库中除“素问”和“常识”外的常识细分 type</div>
          </div>
        ) : null}

        <div className="setting-group">
          <label className="setting-label" htmlFor="question-random-mode">
            随机答题策略
          </label>
          <select
            className="setting-input"
            disabled={disableQuestionSelectionStrategy}
            id="question-random-mode"
            value={draft.questionRandomMode}
            onBlur={() => commit(false)}
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                questionRandomMode: event.target.value as QuestionRandomMode,
              }))
            }}
          >
            <option value="shuffled_cycle">打乱遍历</option>
            <option value="per_round_random">每轮随机抽</option>
          </select>
          <div className="setting-description">
            {disableQuestionSelectionStrategy ? '当前为队列顺序答题模式，随机答题策略已禁用' : randomModeDescription}
          </div>
        </div>

        <div className="setting-group">
          <label className="setting-label" htmlFor="ai-accuracy">
            AI 准确率（%）
          </label>
          <input
            className="setting-input"
            id="ai-accuracy"
            inputMode="numeric"
            max="100"
            min="0"
            pattern="[0-9]*"
            placeholder="0-100"
            step="1"
            type="text"
            value={draft.accuracy}
            onBlur={() => commit(false)}
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                accuracy: sanitizeDigitsInput(event.target.value),
              }))
            }}
            onKeyDown={(event) => {
              onlyNumericKeyboard(event)
              if (event.key === 'Enter') {
                commit(false)
              }
            }}
          />
          <div className="setting-description">0-100</div>
        </div>

        <div className="setting-group">
          <label className="setting-label">AI 速度范围（毫秒）</label>
          <div className="speed-inputs">
            <input
              className="setting-input"
              id="ai-speed-min"
              inputMode="numeric"
              max="5000"
              min="100"
              pattern="[0-9]*"
              placeholder="最小"
              step="100"
              type="text"
              value={draft.min}
              onBlur={() => commit(false)}
              onChange={(event) => {
                setDraft((prev) => ({
                  ...prev,
                  min: sanitizeDigitsInput(event.target.value),
                }))
              }}
              onKeyDown={(event) => {
                onlyNumericKeyboard(event)
                if (event.key === 'Enter') {
                  commit(false)
                }
              }}
            />
            <span className="speed-separator">-</span>
            <input
              className="setting-input"
              id="ai-speed-max"
              inputMode="numeric"
              max="5000"
              min="100"
              pattern="[0-9]*"
              placeholder="最大"
              step="100"
              type="text"
              value={draft.max}
              onBlur={() => commit(false)}
              onChange={(event) => {
                setDraft((prev) => ({
                  ...prev,
                  max: sanitizeDigitsInput(event.target.value),
                }))
              }}
              onKeyDown={(event) => {
                onlyNumericKeyboard(event)
                if (event.key === 'Enter') {
                  commit(false)
                }
              }}
            />
          </div>
          <div className="setting-description">100-5000</div>
        </div>

        <div className="setting-group">
          <label className="setting-label" htmlFor="auto-master-time-left">
            自动标注掌握阈值
          </label>
          <input
            className="setting-input"
            id="auto-master-time-left"
            inputMode="numeric"
            max="999"
            min="0"
            pattern="[0-9]*"
            placeholder="留空表示关闭"
            step="1"
            type="text"
            value={draft.autoMasterTimeLeft}
            onBlur={() => commit(false)}
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                autoMasterTimeLeft: sanitizeDigitsInput(event.target.value),
              }))
            }}
            onKeyDown={(event) => {
              onlyNumericKeyboard(event)
              if (event.key === 'Enter') {
                commit(false)
              }
            }}
          />
          <div className="setting-description">倒计时大于等于该数值且答对时，自动标注掌握</div>
        </div>

        <div className="setting-group">
          <label className="setting-label" htmlFor="fix-opponent-avatar">
            固定头像
          </label>
          <div className="checkbox-setting">
            <input
              checked={draft.avatarFixed}
              className="setting-checkbox"
              id="fix-opponent-avatar"
              type="checkbox"
              onChange={(event) => {
                setDraft((prev) => ({
                  ...prev,
                  avatarFixed: event.target.checked,
                }))
              }}
            />
            <label className="checkbox-label" htmlFor="fix-opponent-avatar">
              保持 AI 头像在游戏中固定不变
            </label>
          </div>
          <div className="setting-description">关闭时，新游戏会刷新 AI 头像</div>
        </div>

        <div className="setting-group">
          <label className="setting-label" htmlFor="auto-skip-end-screen">
            自动跳过结束画面
          </label>
          <div className="checkbox-setting">
            <input
              checked={draft.autoSkipEndScreen}
              className="setting-checkbox"
              id="auto-skip-end-screen"
              type="checkbox"
              onChange={(event) => {
                setDraft((prev) => ({
                  ...prev,
                  autoSkipEndScreen: event.target.checked,
                }))
              }}
            />
            <label className="checkbox-label" htmlFor="auto-skip-end-screen">
              结果画面后自动开始下一局
            </label>
          </div>
          <div className="setting-description">启用后无需手动点击继续</div>
        </div>


      </div>

      <div className="modal-footer">
        <button className="btn btn-primary" id="save-settings" type="button" onClick={() => commit(true)}>
          保存
        </button>
        <button className="btn btn-secondary" id="cancel-settings" type="button" onClick={onClose}>
          取消
        </button>
      </div>
    </Modal>
  )
}
