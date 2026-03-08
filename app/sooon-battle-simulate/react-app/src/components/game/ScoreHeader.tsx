import { DEFAULT_AVATAR_SRC, isImageAvatarSource } from '../../domain/avatar'
import type { OpponentState } from '../../domain/types'
import { normalizePublicAssetUrl } from '../../utils/publicAsset'
import { TimerCircle } from './TimerCircle'

interface ScoreHeaderProps {
  playerScore: number
  opponentScore: number
  playerId: string
  opponentId: string
  timeLeft: number
  currentMaxTime: number
  playerAvatarHtml: string
  opponent: OpponentState
  onClickPlayerAvatar: () => void
  onClickOpponentAvatar: () => void
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

export function ScoreHeader({
  playerScore,
  opponentScore,
  playerId,
  opponentId,
  timeLeft,
  currentMaxTime,
  playerAvatarHtml,
  opponent,
  onClickPlayerAvatar,
  onClickOpponentAvatar,
}: ScoreHeaderProps) {
  return (
    <div className="header">
      <div className="player-info">
        <div className="player-avatar-wrap">
          <button className="avatar" type="button" title="Click to change player avatar" onClick={onClickPlayerAvatar}>
            {renderAvatar(playerAvatarHtml)}
          </button>
          <div className="player-id">{playerId}</div>
        </div>
        <div className="player-score">{Math.round(playerScore)}</div>
      </div>

      <TimerCircle currentMaxTime={currentMaxTime} timeLeft={timeLeft} />

      <div className="opponent-info">
        <div className="opponent-score">
          <div className="score-number">{Math.round(opponentScore)}</div>
        </div>
        <div className="opponent-avatar-wrap">
          <button className="opponent-avatar" title="Click to change AI avatar" type="button" onClick={onClickOpponentAvatar}>
            {renderAvatar(opponent.avatar)}
          </button>
          <div className="opponent-id">{opponentId}</div>
        </div>
      </div>
    </div>
  )
}
