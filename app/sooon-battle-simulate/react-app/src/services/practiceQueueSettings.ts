import {
  DEFAULT_OPTION_WRAP_CHARS,
  DEFAULT_TITLE_SPACING_PX,
  DEFAULT_TITLE_WRAP_CHARS,
  normalizeOptionWrapChars,
  normalizeTitleSpacingPx,
  normalizeTitleWrapChars,
} from '../domain/validation'
import { getJson, setValue } from './storage'

const PRACTICE_QUEUE_SETTINGS_KEY = 'sooon-practice-queue-settings'

export interface PracticeQueueSettings {
  optionWrapChars: number
  titleSpacingPx: number
  titleWrapChars: number
  autoMasterWithinSeconds: number
}

function normalizeAutoMasterSeconds(raw: unknown): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

function normalizeSettings(raw: Partial<PracticeQueueSettings> | null | undefined): PracticeQueueSettings {
  return {
    optionWrapChars: normalizeOptionWrapChars(Number(raw?.optionWrapChars)),
    titleSpacingPx: normalizeTitleSpacingPx(Number(raw?.titleSpacingPx)),
    titleWrapChars: normalizeTitleWrapChars(Number(raw?.titleWrapChars)),
    autoMasterWithinSeconds: normalizeAutoMasterSeconds(raw?.autoMasterWithinSeconds),
  }
}

export function loadPracticeQueueSettings(): PracticeQueueSettings {
  const raw = getJson<Record<string, unknown>>(PRACTICE_QUEUE_SETTINGS_KEY, {})
  return normalizeSettings(raw as Partial<PracticeQueueSettings>)
}

export function savePracticeQueueSettings(next: PracticeQueueSettings): void {
  setValue(PRACTICE_QUEUE_SETTINGS_KEY, normalizeSettings(next))
}
