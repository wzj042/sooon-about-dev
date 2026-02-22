import { useEffect, useRef, useState, type CSSProperties } from 'react'

interface ScoreEvent {
  score: number
  isPlayer: boolean
  timestamp: number
}

interface FlyItem extends ScoreEvent {
  id: string
  startX: number
  startY: number
  endX: number
  endY: number
}

interface ScoreFlyAnimationProps {
  scoreAnimation: false | ScoreEvent
}

export function ScoreFlyAnimation({ scoreAnimation }: ScoreFlyAnimationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [items, setItems] = useState<FlyItem[]>([])

  useEffect(() => {
    if (!scoreAnimation) return

    const container = containerRef.current
    if (!container) return

    const quizContainer = container.closest('.quiz-container')
    const timerElement = quizContainer?.querySelector('.timer-container') as HTMLElement | null
    const targetSelector = scoreAnimation.isPlayer ? '.player-score' : '.opponent-score .score-number'
    const targetElement = quizContainer?.querySelector(targetSelector) as HTMLElement | null

    const scoreLabel = `+${Math.round(scoreAnimation.score)}`
    const measureElement = document.createElement('div')
    measureElement.className = 'score-animation-text'
    measureElement.style.visibility = 'hidden'
    measureElement.style.transform = 'none'
    measureElement.textContent = scoreLabel
    container.appendChild(measureElement)
    const textWidth = measureElement.offsetWidth
    measureElement.remove()

    const containerRect = container.getBoundingClientRect()
    const timerRect = timerElement?.getBoundingClientRect()
    const targetRect = targetElement?.getBoundingClientRect()

    const startX = timerRect
      ? timerRect.left + timerRect.width / 2 - containerRect.left - textWidth / 2
      : containerRect.width / 2 - textWidth / 2
    const startY = timerRect ? timerRect.bottom - containerRect.top + 8 : containerRect.height * 0.16

    const endX = targetRect
      ? targetRect.left + targetRect.width / 2 - containerRect.left - textWidth / 2
      : startX + (scoreAnimation.isPlayer ? -130 : 130)
    const endY = targetRect ? targetRect.bottom - containerRect.top + 8 : startY

    const next: FlyItem = {
      id: `${scoreAnimation.timestamp}-${scoreAnimation.isPlayer ? 'player' : 'opponent'}`,
      ...scoreAnimation,
      startX,
      startY,
      endX,
      endY,
    }

    setItems((prev) => [...prev, next])

    const timer = window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== next.id))
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [scoreAnimation])

  return (
    <div ref={containerRef} className="score-animation-container" id="score-animation-container">
      {items.map((item) => {
        const style = {
          '--start-x': `${item.startX}px`,
          '--start-y': `${item.startY}px`,
          '--end-x': `${item.endX}px`,
          '--end-y': `${item.endY}px`,
        } as CSSProperties

        return (
          <div key={item.id} className="score-animation-text animate" style={style}>
            +{Math.round(item.score)}
          </div>
        )
      })}
    </div>
  )
}
