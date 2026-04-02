import { Link } from 'react-router-dom'

import { APP_ROUTES } from '../app/paths'
import { toPublicUrl } from '../utils/publicAsset'

const featureCards = [
  {
    title: '模拟对战',
    description: '复刻抢答节奏，支持 AI 对手、计时、得分动画和多轮结算，适合在正式开打前热身。',
  },
  {
    title: '队列刷题',
    description: '把题库筛选结果直接变成顺序练习队列，适合集中刷错题、未掌握题或指定分类题。',
  },
  {
    title: '题库表',
    description: '支持关键词、类型、更新时间、作答状态和正确率筛选，还能导出当前结果为 CSV。',
  },
  {
    title: '个性化设置',
    description: '可调 AI 准确率与速度、玩家和对手 ID、头像、换行显示，以及自动跳过结算等行为。',
  },
  {
    title: '掌握度追踪',
    description: '自动记录最近作答时间、答题热力图、掌握状态和平均用时，方便复盘自己的进度。',
  },
  {
    title: '本地数据管理',
    description: '支持导出、导入和清空浏览器本地数据，便于迁移设备或做阶段性备份。',
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

const screenshotCards = [
  {
    title: '首页总览',
    description: '集中展示入口、热力图和核心统计，适合先判断今天该练什么。',
    image: 'assets/docs/home-overview.png',
    badge: 'Overview',
  },
  {
    title: '模拟对战主界面',
    description: '保留抢答场景里的得分、倒计时、题目切换和对手反馈，适合练临场节奏。',
    image: 'assets/docs/game-simulator.png',
    badge: 'Battle',
  },
  {
    title: '队列练习模式',
    description: '把筛选后的题目按顺序压成训练流，配合掌握阈值和自动下一题做高密度刷题。',
    image: 'assets/docs/queue-practice.png',
    badge: 'Queue',
  },
  {
    title: '题库表筛选',
    description: '支持大范围筛选、排序、字段开关和 CSV 导出，适合先找题再开练。',
    image: 'assets/docs/question-bank.png',
    badge: 'Table',
  },
] as const

const fitScenarios = [
  '赛前热身：先调高 AI 强度，快速熟悉抢答节奏。',
  '集中纠错：在题库表筛出错题或未掌握题，生成队列连续刷。',
  '长期自测：靠热力图、正确率和平均用时观察自己的节奏变化。',
]

export function AboutPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dff7f1_0%,#f6f6ed_44%,#f3efe5_100%)] px-4 py-8 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[32px] border border-[#1f3a2f]/10 bg-[#143c31] text-white shadow-[0_28px_80px_rgba(20,60,49,0.22)]">
          <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.2fr_0.8fr] lg:px-10">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-[#90f0c6]">Sooon Battle Simulator</p>
              <h1 className="max-w-3xl text-3xl font-black leading-tight text-[#f7f8ef] sm:text-5xl">
                功能介绍与使用路径
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#d6eadf] sm:text-lg">
                这是一个围绕素问抢答节奏打造的练习站点。它不只是在浏览器里“做题”，而是把对战、刷题、题库筛选、统计回看和数据备份串成一套完整训练流程。
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  className="inline-flex items-center rounded-full bg-[#f3d36a] px-5 py-3 text-sm font-semibold text-[#1f2a20] transition hover:bg-[#f8de88]"
                  to={APP_ROUTES.game}
                >
                  进入模拟对战
                </Link>
                <Link
                  className="inline-flex items-center rounded-full border border-white/20 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/14"
                  to={APP_ROUTES.questionBank}
                >
                  打开题库表
                </Link>
                <Link
                  className="inline-flex items-center rounded-full border border-[#90f0c6]/35 bg-[#0f3027] px-5 py-3 text-sm font-semibold text-[#c9f8e1] transition hover:border-[#90f0c6]/55 hover:text-white"
                  to={APP_ROUTES.home}
                >
                  返回首页
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur">
                <div className="text-sm text-[#90f0c6]">练习链路</div>
                <div className="mt-2 text-2xl font-bold text-white">首页 → 筛题 → 对战 / 队列 → 统计回看</div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-[#f5f1e8] p-5 text-[#1e2f26]">
                <div className="text-sm font-semibold text-[#1f6d56]">数据策略</div>
                <div className="mt-2 text-lg font-bold">完全走浏览器本地存储</div>
                <p className="mt-2 text-sm leading-6 text-[#425349]">练习记录、掌握状态、队列进度和导入导出都围绕本地数据展开，轻量直接，也方便个人备份。</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((card) => (
            <article
              className="rounded-[24px] border border-black/6 bg-white/80 p-5 shadow-[0_16px_40px_rgba(25,35,28,0.08)] backdrop-blur"
              key={card.title}
            >
              <h2 className="text-xl font-bold text-[#163429]">{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-700">{card.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-[32px] border border-[#214537]/12 bg-[#f7f4ec]/90 p-6 shadow-[0_18px_50px_rgba(40,52,43,0.08)] sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#1f6d56]">Workflow</p>
              <h2 className="mt-2 text-2xl font-black text-[#17352a] sm:text-3xl">推荐使用路径</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-600">如果你只是想“刷题”，这个应用会显得过重；它更适合把练习节奏、筛题策略和结果记录放在同一条链路里使用。</p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            {workflowSteps.map((step) => (
              <article className="rounded-[24px] border border-[#214537]/10 bg-white p-5" key={step.index}>
                <div className="text-sm font-semibold tracking-[0.2em] text-[#2a8a69]">{step.index}</div>
                <h3 className="mt-3 text-lg font-bold text-[#18392d]">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-700">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-[#153b30]/10 bg-[#fffdf8]/92 p-6 shadow-[0_18px_50px_rgba(33,49,40,0.08)] sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#9f6d18]">Screens</p>
              <h2 className="mt-2 text-2xl font-black text-[#17352a] sm:text-3xl">页面实景</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-600">下面展示的是当前 React 应用里的真实界面截图，方便快速理解不同页面分别负责什么。</p>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {screenshotCards.map((card) => (
              <article className="overflow-hidden rounded-[28px] border border-black/6 bg-white" key={card.title}>
                <div className="flex items-center justify-between border-b border-black/6 bg-[#f6efe1] px-5 py-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6220]">{card.badge}</div>
                    <h3 className="mt-1 text-lg font-bold text-[#1a372c]">{card.title}</h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">真实截图</span>
                </div>

                <div className="bg-[#eef4ef] p-4">
                  <img alt={card.title} className="w-full rounded-[18px] border border-black/8 shadow-[0_18px_34px_rgba(17,38,29,0.14)]" src={toPublicUrl(card.image)} />
                </div>

                <p className="px-5 pb-5 text-sm leading-7 text-slate-700">{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-[28px] border border-[#153b30]/10 bg-white/88 p-6 shadow-[0_18px_50px_rgba(33,49,40,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#1f6d56]">Best For</p>
            <h2 className="mt-2 text-2xl font-black text-[#17352a]">适合什么场景</h2>
            <div className="mt-5 space-y-3">
              {fitScenarios.map((item) => (
                <div className="rounded-[20px] border border-[#214537]/10 bg-[#f7fbf8] px-4 py-3 text-sm leading-7 text-slate-700" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[28px] border border-[#153b30]/10 bg-[#163e33] p-6 text-white shadow-[0_18px_50px_rgba(21,49,39,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#90f0c6]">Quick Notes</p>
            <h2 className="mt-2 text-2xl font-black text-[#f8f7ef]">使用建议</h2>
            <div className="mt-5 grid gap-3">
              <div className="rounded-[20px] border border-white/10 bg-white/8 px-4 py-3">
                <div className="text-sm font-semibold text-[#c9f8e1]">想练对战感</div>
                <div className="mt-1 text-sm leading-7 text-[#d9ece3]">直接进入模拟对战，把 AI 准确率和速度调到接近你想对抗的强度。</div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/8 px-4 py-3">
                <div className="text-sm font-semibold text-[#c9f8e1]">想系统补薄弱项</div>
                <div className="mt-1 text-sm leading-7 text-[#d9ece3]">先在题库表筛出“仅错题”“仅未掌握题”或某个 type，再切到队列练习做连刷。</div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/8 px-4 py-3">
                <div className="text-sm font-semibold text-[#c9f8e1]">想保留训练成果</div>
                <div className="mt-1 text-sm leading-7 text-[#d9ece3]">定期在首页导出本地数据；如果换设备，再通过导入功能恢复记录。</div>
              </div>
            </div>
          </article>
        </section>

        <section className="rounded-[32px] border border-[#163c31]/10 bg-white/90 p-6 shadow-[0_18px_50px_rgba(33,49,40,0.08)] sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#1f6d56]">Source & Rights</p>
              <h2 className="mt-2 text-2xl font-black text-[#17352a] sm:text-3xl">题库内容来源与声明</h2>
            </div>
            <div className="text-sm text-slate-600">项目开源地址：<a className="font-semibold text-[#1f6d56] underline decoration-[#1f6d56]/35 underline-offset-4" href="https://github.com/wzj042/sooon-about-dev" rel="noopener noreferrer" target="_blank">wzj042/sooon-about-dev</a></div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4 text-sm leading-7 text-slate-700">
              <p>
                本站为
                <a className="mx-1 font-semibold text-[#1f6d56] underline decoration-[#1f6d56]/35 underline-offset-4" href="https://sooon.ai/" rel="noopener" target="_blank">
                  素问
                </a>
                的抢答对战模拟器，旨在提供一个可随时练习抢答节奏、刷题和复盘统计的工具。
              </p>
              <p>题目通过 `type` 字段区分来源，`type` 为“素问”的题目归入素问题目，其余题目归入常识题目。</p>
              <blockquote className="rounded-[20px] border border-[#214537]/10 bg-[#f7fbf8] px-4 py-3 text-slate-600">
                当前（2025-09-26）存量爬取的 1485 题为 AI 预筛后手动分类，可能存在误判错漏，欢迎通过 Github issue 反馈。
              </blockquote>

              <div className="rounded-[24px] border border-[#214537]/10 bg-[#fcfaf4] p-5">
                <h3 className="text-base font-bold text-[#17352a]">“素问题目”部分</h3>
                <p className="mt-2">
                  借由邮件咨询确认，
                  <a className="mx-1 font-semibold text-[#1f6d56] underline decoration-[#1f6d56]/35 underline-offset-4" href="https://sooon.ai/" rel="noopener" target="_blank">
                    素问
                  </a>
                  题目的版权为开放状态。这里同时参考
                  <a
                    className="mx-1 font-semibold text-[#1f6d56] underline decoration-[#1f6d56]/35 underline-offset-4"
                    href="https://www.zhihu.com/question/264373660/answer/1710187984#:~:text=%E6%88%91%E5%86%99%E7%9A%84%E4%B8%9C%E8%A5%BF%E9%83%BD%E5%8F%AF%E4%BB%A5%E9%9A%8F%E4%BE%BF%E5%85%8D%E8%B4%B9%E8%BD%AC%E8%BD%BD%EF%BC%8C%E4%B8%8D%E7%94%A8%E9%97%AE%E6%88%91%EF%BC%8C%E4%B8%8D%E7%94%A8%E6%B3%A8%E6%98%8E%E5%87%BA%E5%A4%84%E3%80%81%E4%B8%8D%E9%9C%80%E8%A6%81%E5%A3%B0%E6%98%8E%E5%8E%9F%E8%91%97%E4%BD%9C%E6%9D%83%E3%80%81%E4%B8%8D%E7%94%A8%E7%BB%99%E9%92%B1%EF%BC%8C%E4%BD%A0%E8%B5%9A%E4%BA%86%E9%92%B1%E7%9A%84%E8%AF%9D%E9%83%BD%E5%BD%92%E4%BD%A0%E8%87%AA%E5%B7%B1%E3%80%82"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    素问维护者在读者须知中的说明
                  </a>
                  标注出处。
                </p>
              </div>

              <div className="rounded-[24px] border border-[#214537]/10 bg-[#fcfaf4] p-5">
                <h3 className="text-base font-bold text-[#17352a]">“常识题目”部分</h3>
                <p className="mt-2">
                  这部分题目来源于网络公开渠道的收集整理。由于来源广泛，本站无法逐条追溯并确认其原始版权状态，因此仅供用户个人学习与非商业交流使用。
                </p>
              </div>

              <div className="rounded-[24px] border border-[#214537]/10 bg-[#fff5f0] p-5">
                <h3 className="text-base font-bold text-[#17352a]">侵权处理</h3>
                <p className="mt-2">
                  如果你认为本站任何内容侵犯了你的合法权益，请通过
                  <a className="mx-1 font-semibold text-[#1f6d56] underline decoration-[#1f6d56]/35 underline-offset-4" href="https://github.com/wzj042/sooon-about-dev/issues" rel="noopener noreferrer" target="_blank">
                    Github issue
                  </a>
                  联系。在收到通知并核实后，本站会立即移除相关内容。
                </p>
              </div>
            </div>

            <figure className="rounded-[28px] border border-[#214537]/10 bg-[#f7fbf8] p-4">
              <img alt="邮件往来截图" className="w-full rounded-[20px] border border-black/8" src={toPublicUrl('assets/imgs/auth.png')} />
              <figcaption className="mt-3 text-center text-xs text-slate-500">素问题目开放状态相关邮件往来截图</figcaption>
            </figure>
          </div>
        </section>
      </div>
    </main>
  )
}
