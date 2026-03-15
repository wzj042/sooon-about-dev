import { normalizeOptionWrapChars, normalizeTitleSpacingPx, normalizeTitleWrapChars } from '../domain/validation'
import { getJson, setValue } from './storage'

const PRACTICE_QUEUE_SETTINGS_KEY = 'sooon-practice-queue-settings'

export interface PracticeQueueSettings {
  optionWrapChars: number
  titleSpacingPx: number
  titleWrapChars: number
  autoMasterWithinSeconds: number
  autoUnmasterOverSeconds: number
  autoNextDelaySeconds: number
  manualNextOnWrong: boolean
}

function normalizeAutoMasterSeconds(raw: unknown): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

function normalizeAutoNextDelaySeconds(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 1
  return normalizeAutoMasterSeconds(raw)
}

function normalizeManualNextOnWrong(raw: unknown): boolean {
  return raw === true
}

function normalizeSettings(raw: Partial<PracticeQueueSettings> | null | undefined): PracticeQueueSettings {
  return {
    optionWrapChars: normalizeOptionWrapChars(Number(raw?.optionWrapChars)),
    titleSpacingPx: normalizeTitleSpacingPx(Number(raw?.titleSpacingPx)),
    titleWrapChars: normalizeTitleWrapChars(Number(raw?.titleWrapChars)),
    autoMasterWithinSeconds: normalizeAutoMasterSeconds(raw?.autoMasterWithinSeconds),
    autoUnmasterOverSeconds: normalizeAutoMasterSeconds(raw?.autoUnmasterOverSeconds),
    autoNextDelaySeconds: normalizeAutoNextDelaySeconds(raw?.autoNextDelaySeconds),
    manualNextOnWrong: normalizeManualNextOnWrong(raw?.manualNextOnWrong),
  }
}

export function loadPracticeQueueSettings(): PracticeQueueSettings {
  const raw = getJson<Record<string, unknown>>(PRACTICE_QUEUE_SETTINGS_KEY, {})
  return normalizeSettings(raw as Partial<PracticeQueueSettings>)
}

export function savePracticeQueueSettings(next: PracticeQueueSettings): void {
  setValue(PRACTICE_QUEUE_SETTINGS_KEY, normalizeSettings(next))
}
