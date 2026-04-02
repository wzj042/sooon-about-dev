import { Link } from 'react-router-dom'

import { APP_ROUTES } from '../app/paths'
import { toPublicUrl } from '../utils/publicAsset'

const surfaceClass =
  'rounded-[32px] border border-[#0f5c4d]/10 bg-white/78 shadow-[0_18px_55px_rgba(16,92,77,0.10)] backdrop-blur-xl'
const softCardClass = 'rounded-[24px] border border-[#0f7b66]/10 bg-[#f5fbf9] p-5'

const featureCards = [
  {
    badge: 'Battle',
    title: '模拟对战',
    description: '复刻抢答节奏，支持 AI 对手、计时、得分动画和多轮结算，适合在正式开打前热身。',
  },
  {
    badge: 'Queue',
    title: '队列刷题',
    description: '把题库筛选结果直接变成顺序练习队列，适合集中刷错题、未掌握题或指定分类题。',
  },
  {
    badge: 'Table',
    title: '题库表',
    description: '支持关键词、类型、更新时间、作答状态和正确率筛选，支持导出题库为 CSV。',
  },
  {
    badge: 'Settings',
    title: '个性化设置',
    description: '可调 AI 准确率与速度、玩家和对手 ID、头像、换行显示，以及自动跳过结算等行为。',
  },
  {
    badge: 'Stats',
    title: '掌握度追踪',
    description: '自动记录最近作答时间、掌握状态和平均用时。',
  },
  {
    badge: 'Backup',
    title: '本地数据存储',
    description: '数据绑定浏览器本地存储，支持导出、导入和清空数据。',
  },
] as const

const workflowSteps = [
  {
    index: '01',
    title: '先看全局进度',
    description: '首页会展示最近一年热力图、总体正确率、平均作答速度，以及是否存在上次未刷完的队列。',
  },
  {
    index: '02',
    title: '按目标选模式',
    description: '想练节奏就进模拟对战，想集中刷题就去题库表筛选后启动队列练习。',
  },
  {
    index: '03',
    title: '用规则驱动训练',
    description: '通过 AI 参数、题目选择策略、自动掌握阈值和自动下一题，让练习强度接近自己的真实需求。',
  },
  {
    index: '04',
    title: '留住结果',
    description: '每次练习都会回写到本地统计，之后可以继续刷、导出数据，或者针对错题重新建队列。',
  },
] as const

export function AboutPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#edf7f3] px-4 py-6 text-[#163a31] sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(123,206,184,0.34),transparent_56%),radial-gradient(circle_at_top_right,rgba(15,123,102,0.18),transparent_40%)]" />
        <div className="absolute left-[-7rem] top-24 h-72 w-72 rounded-full bg-[#98dbc9]/24 blur-3xl" />
        <div className="absolute right-[-6rem] top-12 h-80 w-80 rounded-full bg-[#5cb59d]/18 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-[#d7efe6] blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 lg:gap-8">
        <section className={`${surfaceClass} overflow-hidden`}>
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.84fr)_minmax(360px,1.16fr)] lg:items-center lg:p-10">
            <div className="flex flex-col justify-center gap-6 lg:pr-8">
              {/* <div className="inline-flex rounded-full border border-[#0f7b66]/12 bg-[#edf8f4] px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-[#0f7b66]">
                Sooon Battle Simulator
              </div> */}
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[#0d3b32] sm:text-5xl">网站说明</h1>

              <div className="flex flex-wrap gap-3">
                <Link
                  className="inline-flex items-center rounded-full bg-[#0f7b66] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,123,102,0.24)] transition hover:bg-[#0d705d]"
                  to={APP_ROUTES.game}
                >
                  进入模拟对战
                </Link>
                <Link
                  className="inline-flex items-center rounded-full border border-[#0f7b66]/18 bg-white px-6 py-3 text-sm font-semibold text-[#195345] transition hover:border-[#0f7b66]/28 hover:bg-[#f5fbf9]"
                  to={APP_ROUTES.questionBank}
                >
                  打开题库表
                </Link>
                <Link
                  className="inline-flex items-center rounded-full border border-[#0f7b66]/12 bg-[#f3faf7] px-6 py-3 text-sm font-semibold text-[#3b5f56] transition hover:bg-[#e9f6f1]"
                  to={APP_ROUTES.home}
                >
                  返回首页
                </Link>
              </div>
            </div>

            <div className="grid content-start gap-3">
              <article className="rounded-[32px] bg-[#0f5e4f] p-6 text-white shadow-[0_18px_40px_rgba(15,94,79,0.28)]">
                <div className="text-sm font-medium text-[#b2ebda]">练习链路</div>
                <div className="mt-3 text-3xl font-semibold leading-tight">首页 → 筛题 → 对战 / 队列 → 统计回看</div>
                <p className="mt-3 text-sm leading-7 text-[#d4eee5]">把浏览、练习、复盘和备份串在同一条链路里，适合做持续训练而不是零散刷题。</p>
              </article>

              <div className="grid gap-3 sm:grid-cols-2">
                <article className={softCardClass}>
                  <div className="text-sm font-medium text-[#4d6f66]">数据来源</div>
                  <div className="mt-2 text-lg font-semibold text-[#143b31]">题库当前为维护者在练习时抓取的页面数据</div>
                  <p className="mt-2 text-sm leading-7 text-[#56716a]">一般每周日更新</p>
                </article>
                <article className={softCardClass}>
                  <div className="text-sm font-medium text-[#4d6f66]">适用方式</div>
                  <div className="mt-2 text-lg font-semibold text-[#143b31]">先判断目标，再选模式</div>
                  <p className="mt-2 text-sm leading-7 text-[#56716a]">练节奏走模拟对战，补薄弱项走题库筛选 + 队列刷题，两者共享同一份训练记录。</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((card) => (
            <article className={surfaceClass} key={card.title}>
              <div className="flex items-center gap-3 p-5">
                {/* <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#dff1eb] text-xs font-semibold uppercase tracking-[0.16em] text-[#0f7b66]">
                  {card.badge.slice(0, 2)}
                </div> */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0f7b66]">{card.badge}</div>
                  <h2 className="mt-1 text-xl font-semibold text-[#14392f]">{card.title}</h2>
                </div>
              </div>
              <p className="px-5 pb-5 text-sm leading-7 text-[#566f69]">{card.description}</p>
            </article>
          ))}
        </section>

        <section className={`${surfaceClass} p-6 sm:p-8`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="inline-flex rounded-full bg-[#e4f4ee] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#0f7b66]">
                Workflow
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-[#12392f] sm:text-3xl">推荐使用路径</h2>
            </div>
            {/* <p className="max-w-xl text-sm leading-7 text-[#56726a]">
              如果你只是想“刷题”，这个应用会显得偏重；它真正适合的是把练习节奏、筛题策略和结果记录放在同一条链路里用。
            </p> */}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            {workflowSteps.map((step) => (
              <article className="rounded-[24px] border border-[#0f7b66]/10 bg-[#f7fcfa] p-5" key={step.index}>
                <div className="inline-flex rounded-full bg-[#dff1eb] px-3 py-1 text-sm font-semibold tracking-[0.18em] text-[#0f7b66]">{step.index}</div>
                <h3 className="mt-4 text-lg font-semibold text-[#17392f]">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#56716a]">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* <section className={`${surfaceClass} p-6 sm:p-8`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="inline-flex rounded-full bg-[#e4f4ee] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#0f7b66]">
                Screens
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-[#12392f] sm:text-3xl">页面实景</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[#56726a]">下面展示的是当前 React 应用里的真实界面截图，方便快速理解不同页面分别负责什么。</p>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {screenshotCards.map((card) => (
              <article className="overflow-hidden rounded-[28px] border border-[#0f7b66]/10 bg-[#f7fcfa]" key={card.title}>
                <div className="flex items-center justify-between border-b border-[#0f7b66]/10 bg-[#eef8f4] px-5 py-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#0f7b66]">{card.badge}</div>
                    <h3 className="mt-1 text-lg font-semibold text-[#17392f]">{card.title}</h3>
                  </div>
                  <span className="rounded-full border border-[#0f7b66]/10 bg-white px-3 py-1 text-xs font-semibold text-[#5b736c]">真实截图</span>
                </div>

                <div className="bg-[#edf7f3] p-4">
                  <img
                    alt={card.title}
                    className="w-full rounded-[20px] border border-[#0f7b66]/10 shadow-[0_16px_34px_rgba(16,92,77,0.12)]"
                    src={toPublicUrl(card.image)}
                  />
                </div>

                <p className="px-5 pb-5 text-sm leading-7 text-[#56716a]">{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <article className={`${surfaceClass} p-6`}>
            <div className="inline-flex rounded-full bg-[#e4f4ee] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#0f7b66]">
              Best For
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-[#12392f]">适合什么场景</h2>
            <div className="mt-5 space-y-3">
              {fitScenarios.map((item) => (
                <div className="rounded-[20px] border border-[#0f7b66]/10 bg-[#f7fcfa] px-4 py-3 text-sm leading-7 text-[#566f69]" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[32px] bg-[#103f35] p-6 text-white shadow-[0_20px_48px_rgba(14,63,53,0.24)]">
            <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#a7e9d6]">
              Quick Notes
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-[#f3fbf8]">使用建议</h2>
            <div className="mt-5 grid gap-3">
              <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-4">
                <div className="text-sm font-semibold text-[#c9f8e8]">想练对战感</div>
                <div className="mt-2 text-sm leading-7 text-[#d3ece4]">直接进入模拟对战，把 AI 准确率和速度调到接近你想对抗的强度。</div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-4">
                <div className="text-sm font-semibold text-[#c9f8e8]">想系统补薄弱项</div>
                <div className="mt-2 text-sm leading-7 text-[#d3ece4]">先在题库表筛出“仅错题”“仅未掌握题”或某个 type，再切到队列练习做连刷。</div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-4">
                <div className="text-sm font-semibold text-[#c9f8e8]">想保留训练成果</div>
                <div className="mt-2 text-sm leading-7 text-[#d3ece4]">定期在首页导出本地数据；如果换设备，再通过导入功能恢复记录。</div>
              </div>
            </div>
          </article>
        </section> */}

        <section className={`${surfaceClass} p-6 sm:p-8`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="inline-flex rounded-full bg-[#e4f4ee] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#0f7b66]">
                Source & Rights
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-[#12392f] sm:text-3xl">题库内容来源与声明</h2>
            </div>
            <div className="text-sm text-[#5d756d]">
              项目开源地址：
              <a
                className="ml-1 font-semibold text-[#0f7b66] underline decoration-[#0f7b66]/35 underline-offset-4"
                href="https://github.com/wzj042/sooon-about-dev"
                rel="noopener noreferrer"
                target="_blank"
              >
                wzj042/sooon-about-dev
              </a>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4 text-sm leading-7 text-[#566f69]">
              <p>
                本站为
                <a className="mx-1 font-semibold text-[#0f7b66] underline decoration-[#0f7b66]/35 underline-offset-4" href="https://sooon.ai/" rel="noopener" target="_blank">
                  素问
                </a>
                的抢答对战模拟器，旨在提供一个可随时练习抢答节奏、刷题和复盘统计的工具。
              </p>
              <p>题目通过 `type` 字段区分来源，`type` 为“素问”的题目归入素问题目，其余题目归入常识题目。</p>
              <blockquote className="rounded-[20px] border border-[#0f7b66]/10 bg-[#f7fcfa] px-4 py-3 text-[#5d756d]">
                2025-09-26 前存量爬取的 1485 题为 AI 预筛后手动分类，可能存在误判错漏，欢迎通过 Github issue 反馈。
              </blockquote>

              <div className="rounded-[24px] border border-[#0f7b66]/10 bg-[#f8fcfa] p-5">
                <h3 className="text-base font-semibold text-[#17392f]">“素问题目”部分</h3>
                <p className="mt-2">
                  借由邮件咨询确认，
                  <a className="mx-1 font-semibold text-[#0f7b66] underline decoration-[#0f7b66]/35 underline-offset-4" href="https://sooon.ai/" rel="noopener" target="_blank">
                    素问
                  </a>
                  题目的版权为开放状态。这里同时参考
                  <a
                    className="mx-1 font-semibold text-[#0f7b66] underline decoration-[#0f7b66]/35 underline-offset-4"
                    href="https://www.zhihu.com/question/264373660/answer/1710187984#:~:text=%E6%88%91%E5%86%99%E7%9A%84%E4%B8%9C%E8%A5%BF%E9%83%BD%E5%8F%AF%E4%BB%A5%E9%9A%8F%E4%BE%BF%E5%85%8D%E8%B4%B9%E8%BD%AC%E8%BD%BD%EF%BC%8C%E4%B8%8D%E7%94%A8%E9%97%AE%E6%88%91%EF%BC%8C%E4%B8%8D%E7%94%A8%E6%B3%A8%E6%98%8E%E5%87%BA%E5%A4%84%E3%80%81%E4%B8%8D%E9%9C%80%E8%A6%81%E5%A3%B0%E6%98%8E%E5%8E%9F%E8%91%97%E4%BD%9C%E6%9D%83%E3%80%81%E4%B8%8D%E7%94%A8%E7%BB%99%E9%92%B1%EF%BC%8C%E4%BD%A0%E8%B5%9A%E4%BA%86%E9%92%B1%E7%9A%84%E8%AF%9D%E9%83%BD%E5%BD%92%E4%BD%A0%E8%87%AA%E5%B7%B1%E3%80%82"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    素问维护者在读者须知中的说明
                  </a>
                  标注出处。
                </p>
              </div>

              <div className="rounded-[24px] border border-[#0f7b66]/10 bg-[#f8fcfa] p-5">
                <h3 className="text-base font-semibold text-[#17392f]">“常识题目”部分</h3>
                <p className="mt-2">这部分题目来源于网络公开渠道的收集整理。由于来源广泛，本站无法逐条追溯并确认其原始版权状态，因此仅供用户个人学习与非商业交流使用。</p>
              </div>

              <div className="rounded-[24px] border border-[#0f7b66]/10 bg-[#fff9f1] p-5">
                <h3 className="text-base font-semibold text-[#17392f]">侵权处理</h3>
                <p className="mt-2">
                  如果你认为本站任何内容侵犯了你的合法权益，请通过
                  <a className="mx-1 font-semibold text-[#0f7b66] underline decoration-[#0f7b66]/35 underline-offset-4" href="https://github.com/wzj042/sooon-about-dev/issues" rel="noopener noreferrer" target="_blank">
                    Github issue
                  </a>
                  联系。在收到通知并核实后，本站会立即移除相关内容。
                </p>
              </div>
            </div>

            <figure className="rounded-[28px] border border-[#0f7b66]/10 bg-[#f7fcfa] p-4">
              <img alt="邮件往来截图" className="w-full rounded-[20px] border border-[#0f7b66]/10" src={toPublicUrl('assets/imgs/auth.png')} />
              <figcaption className="mt-3 text-center text-xs text-[#6b837c]">素问题目开放状态相关邮件往来截图</figcaption>
            </figure>
          </div>
        </section>
      </div>
    </main>
  )
}
