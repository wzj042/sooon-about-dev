# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

素问抢答对战模拟器 - 一个纯前端单页应用，提供抢答对战练习工具。用户与AI对手进行答题对战，支持自定义头像和对手配置。

## 开发命令

### 本地运行
```bash
# 无需构建，直接在浏览器中打开
# Windows
start index.html

# 或使用简单的 HTTP 服务器
python -m http.server 8000
# 然后访问 http://localhost:8000
```

### 题库处理脚本
```bash
# 合并多个 JSON 题库文件
python script/merge_json.py

# 使用 DeepSeek API 对题目进行分类（需要配置 API_KEY）
python script/classify.py
```

## 架构设计

### 核心模式：观察者模式 + 单一数据源

项目采用状态驱动的架构，所有UI更新都通过状态订阅机制触发：

```
GameStateManager (状态中心)
    ↓ 订阅/发布
UIController (DOM操作)
    ↓ 协调
AnimationManager (动画效果)
```

### 模块职责

| 模块 | 文件 | 职责 |
|------|------|------|
| 状态管理 | `game-state-manager.js` | 单一数据源，管理分数、轮次、题目、计时器等所有状态 |
| UI控制 | `ui-controller.js` | DOM操作、事件处理、状态订阅与UI更新 |
| 动画管理 | `animation-manager.js` | 统一管理所有动画效果和时序 |
| 头像生成 | `avatar-generator.js` | 使用 DiceBear CDN 动态生成头像 |
| 头像选择 | `avatar-selector.js` | 头像选择模态框功能 |

### 游戏流程状态机

```
ready → question → waiting → result → [循环或] → ended
```

- `ready`: 准备阶段
- `question`: 题目展示与答题阶段
- `waiting`: 等待双方选择完成
- `result`: 显示本轮结果
- `ended`: 游戏结束

## 题库数据格式

题库存储在 `assets/qb.json`，格式如下：

```json
{
  "题目文本": {
    "question": "题目文本",
    "options": ["选项1", "选项2", "选项3", "选项4"],
    "answer": "正确答案文本",
    "type": "sooon_ai"  // 或 "common_sense"
  }
}
```

- `sooon_ai`: 伦理观念类题目
- `common_sense`: 百科常识类题目

## 对手AI配置

通过 `state.state.opponent.ai` 配置对手行为：

```javascript
opponent: {
  avatar: '',           // 对手头像（字符/emoji/图片URL）
  avatarFixed: false,   // 是否固定头像
  ai: {
    accuracy: 0.7,              // 预估正确率 (0-1)
    speedMsRange: [2000, 5000]  // 作答速度区间 [毫秒]
  }
}
```

## 关键文件依赖顺序

HTML 中的脚本加载顺序严格：
```html
<script src="avatar-generator.js"></script>
<script src="avatar-selector.js"></script>
<script src="game-state-manager.js"></script>
<script src="animation-manager.js"></script>
<script src="ui-controller.js"></script>
```

修改时需注意模块依赖关系。

## 响应式设计

- 基础尺寸：420px × 800px
- 使用 CSS 变量 `--scale-factor` 实现整体缩放
- 所有尺寸和间距使用 CSS 变量定义（见 `style.css` 顶层）

## 音箱播报

任务完成后自动播报状态。

| 任务 | 播报内容 |
|------|----------|
| 构建/测试/部署/询问用户 | "代码编译完成" / "测试执行完成" / "应用部署完成" / ... |
| 失败 | "任务执行失败" |

**触发条件**: 耗时 > 30s，或 `build/test/deploy/git push` 等命令。
**MCP 工具**: `mcp__xiaoi__notify({ message: "..." })`

> 消息 <= 20 字，间隔 >= 10 秒。
