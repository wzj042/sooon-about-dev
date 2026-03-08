interface TimerCircleProps {
  timeLeft: number
  currentMaxTime: number
  className?: string
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  const parsed = Number.parseInt(clean, 16)
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) => {
      const clamped = Math.max(0, Math.min(255, Math.round(value)))
      const hex = clamped.toString(16)
      return hex.length === 1 ? `0${hex}` : hex
    })
    .join('')}`
}

function interpolateColor(colorA: string, colorB: string, factor: number): string {
  const a = hexToRgb(colorA)
  const b = hexToRgb(colorB)

  return rgbToHex(a.r + (b.r - a.r) * factor, a.g + (b.g - a.g) * factor, a.b + (b.b - a.b) * factor)
}

function getProgressColor(progressPercent: number): string {
  const stops = [
    { percent: 1, color: '#2196F3' },
    { percent: 0.9, color: '#4CAF50' },
    { percent: 0.75, color: '#FFC107' },
    { percent: 0.5, color: '#FF9800' },
    { percent: 0, color: '#F44336' },
  ]

  for (let i = 0; i < stops.length - 1; i += 1) {
    const current = stops[i]
    const next = stops[i + 1]
    if (progressPercent <= current.percent && progressPercent >= next.percent) {
      const range = current.percent - next.percent
      const position = progressPercent - next.percent
      const factor = range === 0 ? 0 : position / range
      return interpolateColor(next.color, current.color, factor)
    }
  }

  return '#2196F3'
}

export function TimerCircle({ timeLeft, currentMaxTime, className }: TimerCircleProps) {
  const safeCurrentMaxTime = currentMaxTime > 0 ? currentMaxTime : 1
  const progressPercent = Math.max(0, Math.min(1, timeLeft / safeCurrentMaxTime))
  const progressDeg = progressPercent * 360

  const timerClass =
    progressPercent <= 0.2 ? 'danger' : progressPercent <= 0.5 ? 'warning' : progressPercent <= 0.8 ? 'success' : ''
  const color = getProgressColor(progressPercent)

  return (
    <div className={`timer-container ${className ?? ''}`.trim()}>
      <div className={`timer-circle ${timerClass}`}>
        <div
          className="timer-progress"
          style={{
            background: `conic-gradient(${color} 0deg ${progressDeg}deg, transparent ${progressDeg}deg 360deg)`,
          }}
        />
        <span style={{ position: 'relative', zIndex: 1 }}>{Math.ceil(timeLeft)}</span>
      </div>
    </div>
  )
}
