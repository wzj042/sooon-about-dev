import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

import type { QuestionSelectionStrategy } from '../../domain/types'
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
  }
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
  }) => void
  onExportUserData: () => void
  onImportUserData: (file: File) => void
  userDataTransferBusy: boolean
  userDataTransferMessage: string | null
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
  playerAvatarHtml,
  opponentAvatarHtml,
  onOpenAvatarModal,
  onApply,
  onExportUserData,
  onImportUserData,
  userDataTransferBusy,
  userDataTransferMessage,
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
    questionSelectionStrategy: 'shuffled_traversal_recent_first',
  })
  const importInputRef = useRef<HTMLInputElement | null>(null)

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
    questionSelectionStrategy,
    titleSpacingPx,
    titleWrapChars,
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

    return normalizeSettings({
      accuracyPercent: nextAccuracyPercent,
      minSpeedMs: nextMinSpeedMs,
      maxSpeedMs: nextMaxSpeedMs,
      optionWrapChars: nextOptionWrapChars,
      titleSpacingPx: nextTitleSpacingPx,
      titleWrapChars: nextTitleWrapChars,
    })
  }, [draft.accuracy, draft.max, draft.min, draft.optionWrapChars, draft.titleSpacingPx, draft.titleWrapChars])

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
    }))

    if (shouldClose) {
      onClose()
    }
  }

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

        <div className="setting-group">
          <label className="setting-label" htmlFor="option-wrap-chars">
            选项换行字符数
          </label>
          <input
            className="setting-input"
            id="option-wrap-chars"
            inputMode="numeric"
            max="40"
            min="1"
            pattern="[0-9]*"
            placeholder="16"
            step="1"
            type="text"
            value={draft.optionWrapChars}
            onBlur={() => commit(false)}
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                optionWrapChars: sanitizeDigitsInput(event.target.value),
              }))
            }}
            onKeyDown={(event) => {
              onlyNumericKeyboard(event)
              if (event.key === 'Enter') {
                commit(false)
              }
            }}
          />
          <div className="setting-description">默认 16</div>
        </div>

        <div className="setting-group">
          <label className="setting-label" htmlFor="title-spacing-px">
            标题间距（像素）
          </label>
          <input
            className="setting-input"
            id="title-spacing-px"
            inputMode="numeric"
            max="120"
            min="0"
            pattern="[0-9]*"
            placeholder="30"
            step="1"
            type="text"
            value={draft.titleSpacingPx}
            onBlur={() => commit(false)}
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                titleSpacingPx: sanitizeDigitsInput(event.target.value),
              }))
            }}
            onKeyDown={(event) => {
              onlyNumericKeyboard(event)
              if (event.key === 'Enter') {
                commit(false)
              }
            }}
          />
          <div className="setting-description">默认 30</div>
        </div>

        <div className="setting-group">
          <label className="setting-label" htmlFor="title-wrap-chars">
            标题换行字符数
          </label>
          <input
            className="setting-input"
            id="title-wrap-chars"
            inputMode="numeric"
            max="80"
            min="0"
            pattern="[0-9]*"
            placeholder="0"
            step="1"
            type="text"
            value={draft.titleWrapChars}
            onBlur={() => commit(false)}
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                titleWrapChars: sanitizeDigitsInput(event.target.value),
              }))
            }}
            onKeyDown={(event) => {
              onlyNumericKeyboard(event)
              if (event.key === 'Enter') {
                commit(false)
              }
            }}
          />
          <div className="setting-description">0 表示按容器宽度自动换行</div>
        </div>

        <div className="setting-group">
          <label className="setting-label" htmlFor="question-selection-strategy">
            选题策略
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
            <option value="repeatable_random">可重复随机</option>
            <option value="shuffled_traversal_recent_first">打乱后遍历（优先练新更新）</option>
            <option value="unseen_first">做未做过的题</option>
            <option value="mistake_focused">做易错题</option>
            <option value="slow_thinking_focused">做想得久的题</option>
            <option value="common_sense_only">做常识题（common_sense）</option>
            <option value="ethics_only">做伦理题</option>
            <option value="mastered_only">做掌握题</option>
          </select>
          <div className="setting-description">
            {disableQuestionSelectionStrategy ? '当前为队列顺序答题模式，题目来源策略已禁用' : '选择每局游戏如何选取题目'}
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

        <div className="setting-group">
          <label className="setting-label">用户数据</label>
          <div className="speed-inputs">
            <button className="btn btn-outline" disabled={userDataTransferBusy} type="button" onClick={onExportUserData}>
              导出用户数据
            </button>
            <button
              className="btn btn-outline"
              disabled={userDataTransferBusy}
              type="button"
              onClick={() => {
                importInputRef.current?.click()
              }}
            >
              导入用户数据
            </button>
            <input
              accept="application/json,.json"
              ref={importInputRef}
              style={{ display: 'none' }}
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                onImportUserData(file)
                event.target.value = ''
              }}
            />
          </div>
          <div className="setting-description">手动备份或恢复当前浏览器中的本地用户数据</div>
          {userDataTransferMessage ? <div className="setting-description">{userDataTransferMessage}</div> : null}
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
