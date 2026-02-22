export interface NormalizedSettingsInput {
  accuracyPercent: number
  minSpeedMs: number
  maxSpeedMs: number
  optionWrapChars: number
  titleSpacingPx: number
  titleWrapChars: number
}

export const DEFAULT_PLAYER_ID = '你'
export const DEFAULT_OPPONENT_ID = 'AI'
export const DEFAULT_OPTION_WRAP_CHARS = 16
export const DEFAULT_TITLE_SPACING_PX = 30
export const DEFAULT_TITLE_WRAP_CHARS = 0

const MAX_OPTION_WRAP_CHARS = 40
const MAX_TITLE_SPACING_PX = 120
const MAX_TITLE_WRAP_CHARS = 80
const MAX_DISPLAY_ID_LENGTH = 24

export function sanitizeDigitsInput(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}

export function normalizeAccuracyPercent(input: number): number {
  if (!Number.isFinite(input)) return 0
  return Math.min(100, Math.max(0, Math.round(input)))
}

export function normalizeSpeedMs(input: number, fallback: number): number {
  if (!Number.isFinite(input)) return fallback
  return Math.min(5000, Math.max(100, Math.round(input)))
}

export function normalizeSpeedRange(min: number, max: number): [number, number] {
  const a = normalizeSpeedMs(min, 1280)
  const b = normalizeSpeedMs(max, 2900)
  return a <= b ? [a, b] : [b, a]
}

export function normalizeOptionWrapChars(input: number): number {
  if (!Number.isFinite(input)) return DEFAULT_OPTION_WRAP_CHARS
  return Math.min(MAX_OPTION_WRAP_CHARS, Math.max(1, Math.round(input)))
}

export function normalizeTitleSpacingPx(input: number): number {
  if (!Number.isFinite(input)) return DEFAULT_TITLE_SPACING_PX
  return Math.min(MAX_TITLE_SPACING_PX, Math.max(0, Math.round(input)))
}

export function normalizeTitleWrapChars(input: number): number {
  if (!Number.isFinite(input)) return DEFAULT_TITLE_WRAP_CHARS
  return Math.min(MAX_TITLE_WRAP_CHARS, Math.max(0, Math.round(input)))
}

export function normalizeDisplayId(input: string, fallback: string): string {
  const normalized = input.trim()
  if (normalized.length === 0) return fallback
  return normalized.slice(0, MAX_DISPLAY_ID_LENGTH)
}

export function toAccuracyRatio(accuracyPercent: number): number {
  return normalizeAccuracyPercent(accuracyPercent) / 100
}

export function normalizeSettings(input: {
  accuracyPercent: number
  minSpeedMs: number
  maxSpeedMs: number
  optionWrapChars: number
  titleSpacingPx: number
  titleWrapChars: number
}): NormalizedSettingsInput {
  const accuracyPercent = normalizeAccuracyPercent(input.accuracyPercent)
  const [minSpeedMs, maxSpeedMs] = normalizeSpeedRange(input.minSpeedMs, input.maxSpeedMs)
  const optionWrapChars = normalizeOptionWrapChars(input.optionWrapChars)
  const titleSpacingPx = normalizeTitleSpacingPx(input.titleSpacingPx)
  const titleWrapChars = normalizeTitleWrapChars(input.titleWrapChars)

  return {
    accuracyPercent,
    minSpeedMs,
    maxSpeedMs,
    optionWrapChars,
    titleSpacingPx,
    titleWrapChars,
  }
}
