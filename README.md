# 岩瀬酒造 蔵元カードゲーム（仮）

岩瀬酒造（千葉県御宿町、銘柄「岩の井」）の酒造りを、1 人で遊ぶカードゲームです。ハッカソンの題材として作ります。

ルール、カード一覧、画面と技術の方針は [design.md](design.md) にあります。盤面のスクリーンショットもそこにあります。

公開先: https://kenchasonakai.github.io/iwanoi-card-game/ （main に push すると GitHub Actions が公開します）

## 技術

- Phaser 4、Vite、TypeScript、pnpm。Node 24 以上。
- ブラウザだけで動かし、サーバーは持たない。

## コマンド

```sh
pnpm install
pnpm dev          # 開発サーバー。?seed=1 で山札を固定、?sample で 7 ターン目の見本
pnpm typecheck
pnpm build        # dist/ に静的ファイル
pnpm sim          # ルールの数字を自動プレイで確かめる。pnpm sim 500 で回数を変える
pnpm shot         # Playwright で盤面を撮って docs/images/ に保存（端末の Chrome を使う）
```

## ファイル

| 場所 | 中身 |
| --- | --- |
| `design.md` | 設計書 |
| `src/game/` | ルール。Phaser に依存しない。`cards.ts` が札の定義、`state.ts` が状態、`actions.ts` が操作、`sample.ts` が見本の状態 |
| `src/scenes/BoardScene.ts` | 盤面。状態を描くだけ |
| `src/main.ts` | Phaser の起動 |
| `sim/run.ts` | 自動プレイ。`src/game/` をそのまま使う |
| `scripts/shot.ts` | スクリーンショット |
| `docs/images/` | 設計書に貼る画像 |
