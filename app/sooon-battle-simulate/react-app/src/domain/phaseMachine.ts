import type { GamePhase } from './types'

export const PHASE_ORDER: GamePhase[] = ['ready', 'question', 'waiting', 'result', 'ended']

export function isTerminalPhase(phase: GamePhase): boolean {
  return phase === 'ended'
}
