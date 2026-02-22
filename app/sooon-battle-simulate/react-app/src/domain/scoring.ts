export function calculateScore(isCorrect: boolean, timeLeft: number): number {
  if (!isCorrect) return 0
  const safe = Number.isFinite(timeLeft) ? Math.max(0, timeLeft) : 0
  return safe
}
