# React Battle Sim (Migration)

This is the React migration app for the original `sooon-battle-simulate` static site.

## Stack

- Vite + React + TypeScript
- Tailwind CSS (plus legacy parity CSS)
- Zustand
- Framer Motion
- React Router
- DiceBear (`@dicebear/core`, `@dicebear/collection`)

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Question Bank Auto Split

只需要维护 `public/assets/qb.json`。分片文件与清单可由脚本自动生成：

```bash
npm run qb:split
```

常用命令：

```bash
# 只有 qb.json 发生 git 变更时才执行
npm run qb:split:if-changed

# 适合 pre-commit：变更时自动切片并 git add 生成产物
npm run qb:split:stage
```

Husky `pre-commit` 可直接调用：

```sh
npm --prefix react-app run qb:split:stage
```

## Main Structure

- `src/store/gameStore.ts`: game state/actions and timer lifecycle
- `src/services/questionBank.ts`: question bank loading and shuffle
- `src/services/legacyStorageCompat.ts`: legacy `localStorage` key compatibility
- `src/components/settings/SettingsModal.tsx`: AI settings modal
- `src/components/avatar/AvatarModal.tsx`: avatar picker/import/export
- `src/pages/GamePage.tsx`: page orchestration
- `src/pages/AboutPage.tsx`: route-based About page

## Notes

- Legacy keys are preserved:
  - `aiSpeedMin`
  - `aiSpeedMax`
  - `aiAccuracy`
  - `avatarFixed`
  - `sooon-avatar-data`
  - `sooon-player-avatar-data`
- Development mode exposes `window.debugSettle(mode)`.
