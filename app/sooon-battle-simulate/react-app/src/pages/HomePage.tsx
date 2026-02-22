import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { APP_ROUTES } from '../app/paths'
import { loadLastPracticeQueueSession } from '../services/practiceQueue'
import {
  getQuestionStatsSummary,
  loadDailyQuestionStatsMap,
  loadQuestionStatsMap,
  subscribeQuestionStats,
  type DailyQuestionStatsMap,
  type QuestionStatsSummary,
} from '../services/questionStats'
import { toPublicUrl } from '../utils/publicAsset'

const homeCopy = {
  title: 'AI 模拟答题对战',
  description: '在正式开始前，你可以先通过模拟模式体验答题节奏、观察对手表现，并按需调整 AI 的准确率和答题速度。',
  enterGame: '进入模拟答题',
  questionBankTable: '查看题库表',
  about: '查看题库说明',
}

const DEFAULT_SUMMARY: QuestionStatsSummary = {
  answeredUniqueQuestions: 0,
  seenUniqueQuestions: 0,
  totalAttempts: 0,
  totalCorrectCount: 0,
  totalWrongCount: 0,
  averageResponseMs: 0,
}

const WEEKDAY_LABELS = ['周日', '', '周二', '', '周四', '', '周六']
const HEAT_COLORS = ['#1e293b', '#0f5132', '#1e7a3e', '#2ea043', '#56d364']
const CELL_SIZE = 12
const CELL_GAP = 4

function toDateKeyLocal(date: Date): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

function withZeroTime(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function shiftDays(date: Date, offsetDays: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + offsetDays)
  return next
}

function getHeatLevel(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) return 0
  const ratio = count / maxCount
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return 4
}

function buildLegacyDailyStatsFallback(): DailyQuestionStatsMap {
  const questionMap = loadQuestionStatsMap()
  const fallback: DailyQuestionStatsMap = {}

  for (const entry of Object.values(questionMap)) {
    if (entry.answeredCount <= 0) continue
    if (!entry.lastAnsweredAt) continue
    const dateKey = entry.lastAnsweredAt.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue
    fallback[dateKey] = Math.max(0, Math.floor((fallback[dateKey] ?? 0) + entry.answeredCount))
  }

  return fallback
}

async function loadTotalQuestionCount(): Promise<number | null> {
  try {
    const response = await fetch(toPublicUrl('assets/qb.manifest.json'), { cache: 'no-store' })
    if (!response.ok) return null
    const payload = (await response.json()) as { total?: unknown }
    if (typeof payload.total === 'number' && Number.isFinite(payload.total) && payload.total > 0) {
      return Math.floor(payload.total)
    }
    return null
  } catch {
    return null
  }
}

function formatSeconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(2)}s`
}

export function HomePage() {
  const [summary, setSummary] = useState<QuestionStatsSummary>(DEFAULT_SUMMARY)
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null)
  const [lastQueueInfo, setLastQueueInfo] = useState<{ count: number; cursor: number } | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyQuestionStatsMap>({})

  useEffect(() => {
    const refreshSummary = () => {
      const map = loadQuestionStatsMap()
      setSummary(getQuestionStatsSummary(map))

      const dailyMap = loadDailyQuestionStatsMap()
      const hasDailyMap = Object.keys(dailyMap).length > 0
      setDailyStats(hasDailyMap ? dailyMap : buildLegacyDailyStatsFallback())
    }

    refreshSummary()
    const unsubscribe = subscribeQuestionStats(refreshSummary)

    void loadTotalQuestionCount().then((count) => {
      if (count !== null) setTotalQuestions(count)
    })

    const session = loadLastPracticeQueueSession()
    if (session) {
      setLastQueueInfo({
        count: session.questions.length,
        cursor: session.cursor,
      })
    } else {
      setLastQueueInfo(null)
    }

    return unsubscribe
  }, [])

  const progressRatio = useMemo(() => {
    if (!totalQuestions || totalQuestions <= 0) return 0
    return Math.min(1, summary.answeredUniqueQuestions / totalQuestions)
  }, [summary.answeredUniqueQuestions, totalQuestions])

  const accuracy = summary.totalAttempts > 0 ? summary.totalCorrectCount / summary.totalAttempts : 0

  const heatmap = useMemo(() => {
    const endDate = withZeroTime(new Date())
    const startDate = shiftDays(endDate, -364)
    const alignedStart = shiftDays(startDate, -startDate.getDay())
    const totalColumns = Math.ceil((365 + startDate.getDay()) / 7)
    const cells: Array<{ dateKey: string; count: number; level: number; inRange: boolean }> = []
    const monthLabels: Array<{ label: string; col: number }> = []
    let maxCount = 0
    let lastMonthKey = ''

    for (let col = 0; col < totalColumns; col += 1) {
      let firstInRangeDate: Date | null = null

      for (let row = 0; row < 7; row += 1) {
        const currentDate = shiftDays(alignedStart, col * 7 + row)
        const dateKey = toDateKeyLocal(currentDate)
        const inRange = currentDate >= startDate && currentDate <= endDate
        const count = inRange ? Math.max(0, Math.floor(dailyStats[dateKey] ?? 0)) : 0
        if (count > maxCount) maxCount = count
        if (inRange && firstInRangeDate === null) firstInRangeDate = currentDate
        cells.push({ dateKey, count, level: 0, inRange })
      }

      if (firstInRangeDate) {
        const monthKey = `${firstInRangeDate.getFullYear()}-${firstInRangeDate.getMonth()}`
        if (monthKey !== lastMonthKey) {
          monthLabels.push({ label: `${firstInRangeDate.getMonth() + 1}月`, col })
          lastMonthKey = monthKey
        }
      }
    }

    return {
      startDate,
      endDate,
      maxCount,
      totalColumns,
      monthLabels,
      cells: cells.map((cell) => ({
        ...cell,
        level: cell.inRange ? getHeatLevel(cell.count, maxCount) : 0,
      })),
    }
  }, [dailyStats])

  const heatmapWidth = heatmap.totalColumns * CELL_SIZE + Math.max(0, heatmap.totalColumns - 1) * CELL_GAP

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6">
        <section className="w-full rounded-2xl border border-slate-700/60 bg-slate-900/40 p-8 shadow-xl backdrop-blur-sm sm:p-12">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">Sooon Battle Simulator</p>
          <h1 className="mb-4 text-3xl font-bold leading-tight text-white sm:text-5xl">{homeCopy.title}</h1>
          <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">{homeCopy.description}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center rounded-md bg-cyan-400 px-6 py-3 text-base font-semibold text-slate-950 transition hover:bg-cyan-300"
              to={APP_ROUTES.game}
            >
              {homeCopy.enterGame}
            </Link>
            {lastQueueInfo ? (
              <Link
                className="inline-flex items-center rounded-md border border-emerald-400/70 bg-emerald-400/10 px-6 py-3 text-base font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
                to={`${APP_ROUTES.game}?resumeQueue=1`}
              >
                继续上次队列练习（第 {(lastQueueInfo.cursor % lastQueueInfo.count) + 1} 题）
              </Link>
            ) : null}
            <Link
              className="inline-flex items-center rounded-md border border-cyan-500/60 px-6 py-3 text-base font-semibold text-cyan-200 transition hover:border-cyan-300 hover:text-cyan-100"
              to={APP_ROUTES.questionBank}
            >
              {homeCopy.questionBankTable}
            </Link>
            <Link
              className="inline-flex items-center rounded-md border border-slate-500 px-6 py-3 text-base font-semibold text-slate-200 transition hover:border-slate-300 hover:text-white"
              to={APP_ROUTES.about}
            >
              {homeCopy.about}
            </Link>
          </div>
        </section>

        <section className="w-full rounded-2xl border border-emerald-500/30 bg-slate-900/55 p-6 shadow-lg sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-semibold text-emerald-100">近一年每日答题热力图</h2>
            <span className="text-sm text-emerald-200/80">
              {toDateKeyLocal(heatmap.startDate)} ~ {toDateKeyLocal(heatmap.endDate)}
            </span>
          </div>

          <div className="mt-4 overflow-x-auto pb-2">
            <div className="inline-flex flex-col gap-2">
              <div className="flex items-end gap-2">
                <div className="w-10 shrink-0" />
                <div className="relative h-4" style={{ width: `${heatmapWidth}px` }}>
                  {heatmap.monthLabels.map((item) => (
                    <span
                      key={`${item.col}-${item.label}`}
                      className="absolute top-0 text-[11px] leading-none text-slate-400"
                      style={{ left: `${item.col * (CELL_SIZE + CELL_GAP)}px` }}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="grid w-10 shrink-0 gap-[4px] pt-[1px] text-[11px] text-slate-400">
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="h-3 leading-3">
                      {label}
                    </div>
                  ))}
                </div>

                <div
                  className="grid gap-[4px]"
                  style={{
                    gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                    gridAutoFlow: 'column',
                    gridAutoColumns: `${CELL_SIZE}px`,
                  }}
                >
                  {heatmap.cells.map((cell) => (
                    <div
                      key={cell.dateKey}
                      className="rounded-[3px] border border-slate-700/70"
                      style={{
                        width: `${CELL_SIZE}px`,
                        height: `${CELL_SIZE}px`,
                        backgroundColor: cell.inRange ? HEAT_COLORS[cell.level] : 'transparent',
                        opacity: cell.inRange ? 1 : 0.25,
                      }}
                      title={cell.inRange ? `${cell.dateKey}: ${cell.count} 次` : ''}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-300">
            <span>少</span>
            {HEAT_COLORS.map((color, index) => (
              <span key={color} className="h-3 w-3 rounded-[3px] border border-slate-700/70" style={{ backgroundColor: color }} title={`等级 ${index}`} />
            ))}
            <span>多</span>
            <span className="ml-3 text-slate-400">峰值: {heatmap.maxCount} 次/天</span>
          </div>
        </section>

        <section className="w-full rounded-2xl border border-cyan-500/30 bg-slate-900/55 p-6 shadow-lg sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-cyan-100">答题情况仪表盘</h2>
            <span className="text-sm text-cyan-200/80">答题进度 / 总进度</span>
          </div>

          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-700">
            <div className="h-full bg-cyan-400 transition-all" style={{ width: `${(progressRatio * 100).toFixed(2)}%` }} />
          </div>

          <div className="mt-2 text-sm text-slate-300">
            {summary.answeredUniqueQuestions} / {totalQuestions ?? '-'} ({(progressRatio * 100).toFixed(1)}%)
          </div>

          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">答题次数: {summary.totalAttempts}</div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">答题数目(去重): {summary.answeredUniqueQuestions}</div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">看过题目数: {summary.seenUniqueQuestions}</div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">正确次数: {summary.totalCorrectCount}</div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">错误次数: {summary.totalWrongCount}</div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
              平均答题速度: {formatSeconds(summary.averageResponseMs)} | 正确率: {(accuracy * 100).toFixed(1)}%
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
