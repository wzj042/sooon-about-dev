import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { APP_ROUTES } from '../app/paths'
import {
  clearPracticeQueueSession,
  loadLastPracticeQueueSession,
  subscribePracticeQueueSession,
} from '../services/practiceQueue'
import {
  clearQuestionHistory,
  getQuestionStatsSummary,
  loadDailyQuestionStatsMap,
  loadQuestionStatsMap,
  subscribeQuestionStats,
  type DailyQuestionStatsMap,
  type QuestionStatsSummary,
} from '../services/questionStats'
import { exportUserData, importUserData } from '../services/userDataTransfer'
import { toPublicUrl } from '../utils/publicAsset'

const homeCopy = {
  title: '素问模拟抢答',
  description: '支持模拟实战练习答题节奏，或者根据喜好筛选需要练习的题单',
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
const HEAT_COLORS = ['#dcece6', '#bbe0d4', '#8ccab8', '#51ad95', '#0f7b66']
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
  const [lastQueueInfo, setLastQueueInfo] = useState<{ count: number; cursor: number; practicedCount: number } | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyQuestionStatsMap>({})
  const [userDataTransferBusy, setUserDataTransferBusy] = useState(false)
  const [userDataTransferMessage, setUserDataTransferMessage] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const refreshQueueInfo = () => {
      const session = loadLastPracticeQueueSession()
      if (session) {
        setLastQueueInfo({
          count: session.questions.length,
          cursor: session.cursor,
          practicedCount: session.practicedCount,
        })
        return
      }

      setLastQueueInfo(null)
    }

    const refreshSummary = () => {
      const map = loadQuestionStatsMap()
      setSummary(getQuestionStatsSummary(map))

      const dailyMap = loadDailyQuestionStatsMap()
      const hasDailyMap = Object.keys(dailyMap).length > 0
      setDailyStats(hasDailyMap ? dailyMap : buildLegacyDailyStatsFallback())
    }

    refreshSummary()
    refreshQueueInfo()
    const unsubscribeStats = subscribeQuestionStats(refreshSummary)
    const unsubscribeQueue = subscribePracticeQueueSession(refreshQueueInfo)

    void loadTotalQuestionCount().then((count) => {
      if (count !== null) setTotalQuestions(count)
    })

    return () => {
      unsubscribeStats()
      unsubscribeQueue()
    }
  }, [])

  const progressRatio = useMemo(() => {
    if (!totalQuestions || totalQuestions <= 0) return 0
    return Math.min(1, summary.answeredUniqueQuestions / totalQuestions)
  }, [summary.answeredUniqueQuestions, totalQuestions])

  const accuracy = summary.totalAttempts > 0 ? summary.totalCorrectCount / summary.totalAttempts : 0
  const queueTotal = lastQueueInfo?.count ?? 0
  const queuePracticed = Math.min(queueTotal, Math.max(0, lastQueueInfo?.practicedCount ?? 0))
  const queueNextIndex = lastQueueInfo && lastQueueInfo.count > 0 ? (lastQueueInfo.cursor % lastQueueInfo.count) + 1 : 0

  const handleExportUserData = () => {
    const result = exportUserData()
    setUserDataTransferMessage(result.message)
  }

  const handleClearQuestionHistory = () => {
    const firstConfirmed = window.confirm('将删除当前浏览器中的历史答题记录，是否继续？')
    if (!firstConfirmed) return

    const secondConfirmed = window.confirm('删除后无法恢复。确认删除历史答题记录吗？')
    if (!secondConfirmed) return

    clearQuestionHistory()
    clearPracticeQueueSession()
    setUserDataTransferMessage('历史答题记录和队列练习记录已删除')
  }

  const handleImportUserData = async (file: File) => {
    const confirmed = window.confirm('导入将覆盖当前本地用户数据，是否继续？')
    if (!confirmed) return

    setUserDataTransferBusy(true)
    const result = await importUserData(file)
    setUserDataTransferBusy(false)
    setUserDataTransferMessage(result.message)

    if (result.ok) {
      window.setTimeout(() => {
        window.location.reload()
      }, 400)
    }
  }

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
  const heroChips = [
    // totalQuestions ? `${totalQuestions} 道题` : '题库统计载入中',
    // lastQueueInfo ? `上次练到第 ${queueNextIndex} 题` : '支持自动记录训练进度',
    // '本地保存训练历史',
    // '三种练习模式',
  ]
  const metricCards = [
    {
      label: '总体正确率',
      value: `${(accuracy * 100).toFixed(1)}%`,
      supporting: summary.totalAttempts > 0 ? `正确 ${summary.totalCorrectCount} / 共 ${summary.totalAttempts} 次作答` : '开始答题后会显示统计',
    },
    {
      label: '平均作答速度',
      value: formatSeconds(summary.averageResponseMs),
      supporting: summary.totalAttempts > 0 ? '统计范围为已有作答记录' : '暂无速度数据',
    },
    {
      label: '继续中的队列',
      value: lastQueueInfo ? `${queuePracticed}/${queueTotal}` : '暂无',
      supporting: lastQueueInfo ? `下次会从第 ${queueNextIndex} 题继续` : '从题库筛选页可快速创建新队列',
    },
    {
      label: '已浏览题目',
      value: `${summary.seenUniqueQuestions}`,
      supporting: totalQuestions ? `占总题库 ${((summary.seenUniqueQuestions / totalQuestions) * 100).toFixed(1)}%` : '题库总量载入后会显示比例',
    },
  ]
  const dashboardCards = [
    {
      label: '答题次数',
      value: `${summary.totalAttempts}`,
      supporting: '累计作答总次数',
      tone: 'bg-[#f4fbf8]',
    },
    {
      label: '答题数目(去重)',
      value: `${summary.answeredUniqueQuestions}`,
      supporting: '至少答过一次的题目',
      tone: 'bg-[#eef8f4]',
    },
    {
      label: '看过题目数',
      value: `${summary.seenUniqueQuestions}`,
      supporting: '浏览或作答过的题目',
      tone: 'bg-[#f6fcf9]',
    },
    {
      label: '正确次数',
      value: `${summary.totalCorrectCount}`,
      supporting: '答对题目的累计次数',
      tone: 'bg-[#edf8f2]',
    },
    {
      label: '错误次数',
      value: `${summary.totalWrongCount}`,
      supporting: '答错题目的累计次数',
      tone: 'bg-[#f8fbf9]',
    },
    {
      label: '当前节奏',
      value: `${formatSeconds(summary.averageResponseMs)} / ${(accuracy * 100).toFixed(1)}%`,
      supporting: '平均用时 / 总体正确率',
      tone: 'bg-[#f1faf6]',
    },
  ]

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#edf7f3] text-[#173a31]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(123,206,184,0.34),transparent_56%),radial-gradient(circle_at_top_right,rgba(15,123,102,0.18),transparent_40%)]" />
        <div className="absolute left-[-7rem] top-24 h-72 w-72 rounded-full bg-[#98dbc9]/26 blur-3xl" />
        <div className="absolute right-[-6rem] top-12 h-80 w-80 rounded-full bg-[#5cb59d]/18 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-[#d7efe6] blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:gap-8">
        <section className="overflow-hidden rounded-[36px] border border-[#0f5c4d]/10 bg-white/78 shadow-[0_24px_70px_rgba(16,92,77,0.13)] backdrop-blur-xl">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
            <div className="flex flex-col justify-between gap-6">
              <div>
                {/* <div className="inline-flex rounded-full border border-[#0f7b66]/12 bg-[#edf8f4] px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-[#0f7b66]">
                  Sooon Battle Simulator
                </div> */}
                <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-[#0d3b32] sm:text-5xl">{homeCopy.title}</h1>
                <p className="mt-4 max-w-2xl text-base leading-8 text-[#47675f] sm:text-lg">{homeCopy.description}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {heroChips.map((chip) => (
                  <span
                    className="rounded-full border border-[#0f7b66]/10 bg-[#f4fbf8] px-4 py-2 text-sm font-medium text-[#29594f]"
                    key={chip}
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  className="inline-flex items-center rounded-full bg-[#0f7b66] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,123,102,0.24)] transition hover:bg-[#0d705d]"
                  to={APP_ROUTES.game}
                >
                  {homeCopy.enterGame}
                </Link>
                {lastQueueInfo ? (
                  <Link
                    className="inline-flex items-center rounded-full bg-[#d9efe7] px-6 py-3 text-sm font-semibold text-[#0f5e4f] transition hover:bg-[#cce8de]"
                    to={`${APP_ROUTES.queuePractice}?resumeQueue=1`}
                  >
                    继续上次队列练习（{queuePracticed}/{queueTotal}，第 {queueNextIndex} 题）
                  </Link>
                ) : null}
                <Link
                  className="inline-flex items-center rounded-full border border-[#0f7b66]/18 bg-white px-6 py-3 text-sm font-semibold text-[#195345] transition hover:border-[#0f7b66]/28 hover:bg-[#f5fbf9]"
                  to={APP_ROUTES.questionBank}
                >
                  {homeCopy.questionBankTable}
                </Link>
                <Link
                  className="inline-flex items-center rounded-full border border-[#0f7b66]/12 bg-[#f3faf7] px-6 py-3 text-sm font-semibold text-[#3b5f56] transition hover:bg-[#e9f6f1]"
                  to={APP_ROUTES.about}
                >
                  {homeCopy.about}
                </Link>
              </div>

            </div>

            <div className="grid gap-3">
              <article className="rounded-[32px] bg-[#0f5e4f] p-6 text-white shadow-[0_18px_40px_rgba(15,94,79,0.28)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#b2ebda]">练习进度</div>
                    <div className="mt-3 text-4xl font-semibold tracking-tight">{(progressRatio * 100).toFixed(1)}%</div>
                  </div>
                  <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-[#d6f5eb]">或许题库速度增长的会比练习速度要快……</span>
                </div>

                <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/14">
                  <div className="h-full rounded-full bg-[#8de1cd] transition-all" style={{ width: `${(progressRatio * 100).toFixed(2)}%` }} />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[#d4eee5]">
                  <span>
                    {summary.answeredUniqueQuestions} / {totalQuestions ?? '-'} 题
                  </span>
                  <span>已浏览 {summary.seenUniqueQuestions} 题</span>
                </div>
              </article>

              <div className="grid gap-3 sm:grid-cols-2">
                {metricCards.map((card) => (
                  <article className="rounded-[24px] border border-[#0f7b66]/10 bg-[#f6fcfa] p-4" key={card.label}>
                    <div className="text-sm font-medium text-[#54736b]">{card.label}</div>
                    <div className="mt-3 text-2xl font-semibold tracking-tight text-[#153b31]">{card.value}</div>
                    <p className="mt-2 text-sm leading-6 text-[#56716a]">{card.supporting}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-[#0f5c4d]/10 bg-white/76 p-6 shadow-[0_18px_55px_rgba(16,92,77,0.10)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full bg-[#e4f4ee] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#0f7b66]">
                Heatmap
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-[#12392f] sm:text-3xl">近一年每日答题热力图</h2>
            </div>
            <div className="rounded-full border border-[#0f7b66]/10 bg-[#f4fbf8] px-4 py-2 text-sm font-medium text-[#4c6f66]">
              {toDateKeyLocal(heatmap.startDate)} ~ {toDateKeyLocal(heatmap.endDate)}
            </div>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#547069]">
            每次完成作答后，这里的颜色都会自动更新。你可以直接从热力图判断最近的练习密度，以及有没有出现断档。
          </p>

          <div className="mt-6 overflow-x-auto pb-2">
            <div className="inline-flex flex-col gap-2">
              <div className="flex items-end gap-2">
                <div className="w-10 shrink-0" />
                <div className="relative h-4" style={{ width: `${heatmapWidth}px` }}>
                  {heatmap.monthLabels.map((item) => (
                    <span
                      className="absolute top-0 text-[11px] leading-none text-[#6a857c]"
                      key={`${item.col}-${item.label}`}
                      style={{ left: `${item.col * (CELL_SIZE + CELL_GAP)}px` }}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="grid w-10 shrink-0 gap-[4px] pt-[1px] text-[11px] text-[#6a857c]">
                  {WEEKDAY_LABELS.map((label, index) => (
                    <div className="h-3 leading-3" key={`${index}-${label}`}>
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
                      className="rounded-[4px] border border-[#d7e5df]"
                      key={cell.dateKey}
                      style={{
                        width: `${CELL_SIZE}px`,
                        height: `${CELL_SIZE}px`,
                        backgroundColor: cell.inRange ? HEAT_COLORS[cell.level] : '#f8fbfa',
                        opacity: cell.inRange ? 1 : 0.42,
                      }}
                      title={cell.inRange ? `${cell.dateKey}: ${cell.count} 次` : ''}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#59756d]">
              <span>少</span>
              {HEAT_COLORS.map((color, index) => (
                <span key={color} className="h-3 w-3 rounded-[4px] border border-[#d7e5df]" style={{ backgroundColor: color }} title={`等级 ${index}`} />
              ))}
              <span>多</span>
            </div>
            <div className="text-sm font-medium text-[#56726a]">峰值: {heatmap.maxCount} 次/天</div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-[32px] border border-[#0f5c4d]/10 bg-white/78 p-6 shadow-[0_18px_55px_rgba(16,92,77,0.10)] backdrop-blur-xl sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="inline-flex rounded-full bg-[#e4f4ee] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#0f7b66]">
                  Insights
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-[#12392f]">答题情况仪表盘</h2>
              </div>
              <div className="rounded-full border border-[#0f7b66]/10 bg-[#f6fcfa] px-4 py-2 text-sm font-medium text-[#57736b]">
                已答 {summary.answeredUniqueQuestions} 题
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {dashboardCards.map((card) => (
                <article className={`rounded-[24px] border border-[#0f7b66]/10 p-4 ${card.tone}`} key={card.label}>
                  <div className="text-sm font-medium text-[#58726b]">{card.label}</div>
                  <div className="mt-3 text-2xl font-semibold tracking-tight text-[#143a31]">{card.value}</div>
                  <p className="mt-2 text-sm leading-6 text-[#58726b]">{card.supporting}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[32px] bg-[#103f35] p-6 text-white shadow-[0_20px_48px_rgba(14,63,53,0.24)] sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#a7e9d6]">
                  Local Data
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-[#f3fbf8]">用户数据与记录</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-[#d6efe7]">
                备份 / 导入 / 清空
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-[#d0ebe2]">
              当前浏览器里的练习记录、队列进度和统计信息都保存在本地。建议定期导出一次，避免换设备或清缓存后丢失。
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="inline-flex items-center rounded-full bg-[#8ae1cc] px-5 py-3 text-sm font-semibold text-[#0d3b32] transition hover:bg-[#9ae7d4] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={userDataTransferBusy}
                type="button"
                onClick={handleExportUserData}
              >
                导出用户数据
              </button>
              <button
                className="inline-flex items-center rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={userDataTransferBusy}
                type="button"
                onClick={() => {
                  importInputRef.current?.click()
                }}
              >
                导入用户数据
              </button>
              <button
                className="inline-flex items-center rounded-full border border-[#ffd7a0]/20 bg-[#f7b955]/12 px-5 py-3 text-sm font-semibold text-[#ffe2b3] transition hover:bg-[#f7b955]/18 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={userDataTransferBusy}
                type="button"
                onClick={handleClearQuestionHistory}
              >
                删除历史答题记录
              </button>
              <input
                accept="application/json,.json"
                ref={importInputRef}
                style={{ display: 'none' }}
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  void handleImportUserData(file)
                  event.target.value = ''
                }}
              />
            </div>

            <div className="mt-6 grid gap-3">
              <article className="rounded-[24px] border border-white/10 bg-white/8 p-4">
                <div className="text-sm font-semibold text-[#c9f8e8]">备份建议</div>
                <p className="mt-2 text-sm leading-7 text-[#d3ece4]">完成一轮集中训练后导出一次数据，最稳妥；换设备前也建议先导出后导入。</p>
              </article>
              <article className="rounded-[24px] border border-white/10 bg-white/8 p-4">
                <div className="text-sm font-semibold text-[#c9f8e8]">清空影响</div>
                <p className="mt-2 text-sm leading-7 text-[#d3ece4]">删除历史记录会同时重置热力图、答题统计和队列练习进度，无法恢复。</p>
              </article>
              {userDataTransferMessage ? (
                <article className="rounded-[24px] border border-[#8ae1cc]/25 bg-[#8ae1cc]/12 p-4 text-sm leading-7 text-[#eefcf7]">
                  {userDataTransferMessage}
                </article>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
