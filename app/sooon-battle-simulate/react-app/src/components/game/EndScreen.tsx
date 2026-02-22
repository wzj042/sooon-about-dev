import { useEffect, useMemo, useState } from 'react'

interface EndScreenProps {
  visible: boolean
  playerScore: number
  opponentScore: number
  practiceQueueMode: boolean
  practiceQueueTotal: number
  practiceQueuePracticed: number
  autoSkipEndScreen: boolean
  onToggleAutoSkipEndScreen: (enabled: boolean) => void
  onContinue: () => void
}

const WIN_EMOJIS = ['ヾ(＾∇＾)', 'ヽ(•‿•)ノ', '٩(ˊᗜˋ*)و', '\\(￣▽￣)/']
const LOSE_EMOJIS = ['(ｉДｉ)', '(T▽T)', '(0_0)', '(；д；)']
const DRAW_EMOJIS = ['(-__-°)', '(・_・;)']

function buildEmojiFrames(playerScore: number, opponentScore: number) {
  if (playerScore > opponentScore) return WIN_EMOJIS
  if (playerScore < opponentScore) return LOSE_EMOJIS
  return DRAW_EMOJIS.flatMap((emoji) => [emoji, emoji.split('').reverse().join('')])
}

function buildTitle(playerScore: number, opponentScore: number): string {
  if (playerScore > opponentScore) return '你赢了'
  if (playerScore < opponentScore) return '你输了'
  return '平局'
}

const AUTO_CONTINUE_DELAY_MS = 900

export function EndScreen({
  visible,
  playerScore,
  opponentScore,
  practiceQueueMode,
  practiceQueueTotal,
  practiceQueuePracticed,
  autoSkipEndScreen,
  onToggleAutoSkipEndScreen,
  onContinue,
}: EndScreenProps) {
  const frames = useMemo(() => (practiceQueueMode ? ['(•̀ᴗ•́)و'] : buildEmojiFrames(playerScore, opponentScore)), [playerScore, opponentScore, practiceQueueMode])
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    if (!visible) return
    setFrameIndex(0)
    const timer = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length)
    }, 900)

    return () => {
      window.clearInterval(timer)
    }
  }, [frames, visible])

  useEffect(() => {
    if (!visible) return
    if (!autoSkipEndScreen) return

    const timer = window.setTimeout(() => {
      onContinue()
    }, AUTO_CONTINUE_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [autoSkipEndScreen, onContinue, visible])

  const safeQueueTotal = Math.max(0, Math.floor(practiceQueueTotal))
  const safeQueuePracticed = Math.min(safeQueueTotal, Math.max(0, Math.floor(practiceQueuePracticed)))
  const safeQueueRemaining = Math.max(0, safeQueueTotal - safeQueuePracticed)
  const title = practiceQueueMode ? '本轮刷题完成' : buildTitle(playerScore, opponentScore)

  return (
    <div className="end-screen" id="end-screen" style={{ display: visible ? 'flex' : 'none' }}>
      <div className="end-title" id="end-title">
        {title}
      </div>
      <div className="end-emoji" id="end-emoji">
        {frames[frameIndex]}
      </div>
      {practiceQueueMode ? (
        <>
          <div className="setting-description">当前队列剩余题数：{safeQueueRemaining}</div>
          <div className="setting-description">当前已练习队列题数：{safeQueuePracticed}</div>
        </>
      ) : null}
      <div className="checkbox-setting">
        <input
          checked={autoSkipEndScreen}
          className="setting-checkbox"
          id="end-screen-auto-skip"
          type="checkbox"
          onChange={(event) => {
            onToggleAutoSkipEndScreen(event.target.checked)
          }}
        />
        <label className="checkbox-label" htmlFor="end-screen-auto-skip">
          自动跳过结果页并开新一局
        </label>
      </div>
      {autoSkipEndScreen ? <div className="setting-description">将在约 1 秒后自动开始下一局</div> : null}
      <button className="cta-button primary" id="continue-button" type="button" onClick={onContinue}>
        继续挑战
      </button>
    </div>
  )
}
