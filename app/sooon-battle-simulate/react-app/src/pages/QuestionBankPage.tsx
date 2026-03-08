import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { APP_ROUTES } from '../app/paths'

import type { QuestionItem } from '../domain/types'
import {
  loadCachedQuestionBank,
  loadCachedQuestionBankPreview,
  loadQuestionBankCacheState,
  loadQuestionPool,
  type QuestionBankCacheState,
} from '../services/questionBank'
import { MIN_PRACTICE_QUEUE_ITEMS, savePracticeQueue } from '../services/practiceQueue'
import {
  averageResponseMs,
  loadQuestionStatsMap,
  setQuestionMastered,
  subscribeQuestionStats,
  type QuestionStatEntry,
  type QuestionStatsMap,
} from '../services/questionStats'

const CACHE_POLL_DELAY_MS = 1200
const MAX_CACHE_POLL_ROUNDS = 16
const ANSWER_LABELS = ['A', 'B', 'C', 'D'] as const

const VIRTUAL_ROW_HEIGHT = 188
const VIRTUAL_OVERSCAN = 6
const VIRTUAL_FALLBACK_VIEWPORT_HEIGHT = 640
const MAX_VIRTUAL_RENDER_ROWS = 28
const MIN_TABLE_WIDTH_PX = 1200
const INITIAL_CACHE_PREVIEW_ROWS = 240
const OPTIONS_REVEAL_SESSION_KEY = 'question-bank-options-reveal-map'
const FILTER_STATE_STORAGE_KEY = 'question-bank-filter-state'
const SUWEN_TYPE = '素问'
const COMMON_SENSE_TYPE_VALUE = '__common_sense_non_suwen__'
const COMMON_SENSE_TYPE_LABEL = '🌌常识'
const TYPE_FILTERS: TypeFilter[] = ['all', 'with_type', 'without_type']
const STATS_FILTERS: StatsFilterMode[] = ['all', 'wrong_only', 'unseen_only', 'mastered_only']
const SORT_MODES: SortMode[] = [
  'updated_desc',
  'updated_asc',
  'wrong_desc',
  'wrong_asc',
  'answered_at_desc',
  'answered_at_asc',
  'response_ms_desc',
  'response_ms_asc',
  'accuracy_desc',
  'accuracy_asc',
]

type TypeFilter = 'all' | 'with_type' | 'without_type'
type StatsFilterMode = 'all' | 'wrong_only' | 'unseen_only' | 'mastered_only'
type SortMode =
  | 'updated_desc'
  | 'updated_asc'
  | 'wrong_desc'
  | 'wrong_asc'
  | 'answered_at_desc'
  | 'answered_at_asc'
  | 'response_ms_desc'
  | 'response_ms_asc'
  | 'accuracy_desc'
  | 'accuracy_asc'

type SearchScope = 'question' | 'options' | 'answer' | 'type'

const SEARCH_SCOPES: SearchScope[] = ['question', 'options', 'answer', 'type']
const DEFAULT_SEARCH_SCOPES: Record<SearchScope, boolean> = {
  question: true,
  options: true,
  answer: true,
  type: true,
}

interface TableRow {
  item: QuestionItem
  originalIndex: number
  normalizedType: string
  updatedAt?: string
  updatedTimestamp: number | null
  statEntry: QuestionStatEntry | null
  lastAnsweredTimestamp: number | null
  accuracyRate: number | null
}

type ColumnKey =
  | 'index'
  | 'question'
  | 'answer'
  | 'options'
  | 'type'
  | 'updatedAt'
  | 'answeredAt'
  | 'responseMs'
  | 'accuracy'
  | 'stats'
  | 'actions'

interface ColumnDefinition {
  key: ColumnKey
  label: string
  defaultWidth: number
  minWidth: number
}

const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  { key: 'index', label: '#', defaultWidth: 88, minWidth: 72 },
  { key: 'question', label: '题目', defaultWidth: 560, minWidth: 280 },
  { key: 'answer', label: '答案', defaultWidth: 320, minWidth: 180 },
  { key: 'options', label: '选项', defaultWidth: 520, minWidth: 260 },
  { key: 'type', label: '类型', defaultWidth: 180, minWidth: 120 },
  { key: 'updatedAt', label: '更新时间', defaultWidth: 200, minWidth: 160 },
  { key: 'answeredAt', label: '最近作答时间', defaultWidth: 220, minWidth: 180 },
  { key: 'responseMs', label: '最近用时', defaultWidth: 150, minWidth: 120 },
  { key: 'accuracy', label: '正确率', defaultWidth: 130, minWidth: 110 },
  { key: 'stats', label: '答题情况', defaultWidth: 250, minWidth: 180 },
  { key: 'actions', label: '操作', defaultWidth: 130, minWidth: 120 },
]

const COLUMN_DEFINITION_MAP = COLUMN_DEFINITIONS.reduce<Record<ColumnKey, ColumnDefinition>>((accumulator, column) => {
  accumulator[column.key] = column
  return accumulator
}, {} as Record<ColumnKey, ColumnDefinition>)

const DEFAULT_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
  index: false,
  question: true,
  answer: true,
  options: true,
  type: false,
  updatedAt: false,
  answeredAt: true,
  responseMs: false,
  accuracy: true,
  stats: false,
  actions: true,
}

type QuestionItemWithLegacyUpdatedAt = QuestionItem & { updated_at?: unknown }

function normalizeTypeValue(type?: string): string {
  if (typeof type !== 'string') return ''
  return type.trim()
}

function parseUpdatedTimestamp(updatedAt?: string): number | null {
  if (typeof updatedAt !== 'string') return null

  const trimmed = updatedAt.trim()
  if (trimmed.length === 0) return null

  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/.exec(trimmed)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4] ?? 0)
  const minute = Number(match[5] ?? 0)
  const second = Number(match[6] ?? 0)

  const parsed = new Date(year, month - 1, day, hour, minute, second).getTime()
  if (Number.isNaN(parsed)) return null
  return parsed
}

function getUpdatedAtValue(item: QuestionItem): string | undefined {
  if (typeof item.updatedAt === 'string') {
    const trimmed = item.updatedAt.trim()
    if (trimmed.length > 0) return trimmed
  }

  const legacyValue = (item as QuestionItemWithLegacyUpdatedAt).updated_at
  if (typeof legacyValue === 'string') {
    const trimmed = legacyValue.trim()
    if (trimmed.length > 0) return trimmed
  }

  return undefined
}

function buildAnswerText(item: QuestionItem): string {
  const answerIndex = Number.isInteger(item.answer) ? item.answer : 0
  if (answerIndex < 0 || answerIndex >= ANSWER_LABELS.length) return '-'

  const optionText = typeof item.options[answerIndex] === 'string' ? item.options[answerIndex] : ''
  return optionText.length > 0 ? optionText : '-'
}

function buildDeterministicShuffleKey(row: TableRow, seed: number): number {
  let hash = seed | 0
  const source = `${row.originalIndex}:${row.item.question}:${row.updatedAt ?? ''}:${row.normalizedType}`

  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619)
  }

  return hash >>> 0
}

function formatQuestionStat(entry: QuestionStatEntry | null): string {
  if (!entry || entry.answeredCount <= 0) return entry?.mastered ? '未作答 | 已掌握' : '未作答'
  const avgSeconds = (averageResponseMs(entry) / 1000).toFixed(2)
  return `答${entry.answeredCount} 正${entry.correctCount} 误${entry.wrongCount} 均${avgSeconds}s${entry.mastered ? ' | 已掌握' : ''}`
}

function formatResponseMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '-'
  return `${(ms / 1000).toFixed(2)}s`
}

function getAccuracyRate(entry: QuestionStatEntry | null): number | null {
  if (!entry || entry.answeredCount <= 0) return null
  return entry.correctCount / entry.answeredCount
}

function formatAccuracy(rate: number | null): string {
  if (rate === null) return '-'
  return `${(rate * 100).toFixed(2)}%`
}

function parseAnsweredTimestamp(iso: string): number | null {
  if (typeof iso !== 'string' || iso.trim().length === 0) return null
  const parsed = new Date(iso).getTime()
  if (Number.isNaN(parsed)) return null
  return parsed
}

function formatAnsweredAt(iso: string): string {
  if (typeof iso !== 'string' || iso.trim().length === 0) return '-'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return '-'

  const year = parsed.getFullYear()
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0')
  const day = `${parsed.getDate()}`.padStart(2, '0')
  const hour = `${parsed.getHours()}`.padStart(2, '0')
  const minute = `${parsed.getMinutes()}`.padStart(2, '0')
  const second = `${parsed.getSeconds()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

function escapeCsvCell(cell: string): string {
  if (cell.includes('"') || cell.includes(',') || cell.includes('\n') || cell.includes('\r')) {
    return `"${cell.replace(/"/g, '""')}"`
  }
  return cell
}

function loadOptionsRevealStateFromSession(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.sessionStorage.getItem(OPTIONS_REVEAL_SESSION_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}

    const next: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'boolean') next[key] = value
    }
    return next
  } catch {
    return {}
  }
}

function buildOptionRevealKey(row: TableRow): string {
  return `${row.originalIndex}:${row.item.question}`
}

function loadFilterStateFromStorage(): {
  keyword?: string
  typeFilter?: TypeFilter
  statsFilterMode?: StatsFilterMode
  selectedType?: string
  sortMode?: SortMode
  selectedDate?: string
  searchScopes?: Record<SearchScope, boolean>
} {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(FILTER_STATE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return {}

    const next: {
      keyword?: string
      typeFilter?: TypeFilter
      statsFilterMode?: StatsFilterMode
      selectedType?: string
      sortMode?: SortMode
      selectedDate?: string
      searchScopes?: Record<SearchScope, boolean>
    } = {}

    if (typeof parsed.keyword === 'string') next.keyword = parsed.keyword
    if (typeof parsed.selectedType === 'string') next.selectedType = parsed.selectedType
    if (typeof parsed.selectedDate === 'string') next.selectedDate = parsed.selectedDate
    if (typeof parsed.typeFilter === 'string' && TYPE_FILTERS.includes(parsed.typeFilter as TypeFilter)) {
      next.typeFilter = parsed.typeFilter as TypeFilter
    }
    if (typeof parsed.statsFilterMode === 'string' && STATS_FILTERS.includes(parsed.statsFilterMode as StatsFilterMode)) {
      next.statsFilterMode = parsed.statsFilterMode as StatsFilterMode
    }
    if (typeof parsed.sortMode === 'string' && SORT_MODES.includes(parsed.sortMode as SortMode)) {
      next.sortMode = parsed.sortMode as SortMode
    }
    if (parsed.searchScopes && typeof parsed.searchScopes === 'object') {
      const nextScopes: Record<SearchScope, boolean> = { ...DEFAULT_SEARCH_SCOPES }
      for (const scope of SEARCH_SCOPES) {
        if (typeof (parsed.searchScopes as Record<string, unknown>)[scope] === 'boolean') {
          nextScopes[scope] = (parsed.searchScopes as Record<string, unknown>)[scope] as boolean
        }
      }
      next.searchScopes = nextScopes
    }
    return next
  } catch {
    return {}
  }
}

function getColumnCssVarName(key: ColumnKey): string {
  return `--qb-col-${key}-w`
}

function getColumnWidthFromMap(column: ColumnDefinition, widthMap: Record<ColumnKey, number>): number {
  return widthMap[column.key] ?? column.defaultWidth
}

function areCacheStatesEqual(left: QuestionBankCacheState, right: QuestionBankCacheState): boolean {
  return (
    left.manifestSignature === right.manifestSignature &&
    left.syncedPageCount === right.syncedPageCount &&
    left.questionCount === right.questionCount
  )
}

function prepareTableRows(sourceRows: QuestionItem[], statsMap: QuestionStatsMap): TableRow[] {
  return sourceRows.map((item, originalIndex) => ({
    item,
    originalIndex,
    normalizedType: normalizeTypeValue(item.type),
    updatedAt: getUpdatedAtValue(item),
    updatedTimestamp: parseUpdatedTimestamp(getUpdatedAtValue(item)),
    statEntry: statsMap[item.question] ?? null,
    lastAnsweredTimestamp: parseAnsweredTimestamp(statsMap[item.question]?.lastAnsweredAt ?? ''),
    accuracyRate: getAccuracyRate(statsMap[item.question] ?? null),
  }))
}

function matchesTypeScopeFilters(row: TableRow, typeFilter: TypeFilter, statsFilterMode: StatsFilterMode): boolean {
  if (typeFilter === 'with_type' && row.normalizedType.length === 0) return false
  if (typeFilter === 'without_type' && row.normalizedType.length > 0) return false
  if (statsFilterMode === 'wrong_only' && (!row.statEntry || row.statEntry.wrongCount <= 0)) return false
  if (statsFilterMode === 'unseen_only' && row.statEntry && row.statEntry.seenCount > 0) return false
  if (statsFilterMode === 'mastered_only' && (!row.statEntry || row.statEntry.mastered !== true)) return false
  return true
}

function matchesSelectedType(row: TableRow, selectedType: string): boolean {
  if (selectedType === 'all') return true
  if (selectedType === COMMON_SENSE_TYPE_VALUE) return row.normalizedType !== SUWEN_TYPE
  return row.normalizedType === selectedType
}

function resolveActiveSearchScopes(scopes: Record<SearchScope, boolean>): Record<SearchScope, boolean> {
  const hasActiveScope = SEARCH_SCOPES.some((scope) => scopes[scope])
  return hasActiveScope ? scopes : DEFAULT_SEARCH_SCOPES
}

function matchesKeyword(row: TableRow, normalizedKeyword: string, scopes: Record<SearchScope, boolean>): boolean {
  if (normalizedKeyword.length === 0) return true
  const activeScopes = resolveActiveSearchScopes(scopes)
  const candidates: string[] = []

  if (activeScopes.question) candidates.push(row.item.question)
  if (activeScopes.options) candidates.push(...row.item.options)
  if (activeScopes.answer) {
    const answerText = row.item.options[row.item.answer]
    if (typeof answerText === 'string') candidates.push(answerText)
  }
  if (activeScopes.type) candidates.push(row.normalizedType)

  return candidates.some((candidate) => candidate.toLowerCase().includes(normalizedKeyword))
}

function formatTypeLabel(type: string): string {
  return type === SUWEN_TYPE ? `✨${type}` : type
}

function formatDateKeyFromTimestamp(timestamp: number | null): string | null {
  if (timestamp === null) return null
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return null
  const year = parsed.getFullYear()
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0')
  const day = `${parsed.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function matchesSelectedDate(row: TableRow, selectedDate: string): boolean {
  if (!selectedDate) return true
  return formatDateKeyFromTimestamp(row.updatedTimestamp) === selectedDate
}

interface BuildFilteredRowsParams {
  sourceRows: TableRow[]
  normalizedKeyword: string
  searchScopes: Record<SearchScope, boolean>
  selectedDate: string
  shuffleTick: number
  sortMode: SortMode
}

function buildFilteredRows(params: BuildFilteredRowsParams): TableRow[] {
  const { normalizedKeyword, shuffleTick, sortMode, sourceRows, searchScopes, selectedDate } = params

  const filtered = sourceRows.filter((row) => matchesKeyword(row, normalizedKeyword, searchScopes) && matchesSelectedDate(row, selectedDate))

  filtered.sort((left, right) => {
    if (sortMode === 'wrong_desc' || sortMode === 'wrong_asc') {
      const leftWrong = left.statEntry?.wrongCount ?? 0
      const rightWrong = right.statEntry?.wrongCount ?? 0
      if (leftWrong !== rightWrong) {
        return sortMode === 'wrong_asc' ? leftWrong - rightWrong : rightWrong - leftWrong
      }
    }

    if (sortMode === 'answered_at_desc' || sortMode === 'answered_at_asc') {
      const leftTime = left.lastAnsweredTimestamp
      const rightTime = right.lastAnsweredTimestamp
      if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
        return sortMode === 'answered_at_asc' ? leftTime - rightTime : rightTime - leftTime
      }
      if (leftTime === null && rightTime !== null) return 1
      if (leftTime !== null && rightTime === null) return -1
    }

    if (sortMode === 'response_ms_desc' || sortMode === 'response_ms_asc') {
      const leftMs = left.statEntry?.lastResponseMs ?? 0
      const rightMs = right.statEntry?.lastResponseMs ?? 0
      if (leftMs !== rightMs) {
        return sortMode === 'response_ms_asc' ? leftMs - rightMs : rightMs - leftMs
      }
    }

    if (sortMode === 'accuracy_desc' || sortMode === 'accuracy_asc') {
      const leftAccuracy = left.accuracyRate
      const rightAccuracy = right.accuracyRate
      if (leftAccuracy !== null && rightAccuracy !== null && leftAccuracy !== rightAccuracy) {
        return sortMode === 'accuracy_asc' ? leftAccuracy - rightAccuracy : rightAccuracy - leftAccuracy
      }
      if (leftAccuracy === null && rightAccuracy !== null) return 1
      if (leftAccuracy !== null && rightAccuracy === null) return -1
    }

    const leftTime = left.updatedTimestamp
    const rightTime = right.updatedTimestamp

    if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
      return sortMode === 'updated_asc' ? leftTime - rightTime : rightTime - leftTime
    }

    if (leftTime === null && rightTime !== null) return 1
    if (leftTime !== null && rightTime === null) return -1

    return left.originalIndex - right.originalIndex
  })

  if (shuffleTick > 0 && filtered.length > 1) {
    const seed = Math.imul(shuffleTick, 2654435761)
    return [...filtered].sort((left, right) => {
      const leftKey = buildDeterministicShuffleKey(left, seed)
      const rightKey = buildDeterministicShuffleKey(right, seed)
      if (leftKey !== rightKey) return leftKey - rightKey
      return left.originalIndex - right.originalIndex
    })
  }

  return filtered
}

async function readCurrentLocalQuestionRows(): Promise<QuestionItem[]> {
  const cached = await loadCachedQuestionBankPreview(INITIAL_CACHE_PREVIEW_ROWS)
  if (cached.length > 0) return cached

  const bootstrapped = await loadQuestionPool(1).catch(() => [])
  if (bootstrapped.length > 0) return bootstrapped

  return []
}

export function QuestionBankPage() {
  const navigate = useNavigate()
  const initialFilterState = loadFilterStateFromStorage()
  const [rows, setRows] = useState<QuestionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [keyword, setKeyword] = useState(initialFilterState.keyword ?? '')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(initialFilterState.typeFilter ?? 'all')
  const [statsFilterMode, setStatsFilterMode] = useState<StatsFilterMode>(initialFilterState.statsFilterMode ?? 'all')
  const [selectedType, setSelectedType] = useState(initialFilterState.selectedType ?? 'all')
  const [sortMode, setSortMode] = useState<SortMode>(initialFilterState.sortMode ?? 'updated_desc')
  const [selectedDate, setSelectedDate] = useState(initialFilterState.selectedDate ?? '')
  const [searchScopes, setSearchScopes] = useState<Record<SearchScope, boolean>>(
    initialFilterState.searchScopes ?? DEFAULT_SEARCH_SCOPES,
  )
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [shuffleTick, setShuffleTick] = useState(0)
  const [statsMap, setStatsMap] = useState<QuestionStatsMap>({})
  const [optionsRevealMap, setOptionsRevealMap] = useState<Record<string, boolean>>(() => loadOptionsRevealStateFromSession())
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(() => DEFAULT_VISIBLE_COLUMNS)
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(() => {
    return COLUMN_DEFINITIONS.reduce<Record<ColumnKey, number>>((accumulator, column) => {
      accumulator[column.key] = column.defaultWidth
      return accumulator
    }, {} as Record<ColumnKey, number>)
  })
  const [isResizingColumn, setIsResizingColumn] = useState(false)
  const [startingQueuePractice, setStartingQueuePractice] = useState(false)

  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const tableRef = useRef<HTMLTableElement | null>(null)
  const resizingColumnRef = useRef<{ key: ColumnKey; startX: number; startWidth: number; pendingWidth: number } | null>(null)
  const resizeAnimationFrameRef = useRef<number | null>(null)

  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(VIRTUAL_FALLBACK_VIEWPORT_HEIGHT)
  const deferredRows = useDeferredValue(rows)

  useEffect(() => {
    let cancelled = false
    let timeoutId: number | null = null

    const bootstrap = async () => {
      setLoading(true)
      setError(null)

      try {
        const initialRows = await readCurrentLocalQuestionRows()
        if (cancelled) return

        setRows(initialRows)
        setLoading(false)
        setSyncing(true)

        let previousCacheState = await loadQuestionBankCacheState()
        let stableRounds = 0
        let pollRounds = 0

        void loadQuestionPool(1).catch(() => undefined)

        const pollCache = async () => {
          if (cancelled) return

          pollRounds += 1
          try {
            const latestState = await loadQuestionBankCacheState()
            if (!areCacheStatesEqual(previousCacheState, latestState)) {
              previousCacheState = latestState
              stableRounds = 0
              const previewRows = await loadCachedQuestionBankPreview(INITIAL_CACHE_PREVIEW_ROWS)
              if (!cancelled && previewRows.length > 0) {
                setRows(previewRows)
              }
            } else {
              stableRounds += 1
            }
          } catch {
            stableRounds += 1
          }

          if (stableRounds >= 3 || pollRounds >= MAX_CACHE_POLL_ROUNDS) {
            if (!cancelled) {
              const fullRows = await loadCachedQuestionBank().catch(() => [])
              if (fullRows.length > 0) {
                setRows(fullRows)
              }
              setSyncing(false)
            }
            return
          }

          timeoutId = window.setTimeout(() => {
            void pollCache()
          }, CACHE_POLL_DELAY_MS)
        }

        timeoutId = window.setTimeout(() => {
          void pollCache()
        }, CACHE_POLL_DELAY_MS)
      } catch (loadError) {
        if (cancelled) return
        setLoading(false)
        setError(loadError instanceof Error ? loadError.message : '题库加载失败')
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    const refreshStats = () => {
      setStatsMap(loadQuestionStatsMap())
    }

    refreshStats()
    return subscribeQuestionStats(refreshStats)
  }, [])

  useEffect(() => {
    try {
      window.sessionStorage.setItem(OPTIONS_REVEAL_SESSION_KEY, JSON.stringify(optionsRevealMap))
    } catch {
      // Ignore session storage errors to avoid blocking table interactions.
    }
  }, [optionsRevealMap])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        FILTER_STATE_STORAGE_KEY,
        JSON.stringify({
          keyword,
          typeFilter,
          statsFilterMode,
          selectedType,
          sortMode,
          selectedDate,
          searchScopes,
        }),
      )
    } catch {
      // Ignore storage errors to avoid blocking table interactions.
    }
  }, [keyword, typeFilter, statsFilterMode, selectedType, sortMode, selectedDate, searchScopes])

  const normalizedKeyword = keyword.trim().toLowerCase()

  const preparedRows = useMemo(() => {
    return prepareTableRows(deferredRows, statsMap)
  }, [deferredRows, statsMap])

  const typeScopedRows = useMemo(() => {
    return preparedRows.filter((row) => matchesTypeScopeFilters(row, typeFilter, statsFilterMode))
  }, [preparedRows, statsFilterMode, typeFilter])

  const typeCountSourceRows = useMemo(() => {
    if (normalizedKeyword.length === 0 && !selectedDate) return typeScopedRows
    return typeScopedRows.filter((row) => matchesKeyword(row, normalizedKeyword, searchScopes) && matchesSelectedDate(row, selectedDate))
  }, [normalizedKeyword, searchScopes, selectedDate, typeScopedRows])

  const dateOptionSourceRows = useMemo(() => {
    if (normalizedKeyword.length === 0) return typeScopedRows
    return typeScopedRows.filter((row) => matchesKeyword(row, normalizedKeyword, searchScopes))
  }, [normalizedKeyword, searchScopes, typeScopedRows])

  const availableDates = useMemo(() => {
    const dateSet = new Set<string>()
    for (const row of dateOptionSourceRows) {
      const key = formatDateKeyFromTimestamp(row.updatedTimestamp)
      if (key) dateSet.add(key)
    }
    return Array.from(dateSet).sort((left, right) => right.localeCompare(left))
  }, [dateOptionSourceRows])

  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates])

  const dateRange = useMemo(() => {
    if (availableDates.length === 0) return null
    return {
      max: availableDates[0],
      min: availableDates[availableDates.length - 1],
    }
  }, [availableDates])

  const typeCounts = useMemo(() => {
    const map = new Map<string, number>()
    let nonSuwenCount = 0

    for (const row of typeCountSourceRows) {
      if (row.normalizedType.length > 0) {
        map.set(row.normalizedType, (map.get(row.normalizedType) ?? 0) + 1)
      }
      if (row.normalizedType !== SUWEN_TYPE) {
        nonSuwenCount += 1
      }
    }

    return {
      map,
      nonSuwenCount,
      total: typeCountSourceRows.length,
    }
  }, [typeCountSourceRows])

  const availableTypes = useMemo(() => {
    return Array.from(typeCounts.map.keys()).sort((left, right) => left.localeCompare(right, 'zh-CN'))
  }, [typeCounts])

  useEffect(() => {
    if (selectedType === 'all') return
    if (selectedType === COMMON_SENSE_TYPE_VALUE) {
      if (typeCounts.nonSuwenCount === 0) setSelectedType('all')
      return
    }
    if (!availableTypes.includes(selectedType)) setSelectedType('all')
  }, [availableTypes, selectedType, typeCounts.nonSuwenCount])

  useEffect(() => {
    if (!selectedDate) return
    if (!availableDateSet.has(selectedDate)) setSelectedDate('')
  }, [availableDateSet, selectedDate])

  const selectedTypeRows = useMemo(() => {
    return typeScopedRows.filter((row) => matchesSelectedType(row, selectedType))
  }, [selectedType, typeScopedRows])

  const filteredRows = useMemo(() => {
    return buildFilteredRows({
      sourceRows: selectedTypeRows,
      normalizedKeyword,
      searchScopes,
      selectedDate,
      shuffleTick,
      sortMode,
    })
  }, [normalizedKeyword, searchScopes, selectedDate, selectedTypeRows, shuffleTick, sortMode])

  useEffect(() => {
    const node = scrollContainerRef.current
    if (node) {
      node.scrollTop = 0
    }
    setScrollTop(0)
  }, [normalizedKeyword, searchScopes, selectedDate, selectedType, shuffleTick, sortMode, statsFilterMode, typeFilter])

  useEffect(() => {
    const node = scrollContainerRef.current
    if (!node) return

    const readViewportHeight = (): number => {
      return node.clientHeight > 0 ? node.clientHeight : VIRTUAL_FALLBACK_VIEWPORT_HEIGHT
    }

    const onScroll = () => {
      setScrollTop(node.scrollTop)
    }

    const onResize = () => {
      setViewportHeight(readViewportHeight())
    }

    setScrollTop(node.scrollTop)
    setViewportHeight(readViewportHeight())

    node.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
    resizeObserver?.observe(node)

    return () => {
      node.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      resizeObserver?.disconnect()
    }
  }, [])

  useEffect(() => {
    document.body.style.cursor = isResizingColumn ? 'col-resize' : ''
    document.body.style.userSelect = isResizingColumn ? 'none' : ''

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingColumn])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const activeResize = resizingColumnRef.current
      if (!activeResize) return

      const definition = COLUMN_DEFINITION_MAP[activeResize.key]
      const nextWidth = Math.max(definition.minWidth, Math.round(activeResize.startWidth + (event.clientX - activeResize.startX)))
      if (activeResize.pendingWidth === nextWidth) return

      activeResize.pendingWidth = nextWidth

      if (resizeAnimationFrameRef.current !== null) return
      resizeAnimationFrameRef.current = window.requestAnimationFrame(() => {
        resizeAnimationFrameRef.current = null
        const currentResize = resizingColumnRef.current
        if (!currentResize) return

        const tableNode = tableRef.current
        if (!tableNode) return

        tableNode.style.setProperty(getColumnCssVarName(currentResize.key), `${currentResize.pendingWidth}px`)

        let totalVisibleWidth = 0
        for (const column of COLUMN_DEFINITIONS) {
          if (!visibleColumns[column.key]) continue
          if (column.key === currentResize.key) {
            totalVisibleWidth += currentResize.pendingWidth
            continue
          }
          totalVisibleWidth += getColumnWidthFromMap(column, columnWidths)
        }

        tableNode.style.minWidth = `${Math.max(MIN_TABLE_WIDTH_PX, totalVisibleWidth)}px`
      })
    }

    const stopResizing = () => {
      const activeResize = resizingColumnRef.current
      if (!activeResize) return
      setColumnWidths((previous) => {
        if (previous[activeResize.key] === activeResize.pendingWidth) return previous
        return {
          ...previous,
          [activeResize.key]: activeResize.pendingWidth,
        }
      })
      resizingColumnRef.current = null
      if (resizeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeAnimationFrameRef.current)
        resizeAnimationFrameRef.current = null
      }
      setIsResizingColumn(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)
    window.addEventListener('pointercancel', stopResizing)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
      window.removeEventListener('pointercancel', stopResizing)
      if (resizeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeAnimationFrameRef.current)
        resizeAnimationFrameRef.current = null
      }
      setIsResizingColumn(false)
    }
  }, [columnWidths, visibleColumns])

  const virtualWindow = useMemo(() => {
    if (loading || filteredRows.length === 0) {
      return {
        startIndex: 0,
        visibleRows: [] as TableRow[],
        topPadding: 0,
        bottomPadding: 0,
      }
    }

    const safeViewportHeight = viewportHeight > 0 ? viewportHeight : VIRTUAL_FALLBACK_VIEWPORT_HEIGHT
    const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN)
    const rawRenderCount = Math.ceil(safeViewportHeight / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN * 2
    const renderCount = Math.min(MAX_VIRTUAL_RENDER_ROWS, Math.max(VIRTUAL_OVERSCAN * 2 + 1, rawRenderCount))
    const endIndex = Math.min(filteredRows.length - 1, startIndex + renderCount - 1)

    return {
      startIndex,
      visibleRows: filteredRows.slice(startIndex, endIndex + 1),
      topPadding: startIndex * VIRTUAL_ROW_HEIGHT,
      bottomPadding: Math.max(0, (filteredRows.length - endIndex - 1) * VIRTUAL_ROW_HEIGHT),
    }
  }, [filteredRows, loading, scrollTop, viewportHeight])

  const handleStartQueuePractice = async () => {
    if (startingQueuePractice) return
    setStartingQueuePractice(true)

    try {
      const queueRows = filteredRows

      const queue = queueRows.map((row) => row.item)
      const effectiveQueueCount = queueRows.filter((row) => row.statEntry?.mastered !== true).length
      if (effectiveQueueCount < MIN_PRACTICE_QUEUE_ITEMS) {
        window.alert(`当前显示队列未掌握题仅 ${effectiveQueueCount} 题，最少需要 ${MIN_PRACTICE_QUEUE_ITEMS} 题才能开始练习`)
        return
      }

      const count = savePracticeQueue(queue)
      if (count < MIN_PRACTICE_QUEUE_ITEMS) {
        window.alert(`当前可练习题目仅 ${count} 题，最少需要 ${MIN_PRACTICE_QUEUE_ITEMS} 题才能开始练习`)
        return
      }
      navigate(APP_ROUTES.queuePractice)
    } finally {
      setStartingQueuePractice(false)
    }
  }

  const visibleColumnDefs = useMemo(() => {
    return COLUMN_DEFINITIONS.filter((column) => visibleColumns[column.key])
  }, [visibleColumns])

  const tableMinWidthPx = useMemo(() => {
    const width = visibleColumnDefs.reduce((sum, column) => sum + getColumnWidthFromMap(column, columnWidths), 0)
    return Math.max(MIN_TABLE_WIDTH_PX, width)
  }, [columnWidths, visibleColumnDefs])

  const tableStyle = useMemo(() => {
    const style: React.CSSProperties & Record<string, string> = {
      minWidth: `${tableMinWidthPx}px`,
    }

    for (const column of COLUMN_DEFINITIONS) {
      style[getColumnCssVarName(column.key)] = `${getColumnWidthFromMap(column, columnWidths)}px`
    }

    return style
  }, [columnWidths, tableMinWidthPx])

  const toggleSearchScope = (scope: SearchScope) => {
    setSearchScopes((previous) => {
      const activeCount = SEARCH_SCOPES.filter((key) => previous[key]).length
      if (previous[scope] && activeCount <= 1) return previous
      return {
        ...previous,
        [scope]: !previous[scope],
      }
    })
  }

  const handleDateChange = (value: string) => {
    if (!value) {
      setSelectedDate('')
      return
    }
    if (availableDateSet.has(value)) {
      setSelectedDate(value)
    }
  }

  const toggleColumnVisibility = (key: ColumnKey) => {
    setVisibleColumns((previous) => {
      const currentlyVisible = Object.values(previous).filter(Boolean).length
      if (previous[key] && currentlyVisible <= 1) return previous
      return {
        ...previous,
        [key]: !previous[key],
      }
    })
  }

  const handleColumnResizeStart = (event: React.PointerEvent<HTMLDivElement>, key: ColumnKey) => {
    const width = columnWidths[key] ?? COLUMN_DEFINITION_MAP[key].defaultWidth
    resizingColumnRef.current = {
      key,
      startX: event.clientX,
      startWidth: width,
      pendingWidth: width,
    }
    setIsResizingColumn(true)
    event.preventDefault()
    event.stopPropagation()
  }

  const exportCellByColumn = (columnKey: ColumnKey, row: TableRow, displayIndex: number): string => {
    switch (columnKey) {
      case 'index':
        return `${displayIndex}`
      case 'question':
        return row.item.question
      case 'answer':
        return buildAnswerText(row.item)
      case 'options':
        return row.item.options.map((option, optionIndex) => `${ANSWER_LABELS[optionIndex]}. ${option}`).join(' | ')
      case 'type':
        return row.normalizedType || '-'
      case 'updatedAt':
        return row.updatedAt ?? '-'
      case 'answeredAt':
        return formatAnsweredAt(row.statEntry?.lastAnsweredAt ?? '')
      case 'responseMs':
        return formatResponseMs(row.statEntry?.lastResponseMs ?? 0)
      case 'accuracy':
        return formatAccuracy(row.accuracyRate)
      case 'stats':
        return formatQuestionStat(row.statEntry)
      case 'actions':
        return row.statEntry?.mastered ? '已掌握' : '未掌握'
      default:
        return ''
    }
  }

  const handleDownloadFilteredRows = () => {
    if (filteredRows.length === 0) {
      window.alert('当前没有可下载的数据')
      return
    }

    if (visibleColumnDefs.length === 0) {
      window.alert('请至少显示一列后再下载')
      return
    }

    const header = visibleColumnDefs.map((column) => column.label)
    const body = filteredRows.map((row, index) => {
      return visibleColumnDefs.map((column) => exportCellByColumn(column.key, row, index + 1))
    })
    const csv = [header, ...body]
      .map((line) => line.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\r\n')

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `question-bank-filtered-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const toggleOptionReveal = (row: TableRow) => {
    const revealKey = buildOptionRevealKey(row)
    setOptionsRevealMap((previous) => ({
      ...previous,
      [revealKey]: previous[revealKey] !== true,
    }))
  }

  const renderTableCell = (columnKey: ColumnKey, row: TableRow, displayIndex: number) => {
    const minWidth = COLUMN_DEFINITION_MAP[columnKey].minWidth
    const style = { width: `var(${getColumnCssVarName(columnKey)})`, minWidth: `${minWidth}px` }

    switch (columnKey) {
      case 'index':
        return (
          <td className="whitespace-nowrap border-r border-[#2196f3]/16 px-3 py-3 font-medium text-[#1b5fa6]/80 last:border-r-0" key={columnKey} style={style}>
            {displayIndex}
          </td>
        )
      case 'question':
        return (
          <td className="border-r border-[#2196f3]/16 px-3 py-3 text-slate-800 last:border-r-0" key={columnKey} style={style}>
            <div className="max-h-24 overflow-hidden whitespace-pre-wrap break-words">{row.item.question}</div>
          </td>
        )
      case 'answer':
        return (
          <td className="border-r border-[#2196f3]/16 px-3 py-3 text-slate-700 last:border-r-0" key={columnKey} style={style}>
            <div className="max-h-20 overflow-hidden whitespace-pre-wrap break-words">{buildAnswerText(row.item)}</div>
          </td>
        )
      case 'options':
        {
          const revealKey = buildOptionRevealKey(row)
          const isAnswerVisible = optionsRevealMap[revealKey] === true
          return (
            <td
              className="border-r border-[#2196f3]/16 px-3 py-3 last:border-r-0"
              key={columnKey}
              style={style}
              title={isAnswerVisible ? '点击隐藏答案高亮' : '点击显示答案高亮'}
              onClick={() => toggleOptionReveal(row)}
            >
              <ul className="max-h-24 space-y-1 overflow-hidden">
                {row.item.options.map((option, optionIndex) => (
                  <li
                    className={
                      isAnswerVisible && optionIndex === row.item.answer ? 'truncate font-semibold text-[#0f6fc5]' : 'truncate text-slate-600'
                    }
                    key={`${row.item.question}-option-${optionIndex}`}
                  >
                    {ANSWER_LABELS[optionIndex]}. {option}
                  </li>
                ))}
              </ul>
            </td>
          )
        }
      case 'type':
        return (
          <td className="whitespace-nowrap border-r border-[#2196f3]/16 px-3 py-3 text-slate-700 last:border-r-0" key={columnKey} style={style}>
            {row.normalizedType || '-'}
          </td>
        )
      case 'updatedAt':
        return (
          <td className="whitespace-nowrap border-r border-[#2196f3]/16 px-3 py-3 text-slate-700 last:border-r-0" key={columnKey} style={style}>
            {row.updatedAt ?? '-'}
          </td>
        )
      case 'answeredAt':
        return (
          <td className="whitespace-nowrap border-r border-[#2196f3]/16 px-3 py-3 text-slate-700 last:border-r-0" key={columnKey} style={style}>
            {formatAnsweredAt(row.statEntry?.lastAnsweredAt ?? '')}
          </td>
        )
      case 'responseMs':
        return (
          <td className="whitespace-nowrap border-r border-[#2196f3]/16 px-3 py-3 text-slate-700 last:border-r-0" key={columnKey} style={style}>
            {formatResponseMs(row.statEntry?.lastResponseMs ?? 0)}
          </td>
        )
      case 'accuracy':
        return (
          <td className="whitespace-nowrap border-r border-[#2196f3]/16 px-3 py-3 text-slate-700 last:border-r-0" key={columnKey} style={style}>
            {formatAccuracy(row.accuracyRate)}
          </td>
        )
      case 'stats':
        return (
          <td className="whitespace-nowrap border-r border-[#2196f3]/16 px-3 py-3 text-slate-700 last:border-r-0" key={columnKey} style={style}>
            {formatQuestionStat(row.statEntry)}
          </td>
        )
      case 'actions':
        return (
          <td className="whitespace-nowrap border-r border-[#2196f3]/16 px-3 py-3 text-slate-700 last:border-r-0" key={columnKey} style={style}>
            <button
              className="rounded border border-[#2196f3]/40 px-2 py-1 text-xs font-semibold text-[#0f4f90] hover:bg-[#eaf4ff]"
              type="button"
              onClick={() => {
                setQuestionMastered(row.item.question, row.statEntry?.mastered !== true)
              }}
            >
              {row.statEntry?.mastered ? '取消掌握' : '标注掌握'}
            </button>
          </td>
        )
      default:
        return null
    }
  }

  return (
    <main className="h-screen h-[100svh] h-[100dvh] overflow-x-hidden overflow-y-auto bg-[linear-gradient(180deg,#eaf4ff_0%,#f6faff_48%,#eef6ff_100%)] px-3 py-3 text-slate-900 sm:overflow-hidden sm:px-4 sm:py-8">
      <div className="mx-auto flex h-full min-h-full w-full max-w-[1320px] flex-col">
        <section className="rounded-2xl border border-[#2196f3]/15 bg-white/95 p-4 shadow-[0_12px_28px_rgba(33,150,243,0.12)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">题库表</h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                aria-controls="question-bank-filters"
                aria-expanded={!filtersCollapsed}
                className="inline-flex items-center rounded-md border border-[#2196f3]/35 bg-white px-4 py-2 text-sm font-semibold text-[#1b5fa6] transition hover:border-[#2196f3] hover:bg-[#2196f3]/5 hover:text-[#0f4f90]"
                type="button"
                onClick={() => setFiltersCollapsed((value) => !value)}
              >
                {filtersCollapsed ? '展开筛选' : '折叠筛选'}
              </button>
              <Link
                className="inline-flex items-center rounded-md border border-[#2196f3]/35 bg-white px-4 py-2 text-sm font-semibold text-[#1b5fa6] transition hover:border-[#2196f3] hover:bg-[#2196f3]/5 hover:text-[#0f4f90]"
                to={APP_ROUTES.home}
              >
                返回首页
              </Link>
              <Link
                className="inline-flex items-center rounded-md bg-[#2196f3] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(33,150,243,0.35)] transition hover:bg-[#1e88e5]"
                to={APP_ROUTES.game}
              >
                进入模拟答题
              </Link>
            </div>
          </div>

          <div
            className={filtersCollapsed ? 'mt-4 hidden' : 'mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6'}
            id="question-bank-filters"
          >
            <label className="flex flex-col gap-1 text-sm text-slate-700 xl:col-span-2">
              关键词搜索
              <div className="relative">
                <input
                  className="w-full rounded-md border border-[#2196f3]/25 bg-white px-3 py-2 pr-12 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#2196f3] focus:ring-2 focus:ring-[#2196f3]/20"
                  placeholder="按题目、选项、答案、类型搜索"
                  ref={searchInputRef}
                  type="text"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
                {keyword ? (
                  <button
                    aria-label="清空搜索关键词"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-slate-500 transition hover:border-[#2196f3]/30 hover:text-[#1b5fa6]"
                    type="button"
                    onClick={() => {
                      setKeyword('')
                      searchInputRef.current?.focus()
                    }}
                  >
                    清空
                  </button>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-500">搜索范围</span>
                <label className="inline-flex items-center gap-1">
                  <input
                    checked={searchScopes.question}
                    className="h-3.5 w-3.5 accent-[#2196f3]"
                    type="checkbox"
                    onChange={() => toggleSearchScope('question')}
                  />
                  题目
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    checked={searchScopes.options}
                    className="h-3.5 w-3.5 accent-[#2196f3]"
                    type="checkbox"
                    onChange={() => toggleSearchScope('options')}
                  />
                  选项
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    checked={searchScopes.answer}
                    className="h-3.5 w-3.5 accent-[#2196f3]"
                    type="checkbox"
                    onChange={() => toggleSearchScope('answer')}
                  />
                  答案
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    checked={searchScopes.type}
                    className="h-3.5 w-3.5 accent-[#2196f3]"
                    type="checkbox"
                    onChange={() => toggleSearchScope('type')}
                  />
                  类型
                </label>
              </div>
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              题目类型字段
              <select
                className="rounded-md border border-[#2196f3]/25 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#2196f3] focus:ring-2 focus:ring-[#2196f3]/20"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              >
                <option value="all">全部</option>
                <option value="with_type">仅含类型</option>
                <option value="without_type">仅无类型</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <span>
                类型值
                <span className="ml-1 align-super text-[10px] font-semibold text-slate-500">
                  ✨=素问，{COMMON_SENSE_TYPE_LABEL}=非素问合集
                </span>
              </span>
              <select
                className="rounded-md border border-[#2196f3]/25 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#2196f3] focus:ring-2 focus:ring-[#2196f3]/20 disabled:cursor-not-allowed disabled:bg-[#2196f3]/10"
                disabled={typeFilter === 'without_type'}
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
              >
                <option value="all">全部类型 ({typeCounts.total})</option>
                <option value={COMMON_SENSE_TYPE_VALUE}>
                  {COMMON_SENSE_TYPE_LABEL} ({typeCounts.nonSuwenCount})
                </option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatTypeLabel(type)} ({typeCounts.map.get(type) ?? 0})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              排序
              <select
                className="rounded-md border border-[#2196f3]/25 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#2196f3] focus:ring-2 focus:ring-[#2196f3]/20"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
              >
                <option value="updated_desc">更新时间: 新到旧</option>
                <option value="updated_asc">更新时间: 旧到新</option>
                <option value="wrong_desc">错误次数: 多到少</option>
                <option value="wrong_asc">错误次数: 少到多</option>
                <option value="answered_at_desc">最近作答时间: 新到旧</option>
                <option value="answered_at_asc">最近作答时间: 旧到新</option>
                <option value="response_ms_desc">最近用时: 慢到快</option>
                <option value="response_ms_asc">最近用时: 快到慢</option>
                <option value="accuracy_desc">正确率: 高到低</option>
                <option value="accuracy_asc">正确率: 低到高</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              更新时间
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded-md border border-[#2196f3]/25 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#2196f3] focus:ring-2 focus:ring-[#2196f3]/20 disabled:cursor-not-allowed disabled:bg-[#2196f3]/10"
                  disabled={availableDates.length === 0}
                  list="qb-date-options"
                  max={dateRange?.max}
                  min={dateRange?.min}
                  type="date"
                  value={selectedDate}
                  onChange={(event) => handleDateChange(event.target.value)}
                />
                <datalist id="qb-date-options">
                  {availableDates.map((date) => (
                    <option key={date} value={date} />
                  ))}
                </datalist>
                {selectedDate ? (
                  <button
                    className="whitespace-nowrap rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-100"
                    type="button"
                    onClick={() => setSelectedDate('')}
                  >
                    清空
                  </button>
                ) : null}
              </div>
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              答题筛选
              <select
                className="rounded-md border border-[#2196f3]/25 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#2196f3] focus:ring-2 focus:ring-[#2196f3]/20"
                value={statsFilterMode}
                onChange={(event) => setStatsFilterMode(event.target.value as StatsFilterMode)}
              >
                <option value="all">全部题目</option>
                <option value="wrong_only">仅错题</option>
                <option value="unseen_only">仅未做题</option>
                <option value="mastered_only">仅掌握题</option>
              </select>
            </label>

          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
            <span>本地库题目: {rows.length}</span>
            <span>筛选后: {filteredRows.length}</span>
            {syncing ? <span className="font-medium text-[#2196f3]">本地缓存后台同步中...</span> : null}
            <button
              className="inline-flex items-center rounded-md border border-[#2196f3]/35 bg-white px-3 py-1.5 text-sm font-semibold text-[#1b5fa6] transition hover:border-[#2196f3] hover:bg-[#2196f3]/5"
              disabled={startingQueuePractice}
              type="button"
              onClick={() => {
                void handleStartQueuePractice()
              }}
            >
              {startingQueuePractice ? '正在准备队列...' : '按当前显示队列顺序答题'}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-start gap-3">
            {filtersCollapsed ? (
              <div className="min-w-[220px] max-w-sm flex-1">
                <div className="relative">
                  <input
                    className="w-full rounded-md border border-[#2196f3]/25 bg-white px-3 py-2 pr-12 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#2196f3] focus:ring-2 focus:ring-[#2196f3]/20"
                    placeholder="关键词搜索"
                    ref={searchInputRef}
                    type="text"
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                  />
                  {keyword ? (
                    <button
                      aria-label="清空搜索关键词"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-slate-500 transition hover:border-[#2196f3]/30 hover:text-[#1b5fa6]"
                      type="button"
                      onClick={() => {
                        setKeyword('')
                        searchInputRef.current?.focus()
                      }}
                    >
                      清空
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <button
              className="inline-flex items-center rounded-md border border-emerald-400/60 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={filteredRows.length === 0}
              type="button"
              onClick={handleDownloadFilteredRows}
            >
              下载当前筛选数据（CSV）
            </button>

            <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#2196f3]/25 bg-[#f5faff] px-3 py-2">
              <span className="text-sm font-semibold text-[#1b5fa6]">字段显示</span>
              {COLUMN_DEFINITIONS.map((column) => (
                <label className="inline-flex items-center gap-1 text-xs text-slate-700" key={column.key}>
                  <input
                    checked={visibleColumns[column.key]}
                    className="h-3.5 w-3.5 accent-[#2196f3]"
                    type="checkbox"
                    onChange={() => toggleColumnVisibility(column.key)}
                  />
                  {column.label}
                </label>
              ))}
            </div>
          </div>

          {error ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        </section>

        <section className="relative mt-3 flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#2196f3]/20 bg-white/95 shadow-[0_14px_32px_rgba(33,150,243,0.14)] sm:mt-4 sm:min-h-0">
          <div className="h-full w-full overflow-auto pr-1" ref={scrollContainerRef}>
            <table className="table-fixed text-left text-sm" ref={tableRef} style={tableStyle}>
              <thead className="sticky top-0 z-10 bg-[#e8f3ff] text-xs uppercase tracking-wide text-[#1b5fa6]">
                <tr>
                  {visibleColumnDefs.map((column) => {
                    return (
                      <th
                        className="group relative border-r border-[#2196f3]/20 px-3 py-3 last:border-r-0"
                        key={column.key}
                        style={{ width: `var(${getColumnCssVarName(column.key)})`, minWidth: `${column.minWidth}px` }}
                      >
                        <span>{column.label}</span>
                        <div
                          aria-label={`拉伸列 ${column.label}`}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none"
                          role="separator"
                          onPointerDown={(event) => handleColumnResizeStart(event, column.key)}
                        />
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-6 text-sm text-slate-500" colSpan={visibleColumnDefs.length}>
                      题库加载中...
                    </td>
                  </tr>
                ) : null}

                {!loading && filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-sm text-slate-500" colSpan={visibleColumnDefs.length}>
                      没有匹配数据
                    </td>
                  </tr>
                ) : null}

                {!loading && filteredRows.length > 0 && virtualWindow.topPadding > 0 ? (
                  <tr aria-hidden="true">
                    <td colSpan={visibleColumnDefs.length} style={{ height: `${virtualWindow.topPadding}px`, padding: 0 }} />
                  </tr>
                ) : null}

                {!loading
                  ? virtualWindow.visibleRows.map((row, visibleIndex) => {
                      const displayIndex = virtualWindow.startIndex + visibleIndex + 1

                      return (
                        <tr
                          className="border-t border-[#2196f3]/12 align-top transition-colors hover:bg-[#2196f3]/[0.04]"
                          key={`${row.item.question}-${row.originalIndex}`}
                          style={{ height: `${VIRTUAL_ROW_HEIGHT}px` }}
                        >
                          {visibleColumnDefs.map((column) => renderTableCell(column.key, row, displayIndex))}
                        </tr>
                      )
                    })
                  : null}

                {!loading && filteredRows.length > 0 && virtualWindow.bottomPadding > 0 ? (
                  <tr aria-hidden="true">
                    <td colSpan={visibleColumnDefs.length} style={{ height: `${virtualWindow.bottomPadding}px`, padding: 0 }} />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <button
            className="absolute bottom-3 right-3 z-30 inline-flex items-center gap-2 rounded-full border border-[#2196f3]/40 bg-white/90 px-3 py-2 text-sm font-semibold text-[#0f4f90] shadow-[0_8px_18px_rgba(33,150,243,0.2)] backdrop-blur transition hover:border-[#2196f3] hover:bg-[#eaf4ff]"
            type="button"
            onClick={() => {
              setShuffleTick((value) => value + 1)
            }}
          >
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M16 3h5v5h-2V6.41l-4.29 4.3-1.42-1.42 4.3-4.29H16V3ZM3 6h5v2H6.41l4.3 4.29-1.42 1.42-4.29-4.3V11H3V6Zm11.71 7.29 4.29 4.3V16h2v5h-5v-2h1.59l-4.3-4.29 1.42-1.42ZM3 13h2v1.59l4.29-4.3 1.42 1.42-4.3 4.29H8v2H3v-5Z"
                fill="currentColor"
              />
            </svg>
            <span>手气不错</span>
          </button>

        </section>
      </div>
    </main>
  )
}
