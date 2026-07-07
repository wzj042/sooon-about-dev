# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

素问抢答对战模拟器 —— 与 AI 对手进行答题对战的纯前端练习工具。仓库包含**两套并存的实现**，理解这点至关重要：

- **`react-app/`（当前主要开发目标）**：React 19 + TypeScript + Vite + Zustand + Tailwind 重构版。这是实际部署的版本，`vite build` 产物输出到仓库根的 `dist/`。
- **仓库根的原生 JS 版（遗留）**：`index.html` + `*-manager.js` / `*-controller.js` + `style.css`，无需构建直接在浏览器打开。React 版重构自它，现以 React 版为准，遗留版仅作参考保留。

> 新功能与修改默认在 `react-app/` 进行，除非明确要改遗留版。

## 仓库结构

| 路径 | 说明 |
|------|------|
| `react-app/` | React 重构版（活跃开发）|
| `dist/` | React 构建产物（**git 忽略**，部署目标，base 路径 `/app/sooon-battle-simulate/dist/`）|
| `index.html` `*.js` `style.css` `about.html` | 遗留原生版 |
| `react-app/public/assets/qb.json` | **真正的题库数据源**（React 版）|
| `assets/qb.json` | 遗留版题库源文件 |
| `script/` | 题库处理 Python 脚本 + 油猴抓取脚本 |

## 开发命令

> 包管理器统一用 **pnpm**。所有 React 命令在 `react-app/` 目录下执行。

### React 应用（react-app/）
```bash
pnpm install
pnpm dev            # Vite 开发服务器（BrowserRouter 模式）
pnpm build          # 完整构建：qb:split → tsc -b → vite build（产物到 ../dist）
pnpm preview        # 预览构建产物
pnpm lint           # ESLint
pnpm test           # Vitest 全量（= pnpm exec vitest run）
pnpm exec vitest run src/store/gameStore.test.ts   # 运行单个测试文件
pnpm exec vitest                                   # watch 模式
```

### 题库分页（build 的前置步骤）
```bash
pnpm qb:split             # 将 public/assets/qb.json 切分为 qb-pages/ + manifest
pnpm qb:split:if-changed  # 仅当 qb.json 在 git 中变更时才执行
pnpm qb:split:stage       # if-changed 基础上再 git add 分页产物（供提交钩子）
```

### 遗留原生版（仓库根）
```bash
start index.html              # Windows 直接打开
python -m http.server 8000    # 或起静态服务器，访问 http://localhost:8000
```

### 题库处理脚本（script/）
```bash
python script/merge_json.py   # 合并多个 JSON 题库
python script/classify.py     # 用 DeepSeek API 分类（需配置 API_KEY）
```

## React 应用架构

### 分层（依赖单向向下）

```
pages/ + components/   UI 层（React 组件，经 Zustand selector 订阅状态）
        ↓
store/gameStore.ts     Zustand 单一 store，编排游戏流程、计时器、动画状态
        ↓
services/              IO 与副作用：题库加载/缓存、持久化、统计、头像、数据导入导出
        ↓
domain/                纯逻辑与类型：types / phaseMachine / scoring / validation / avatar（无副作用）
```

- `domain/` 全是纯函数与类型，可独立测试，不碰 DOM/存储。
- `services/` 封装所有外部交互（fetch、localStorage、IndexedDB、DiceBear）。
- `store/gameStore.ts` 是游戏运行时核心，对应遗留版的 `GameStateManager`；`store/timers.ts` 用 `TimerRegistry` 统一管理定时器；派生选择器在 `store/selectors.ts`。

### 游戏状态机

沿用遗留版的 5 阶段流转（`domain/phaseMachine.ts` 定义顺序）：
```
ready → question → waiting → result → [循环] → ended
```

### 路由与部署

- 路由表见 `app/router.tsx`：`/`(home)、`/game`、`/queue-practice`、`/question-bank`、`/about`；路径常量集中在 `app/paths.ts`。
- **生产环境用 HashRouter**（除非 `VITE_ROUTER_MODE=browser`），开发环境用 BrowserRouter + basename。这是为适配部署在子路径 `/app/sooon-battle-simulate/dist/` 下（见 `vite.config.ts` 的 `base`）。

### 题库数据流水线

题库体积大（约 4600+ 题），采用分页 + 增量缓存：

```
public/assets/qb.json                         源（object：{ 题目文本: {...} }，git 跟踪）
        │  scripts/split-qb.mjs（pnpm qb:split，pageSize=240）
        ▼
public/assets/qb-pages/qb.page.NNN.json  +  qb.manifest.json   （均 git 忽略，构建时再生）
        │  services/questionBank.ts 按 manifest 增量 fetch
        ▼
浏览器 IndexedDB 缓存（按 manifest / 分页 hash 做增量同步）
```

- `qb:split` 是 `pnpm build` 第一步；改题库只改 `qb.json`，分页文件与 manifest **不要手动编辑**。
- 题库缓存在 **IndexedDB**；用户配置/设置在 **localStorage**。
- `services/legacyStorageCompat.ts` 复用遗留版的 localStorage key（如 `aiAccuracy`、`sooon-avatar-data`），使新旧版本设置互通。

### 题目选择与练习模式

- `domain/types.ts` 的 `QuestionSelectionStrategy` 定义 8 种选题策略（全部 / 未做优先 / 错题 / 慢思考 / 仅常识 / 仅伦理 / 未掌握 / 已掌握），逻辑在 `services/questionSelection.ts`。
- `services/questionStats.ts` 维护每题作答统计与掌握度，`isCommonSenseType` / `isEthicsType` 按 `type` 字段分类（`"常识"` = 常识题，其余视为素问/伦理题）。
- **练习队列模式**（`services/practiceQueue.ts`，对应 `/queue-practice` 页）：连续刷题模式，区别于对战模式，有独立的「自动进入下一题 / 答错手动确认」等设置。

## 数据模型

运行时题目统一规整为 `QuestionItem`（`domain/types.ts`）：
```typescript
interface QuestionItem {
  question: string
  options: string[]
  answer: number      // 正确选项的【索引】，非答案文本
  type?: string       // "常识" = 常识题；其余为素问/伦理题
  deleted?: boolean
  sourceId?: string
  updatedAt?: string
}
```
源 `qb.json` 以题目文本为 key、`answer` 为数字索引；`split-qb.mjs` 与 `questionBank.ts` 负责规整并兼容遗留的文本答案格式。

对手 AI 配置（`OpponentState`）：
```typescript
opponent: {
  avatar: string
  avatarFixed: boolean
  ai: { accuracy: number; speedMsRange: [number, number] }  // 正确率 0-1；作答速度区间(ms)
}
```

## 测试约定

- Vitest，测试文件与源码同目录（`*.test.ts`），主要覆盖 `services/` 与 `store/`（纯逻辑层），UI 组件无快照测试。
- 无全局 vitest 配置：需要 DOM 的测试在文件顶部用 `// @vitest-environment jsdom` 注解开启 jsdom 环境。

## 遗留原生版架构（仅在需要改旧版时参考）

状态驱动 + 观察者模式：`GameStateManager`（状态中心）→ `UIController`（DOM 操作）→ `AnimationManager`（动画）。`index.html` 中脚本加载顺序严格：`avatar-generator` → `avatar-selector` → `game-state-manager` → `animation-manager` → `ui-controller`。响应式基于 420×800 基准与 CSS 变量 `--scale-factor`。

## 音箱播报

任务完成后自动播报状态。

| 任务 | 播报内容 |
|------|----------|
| 构建/测试/部署/询问用户 | "代码编译完成" / "测试执行完成" / "应用部署完成" / ... |
| 失败 | "任务执行失败" |

**触发条件**: 耗时 > 30s，或 `build/test/deploy/git push` 等命令。
**MCP 工具**: `mcp__xiaoi__notify({ message: "..." })`

> 消息 <= 20 字，间隔 >= 10 秒。
