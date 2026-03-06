// import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { APP_ROUTES } from '../app/paths'
import { toPublicUrl } from '../utils/publicAsset'

// interface ManifestSummary {
//   total: number | null
//   version: number | null
//   contentHash: string | null
// }

// const DEFAULT_SUMMARY: ManifestSummary = {
//   total: null,
//   version: null,
//   contentHash: null,
// }

export function AboutPage() {
  // const [summary, setSummary] = useState<ManifestSummary>(DEFAULT_SUMMARY)

  // useEffect(() => {
  //   let cancelled = false

  //   const loadManifest = async () => {
  //     try {
  //       const response = await fetch(toPublicUrl('assets/qb.manifest.json'), { cache: 'no-store' })
  //       if (!response.ok) return

  //       const payload = (await response.json()) as {
  //         total?: unknown
  //         version?: unknown
  //         contentHash?: unknown
  //       }

  //       if (cancelled) return

  //       setSummary({
  //         total: typeof payload.total === 'number' && Number.isFinite(payload.total) ? Math.floor(payload.total) : null,
  //         version: typeof payload.version === 'number' && Number.isFinite(payload.version) ? Math.floor(payload.version) : null,
  //         contentHash: typeof payload.contentHash === 'string' && payload.contentHash.length > 0 ? payload.contentHash : null,
  //       })
  //     } catch {
  //       // ignore
  //     }
  //   }

  //   void loadManifest()
  //   return () => {
  //     cancelled = true
  //   }
  // }, [])

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-800">
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-4 text-2xl font-bold">关于</h1>

        <section className="mb-8 leading-7">
          <h2 className="mb-2 text-lg font-semibold">网站说明</h2>
          <p className="mb-2">
            本站为
            <a rel="noopener" className="mx-1 text-blue-600 underline" href="https://sooon.ai/" target="_blank">
              素问
            </a>
            的抢答对战模拟器，旨在提供一个供用户随时进行抢答对战练习的工具。
          </p>
          <p className="mb-4">
            项目开源地址：
            <a rel="noopener noreferrer" className="mx-1 text-blue-600 underline" href="https://github.com/wzj042/sooon-about-dev" target="_blank">
              wzj042/sooon-about-dev
            </a>
          </p>

          <h2 className="mb-2 text-lg font-semibold">题库内容来源与声明</h2>
          <p className="mb-2">本站使用的题库内容由两部分组成，其版权归属各不相同：</p>
          <blockquote className="mb-2 border-l-4 border-slate-300 pl-4 text-slate-600">
            题目中通过 type 字段区分，type 为 “素问” 的题目为素问题目，其余的题目为常识题目。
          </blockquote>
          <blockquote className="mb-3 border-l-4 border-slate-300 pl-4 text-slate-600">
            当前（2025-09-26）存量爬取的 1485 题为 AI 预筛后手动分类，可能存在误判错漏，欢迎通过 Github issue 反馈。
          </blockquote>
          <hr className="my-4 border-slate-200" />

          <h2 className="mb-2 text-lg font-semibold">"素问题目"部分</h2>
          <p className="mb-4">
            借由邮件咨询确认，
            <a rel="noopener" className="mx-1 text-blue-600 underline" href="https://sooon.ai/" target="_blank">
              素问
            </a>
            题目的版权为开放状态。此处鉴于
            <a
              className="mx-1 text-blue-600 underline"
              href="https://www.zhihu.com/question/264373660/answer/1710187984#:~:text=%E6%88%91%E5%86%99%E7%9A%84%E4%B8%9C%E8%A5%BF%E9%83%BD%E5%8F%AF%E4%BB%A5%E9%9A%8F%E4%BE%BF%E5%85%8D%E8%B4%B9%E8%BD%AC%E8%BD%BD%EF%BC%8C%E4%B8%8D%E7%94%A8%E9%97%AE%E6%88%91%EF%BC%8C%E4%B8%8D%E7%94%A8%E6%B3%A8%E6%98%8E%E5%87%BA%E5%A4%84%E3%80%81%E4%B8%8D%E9%9C%80%E8%A6%81%E5%A3%B0%E6%98%8E%E5%8E%9F%E8%91%97%E4%BD%9C%E6%9D%83%E3%80%81%E4%B8%8D%E7%94%A8%E7%BB%99%E9%92%B1%EF%BC%8C%E4%BD%A0%E8%B5%9A%E4%BA%86%E9%92%B1%E7%9A%84%E8%AF%9D%E9%83%BD%E5%BD%92%E4%BD%A0%E8%87%AA%E5%B7%B1%E3%80%82"
              rel="noopener noreferrer"
              target="_blank"
            >
              素问维护者在读者须知
            </a>
            中的说明标注出处。
          </p>

          <figure className="mb-4 text-center">
            <img alt="auth" className="mx-auto max-h-96 w-full rounded-lg border border-slate-200 object-contain" src={toPublicUrl('assets/imgs/auth.png')} />
            <figcaption className="mt-2 text-xs text-slate-500">往来邮件</figcaption>
          </figure>

          <h3 className="mb-2 text-base font-semibold">"常识题目"部分</h3>
          <p className="mb-4">
            这部分题目来源于网络公开渠道的收集整理。由于来源广泛，本站无法一一追溯并确认其原始版权状态。因此，这部分内容仅供用户进行个人学习和非商业交流使用。
          </p>

          <h3 className="mb-2 text-base font-semibold">侵权处理</h3>
          <p>
            本站尊重并致力于保护知识产权。如果您认为本站的任何内容侵犯了您的合法权益，请通过
            <a className="mx-1 text-blue-600 underline" href="https://github.com/wzj042/sooon-about-dev/issues" rel="noopener noreferrer" target="_blank">
              Github issue
            </a>
            与本站联系。在收到通知并核实后，本站承诺将立即移除相关内容。
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            to={APP_ROUTES.game}
          >
            返回模拟答题
          </Link>
          <Link
            className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
            to={APP_ROUTES.home}
          >
            返回首页
          </Link>
        </div>
      </div>
    </main>
  )
}

