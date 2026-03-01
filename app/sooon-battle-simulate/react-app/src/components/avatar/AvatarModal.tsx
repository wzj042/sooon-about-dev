import { useEffect, useMemo, useRef, useState } from 'react'

import { DEFAULT_AVATAR_SRC, isImageAvatarSource } from '../../domain/avatar'
import type { AvatarData } from '../../domain/types'
import { avatarToDataUri, buildAvatarExport, generateRandomAvatar, parseImportedAvatarText } from '../../services/avatarService'
import { normalizePublicAssetUrl } from '../../utils/publicAsset'
import { Modal } from '../shared/Modal'

interface AvatarModalProps {
  open: boolean
  context: 'player' | 'opponent'
  currentAvatarHtml: string
  onClose: () => void
  onSave: (context: 'player' | 'opponent', avatar: AvatarData) => void
}

const EMPTY_AVATAR: AvatarData = {
  svg: '',
  style: 'empty',
  seed: 'empty',
  size: 64,
  isFallback: true,
  timestamp: Date.now(),
}

function createDefaultAvatarData(): AvatarData {
  return {
    ...EMPTY_AVATAR,
    svg: DEFAULT_AVATAR_SRC,
    style: 'default',
    seed: `default-avatar-${Date.now()}`,
    isFallback: false,
    timestamp: Date.now(),
  }
}

function normalizeCurrentAvatar(currentAvatarHtml: string): AvatarData {
  const trimmed = currentAvatarHtml.trim()

  if (!trimmed) {
    return createDefaultAvatarData()
  }

  if (trimmed.includes('<svg')) {
    return {
      svg: trimmed,
      style: 'current',
      seed: `current-${Date.now()}`,
      size: 64,
      timestamp: Date.now(),
      isFallback: false,
    }
  }

  return {
    ...EMPTY_AVATAR,
    svg: trimmed,
    style: isImageAvatarSource(trimmed) ? 'image' : 'current',
    seed: `current-${Date.now()}`,
    isFallback: false,
    timestamp: Date.now(),
  }
}

function renderAvatarPreview(html: string) {
  const trimmed = html.trim()

  if (trimmed.includes('<svg')) {
    return <img alt="avatar" src={avatarToDataUri(trimmed)} />
  }

  if (isImageAvatarSource(trimmed)) {
    return <img alt="avatar" src={normalizePublicAssetUrl(trimmed)} />
  }

  if (trimmed.length > 0) {
    return <span>{trimmed}</span>
  }

  return <img alt="default avatar" src={DEFAULT_AVATAR_SRC} />
}

export function AvatarModal({ open, context, currentAvatarHtml, onClose, onSave }: AvatarModalProps) {
  const [avatarOptions, setAvatarOptions] = useState<AvatarData[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarData | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const currentAvatarData = useMemo(() => normalizeCurrentAvatar(currentAvatarHtml), [currentAvatarHtml])
  const isDefaultAvatarSelected = selectedIndex === null && selectedAvatar?.svg === DEFAULT_AVATAR_SRC

  const populateGrid = async () => {
    setLoading(true)
    const next = await Promise.all(Array.from({ length: 16 }).map(() => generateRandomAvatar()))
    setAvatarOptions(next)
    setSelectedIndex(null)
    setSelectedAvatar(null)
    setLoading(false)
  }

  useEffect(() => {
    if (!open) return
    populateGrid().catch(() => {
      setAvatarOptions([])
      setLoading(false)
    })
  }, [open])

  const title = context === 'player' ? '修改玩家头像' : '修改 AI 头像'

  return (
    <Modal open={open} contentClassName="avatar-modal-content" title={title} onClose={onClose}>
      <div className="modal-body">
        <div className="current-avatar-section">
          <div className="current-avatar-label">当前头像</div>
          <div className="current-avatar-display" id="current-avatar-display">
            {selectedAvatar?.svg ? renderAvatarPreview(selectedAvatar.svg) : renderAvatarPreview(currentAvatarHtml)}
          </div>
        </div>

        <div className="avatar-grid-section">
          <div className="avatar-grid-label">选择头像</div>
          <div className="avatar-grid" id="avatar-grid">
            <button
              className={`avatar-option ${isDefaultAvatarSelected ? 'selected' : ''}`}
              id="select-default-avatar"
              type="button"
              onClick={() => {
                setSelectedIndex(null)
                setSelectedAvatar(createDefaultAvatarData())
              }}
            >
              {renderAvatarPreview(DEFAULT_AVATAR_SRC)}
            </button>
            {avatarOptions.map((avatar, index) => (
              <button
                key={`${avatar.seed}-${index}`}
                className={`avatar-option ${selectedIndex === index ? 'selected' : ''}`}
                data-index={index}
                type="button"
                onClick={() => {
                  setSelectedIndex(index)
                  setSelectedAvatar(avatar)
                }}
              >
                {renderAvatarPreview(avatar.svg)}
              </button>
            ))}
          </div>
          {loading ? <div className="setting-description">头像生成中...</div> : null}
        </div>

        <div className="avatar-actions">
          <button
            className="btn btn-secondary"
            id="clear-avatar"
            type="button"
            onClick={() => {
              setSelectedIndex(null)
              setSelectedAvatar(createDefaultAvatarData())
            }}
          >
            重置默认头像
          </button>
          <button className="btn btn-primary" id="regenerate-avatars" type="button" onClick={() => populateGrid()}>
            重新生成
          </button>
        </div>

        <div className="avatar-import-export">
          <div className="import-export-label">头像管理</div>
          <div className="import-export-buttons">
            <button
              className="btn btn-outline"
              id="export-avatar"
              type="button"
              onClick={() => {
                const data = selectedAvatar ?? currentAvatarData
                const content = buildAvatarExport(data, selectedAvatar ? 'saved' : 'current')
                const blob = new Blob([content], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const anchor = document.createElement('a')
                anchor.href = url
                anchor.download = `sooon-avatar-${new Date().toISOString().split('T')[0]}.json`
                anchor.click()
                URL.revokeObjectURL(url)
              }}
            >
              导出头像
            </button>
            <button
              className="btn btn-outline"
              id="import-avatar"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              导入头像
            </button>
            <input
              ref={fileInputRef}
              accept=".json"
              id="avatar-file-input"
              style={{ display: 'none' }}
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return

                const reader = new FileReader()
                reader.onload = () => {
                  const imported = parseImportedAvatarText(String(reader.result ?? ''))
                  if (!imported) return

                  setSelectedIndex(null)
                  setSelectedAvatar(imported)
                }
                reader.readAsText(file)
                event.currentTarget.value = ''
              }}
            />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" id="cancel-avatar" type="button" onClick={onClose}>
          取消
        </button>
        <button
          className="btn btn-primary"
          id="save-avatar"
          type="button"
          onClick={() => {
            onSave(context, selectedAvatar ?? currentAvatarData)
            onClose()
          }}
        >
          保存
        </button>
      </div>
    </Modal>
  )
}

