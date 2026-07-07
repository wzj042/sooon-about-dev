# 队列练习"上一题/下一题"导航设计文档

## 需求更新

- 在队列练习页面顶部掌握状态卡片左右两侧增加导航按钮。
- 支持在**已练习部分**前后移动浏览/重做题目。
- 保持在最前缘时可继续进入下一道新题。
- **单次会话内同一道题不重复计分**。

## 1. 当前代码流程梳理

### 1.1 启动与队列加载

```
QueuePracticePage.tsx bootstrap()
  ├── consumePracticeQueue()          # 从 localStorage 读取待刷队列（首次进入）
  │   └── 读取 sooon-practice-queue
  ├── loadLastPracticeQueueSession()  # 或从 resumeQueue=1 恢复会话
  │   └── 读取 sooon-last-practice-queue-session
  ├── setPracticeQueue(questions, initialPracticedCount)
  └── startNewGame()
```

### 1.2 Store 内部队列状态（gameStore.ts）

| 变量 | 类型 | 含义 |
|------|------|------|
| `practiceQueueQuestions` | `QuestionItem[]` | 完整队列（闭包变量） |
| `practiceQueueCursor` | `number` | 当前队列起始指针（闭包变量） |
| `practiceQueueProgress` | `number` | 已持久化的 practicedCount（闭包变量） |
| `practiceQueueTotal` | `number` | 队列总长度（React state） |
| `practiceQueuePracticed` | `number` | 当前会话已练习数（React state） |
| `practiceQueueAutoNextDelayMs` | `number` | 自动切题延迟（闭包变量） |
| `practiceQueueManualNextOnWrong` | `boolean` | 答错手动切题（闭包变量） |

当前会话已练习数计算公式：

```ts
const queuePracticedInSession = state.practiceQueueMode ? practiceQueueProgress + state.currentRound : 0
```

### 1.3 题目展示流程

```
startNewGame()
  ├── ensureQuestionsPrepared(totalRounds)
  │   └── selectedQuestions = rotateByCursor(practiceQueueQuestions, practiceQueueCursor)
  │   └── totalRounds = practiceQueueQuestions.length
  ├── startRoundInternal(1)
  │   └── questionData = buildRoundQuestion(selectedQuestions[round - 1])
```

### 1.4 答题与进度推进

```
selectAnswer() / 时间到
  └── showResultsInternal()
      ├── recordQuestionAttempt()          # 记录本题答题统计
      ├── gamePhase = 'result'
      └── practiceQueuePracticed = practiceQueueProgress + currentRound

QueuePracticePage.tsx effect
  └── 当 gamePhase === 'result' 时
      └── advanceLastPracticeQueueProgress(1)
          └── localStorage: cursor++, practicedCount++

nextRound() / endGame()
  └── startRoundInternal(round + 1) 或 endGame()

startNewGame()（下一次）
  └── 根据 practiceQueuePracticed 推进 practiceQueueCursor
```

### 1.5 关键文件

- `src/pages/QueuePracticePage.tsx`：页面组件、进度显示、设置弹窗
- `src/services/practiceQueue.ts`：队列存储、会话持久化、cursor/practicedCount 管理
- `src/store/gameStore.ts`：游戏状态机、队列状态、答题流程
- `src/domain/types.ts`：`GameStore` / `GameActions` 类型定义

---

## 2. 推荐方案：基于队列游标的单题浏览模式

### 2.1 核心思路

将队列练习从"一局多 round"改为**一次只展示一道题**，通过 `practiceQueueCursor` 在队列中前后移动：

- `practiceQueueCursor`：当前正在看/做的题目在队列中的索引。
- `practiceQueuePracticed`：已经练习过的最远位置（数量）。
- `practiceQueueScoredHashes`：会话级已计分题目 hash 集合，保证不重复计分。
- 顶部掌握卡片左右两侧放置 `<` / `>` 按钮，用于在已练习范围内前后移动。
- 当位于最前缘（`cursor === practicedCount - 1`）时，"下一题"继续进入新题。

### 2.2 状态定义

```ts
let practiceQueueQuestions: QuestionItem[] = []
let practiceQueueCursor = 0          // 当前题目索引
let practiceQueuePracticedCount = 0  // 已练习题目数（最远前缘）
let practiceQueueScoredHashes = new Set<string>() // 已计分题目
```

React state：

```ts
practiceQueueTotal: number           // 队列总长度
practiceQueuePracticed: number       // 已练习题目数（与闭包同步）
currentRound: 1                       // 队列模式下始终为 1
totalRounds: 1                        // 队列模式下始终为 1
```

### 2.3 初始化

```ts
setPracticeQueue(questions, practicedCount = 0)
  practiceQueueQuestions = questions
  practiceQueueCursor = 0
  practiceQueuePracticedCount = Math.min(practicedCount, questions.length)
  practiceQueueScoredHashes.clear()
  set({
    totalRounds: 1,
    practiceQueueMode: true,
    practiceQueueTotal: questions.length,
    practiceQueuePracticed: practiceQueuePracticedCount,
  })
```

### 2.4 题目加载

```ts
startRoundInternal(1)
  ensureQuestionsPrepared(1)
    selectedQuestions = [practiceQueueQuestions[practiceQueueCursor]]
```

### 2.5 导航操作

#### 上一题

```ts
previousPracticeQueueQuestion()
  // 只能在已练习范围内回退
  if (practiceQueueCursor <= 0) return
  const prevCursor = practiceQueueCursor - 1
  if (prevCursor >= practiceQueuePracticedCount) return // 安全校验

  // 若当前题已计分，撤销计分（因为离开本题回到上一题）
  maybeUndoScoreCurrentQuestion()

  practiceQueueCursor = prevCursor
  saveCursorAndPracticedCount()
  resetRoundState()
  startRoundInternal(1)
```

#### 下一题

```ts
nextPracticeQueueQuestion()
  const nextCursor = practiceQueueCursor + 1
  if (nextCursor >= practiceQueueQuestions.length) {
    // 已到队列末尾，结束练习
    endGame()
    return
  }

  // 若当前题已计分，保留；若未计分（用户在 question 阶段直接跳过），可选择计分或提示
  maybeScoreCurrentQuestionIfNeeded()

  practiceQueueCursor = nextCursor
  if (practiceQueueCursor >= practiceQueuePracticedCount) {
    practiceQueuePracticedCount = practiceQueueCursor + 1
  }
  saveCursorAndPracticedCount()
  resetRoundState()
  startRoundInternal(1)
```

### 2.6 答题与计分

```ts
showResultsInternal()
  // ... 记录答题统计 ...

  if (practiceQueueMode && currentQuestion) {
    const hash = buildQuestionHash(currentQuestion)
    if (!practiceQueueScoredHashes.has(hash)) {
      practiceQueueScoredHashes.add(hash)
      practiceQueuePracticedCount = Math.max(practiceQueuePracticedCount, practiceQueueCursor + 1)
      // 不在这里直接增加 practicedCount，而是在导航离开时统一保存
    }
  }
```

> 注：为了避免重复计分，`practicedCount` 的增量逻辑从"进入 result 即 +1"改为"首次计分该题时 +1"。

### 2.7 持久化策略

在以下时机保存 cursor 和 practicedCount 到 `sooon-last-practice-queue-session`：

- 导航切换题目时
- 答题进入 result 且题目首次计分时
- 组件卸载时

使用 `updateLastPracticeQueueSessionCounts(total, cursor, practicedCount)` 统一更新。

### 2.8 进度显示

页面顶部进度改为：

```
当前第 {practiceQueueCursor + 1} / {practiceQueueTotal} 题
已练习 {practiceQueuePracticedCount} | 剩余 {practiceQueueTotal - practiceQueuePracticedCount}
```

---

## 3. UI 交互设计

### 3.1 按钮位置

在顶部掌握状态卡片（`.queue-practice-status`）左右两侧各放一个圆形/方形按钮：

```tsx
<div className="queue-practice-status">
  <button
    className="queue-nav-button"
    disabled={practiceQueueCursor <= 0}
    onClick={previousPracticeQueueQuestion}
  >
    ←
  </button>

  <div className="queue-practice-status-card">
    {/* 掌握状态、计时器、阈值 */}
  </div>

  <button
    className="queue-nav-button"
    disabled={practiceQueueCursor >= practiceQueueTotal - 1}
    onClick={nextPracticeQueueQuestion}
  >
    →
  </button>
</div>
```

### 3.2 按钮状态

- **左按钮禁用**：`practiceQueueCursor === 0`（已到队列第一题）。
- **右按钮禁用**：`practiceQueueCursor === practiceQueueTotal - 1`（已到队列最后一题）。
- 如果当前题未作答就点击"下一题"，可以选择：
  - 直接跳过（不计分，仅移动 cursor）。
  - 弹窗提示"本题尚未作答，确认跳过？"。

**推荐**：直接跳过但**不计分**，避免打断练习节奏。

### 3.3 自动切题行为

- 答对/答错后经过 `autoNextDelayMs` 自动调用 `nextPracticeQueueQuestion()`。
- 答错且开启"手动切题"时，显示"下一题"按钮（位于底部浮动区或卡片右侧）。

---

## 4. 需要修改的文件

### 4.1 `src/store/gameStore.ts`

- 新增 `practiceQueueScoredHashes` 闭包变量。
- 修改 `setPracticeQueue()`：初始化 `practiceQueueCursor` 和 `practicedCount`。
- 修改 `ensureQuestionsPrepared()`：队列模式下只加载当前 cursor 指向的题目。
- 修改 `startNewGameInternal()`：队列模式下 `totalRounds = 1`，不再按 round 推进 cursor。
- 修改 `showResultsInternal()`：使用集合去重计分。
- 新增 `previousPracticeQueueQuestion()` action。
- 新增 `nextPracticeQueueQuestion()` action（替代 `nextRound()` 在队列模式下的作用）。
- 修改 `continuePracticeQueueAfterReview()`：调用 `nextPracticeQueueQuestion()`。
- 修改 `reset()` / `destroy()`：清空 `practiceQueueScoredHashes`。

### 4.2 `src/services/practiceQueue.ts`

- 新增 `setLastPracticeQueueCursor(cursor: number)` 方法（仅更新 cursor，不修改 practicedCount）。
- 复用 `updateLastPracticeQueueSessionCounts(total, cursor, practicedCount)` 统一更新。
- 可选：新增 `loadLastPracticeQueueSession()` 恢复时读取 `scoredHashes`（若需持久化去重集合）。

### 4.3 `src/domain/types.ts`

- 在 `GameActions` 中新增：
  - `previousPracticeQueueQuestion(): void`
  - `nextPracticeQueueQuestion(): void`

### 4.4 `src/pages/QueuePracticePage.tsx`

- 从 store 取出新的导航 action。
- 调整进度显示：当前第 N / 总 M 题。
- 在掌握状态卡片两侧增加 `<` / `>` 按钮。
- 移除或调整 `advanceLastPracticeQueueProgress(1)` effect，改为由 Store 统一持久化。
- 底部浮动区按钮文案调整：
  - 答错手动切题时显示"下一题"。

### 4.5 样式文件

- `src/styles/` 中增加 `.queue-practice-status` 水平布局样式，容纳左右按钮和中间卡片。

---

## 5. 边界情况

| 场景 | 处理 |
|------|------|
| 第一题点击"上一题" | 禁用按钮或 no-op |
| 最后一题点击"下一题" | 结束练习或禁用按钮 |
| 回退到已练习题并重做 | 不重复计分（集合去重） |
| 未作答直接下一题 | 跳过，不计分，cursor 前进 |
| 自动切题时 | 调用 `nextPracticeQueueQuestion()` |
| 答错手动切题时 | 显示"下一题"按钮，点击后前进 |
| 会话刷新后 | `practiceQueueScoredHashes` 丢失，可持久化到 sessionStorage 以保持去重 |
| 队列长度为 1 | 两个导航按钮均禁用 |

---

## 6. 数据流示意

```
用户点击 ← / →
  │
  ▼
previousPracticeQueueQuestion() / nextPracticeQueueQuestion()
  │
  ├── 调整 practiceQueueCursor
  ├── 更新 practiceQueuePracticedCount（仅前进到新题时）
  ├── 持久化 cursor + practicedCount 到 localStorage
  ├── 重置当前 round 状态
  └── startRoundInternal(1) 加载新题目
  │
  ▼
用户作答
  │
  ▼
showResultsInternal()
  │
  ├── recordQuestionAttempt()
  ├── 若题目未计分：加入 scoredHashes，更新 practicedCount
  └── 触发自动/手动切题
  │
  ▼
nextPracticeQueueQuestion() 或 用户点击下一题
```

---

## 7. 建议实现顺序

1. **Store 层**：调整队列模式为单题模式，新增导航 action 和去重集合。
2. **Service 层**：完善 cursor/practicedCount 持久化方法。
3. **Type 层**：更新 `GameActions`。
4. **Page 层**：修改 UI、进度显示、绑定按钮。
5. **测试**：补充 store 测试，覆盖导航、去重、边界、持久化。
