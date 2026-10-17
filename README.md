# 岩瀬酒造 蔵元カードゲーム（仮）

岩瀬酒造（千葉県御宿町、銘柄「岩の井」）の酒造りを、1 人で遊ぶカードゲームです。ハッカソンの題材として作ります。

ルール、カード一覧、画面と技術の方針は [design.md](design.md) にあります。冒頭に画面のスクリーンショットと動きの GIF があります。

公開先: https://kenchasonakai.github.io/iwanoi-card-game/ （main に push すると GitHub Actions が公開します）

## 技術

- Phaser 4、Vite、TypeScript、pnpm。Node 24 以上。
- ブラウザだけで動かし、サーバーは持たない。

## コマンド

```sh
pnpm install
pnpm dev          # 開発サーバー。タイトルから始まる
                  #   ?seed=19 で山札を固定して盤面から、?sample で7ターン目の見本、
                  #   ?sample=ship / discard / end / bankrupt で決まった場面、?rules=3 でルールの3ページ目
pnpm typecheck
pnpm build        # dist/ に静的ファイル
pnpm sim          # ルールの数字を自動プレイで確かめる。pnpm sim 500 で回数を変える
pnpm shot         # ビルドして、Playwright で全場面を撮り docs/images/ に保存（端末の Chrome を使う）
pnpm shot --only flow   # 名前に flow を含む場面だけ撮る
```

## ファイル

| 場所 | 中身 |
| --- | --- |
| `design.md` | 設計書。冒頭に、画面のスクリーンショットと動きの GIF |
| `docs/fact-check.md` | 商品名、酒米、受賞歴を確かめた記録 |
| `docs/images/` | 設計書に貼る画像。`pnpm shot` で撮り直す |
| `src/game/` | ルール。Phaser に依存しない。`cards.ts` 札の定義、`state.ts` 状態、`actions.ts` 操作、`sample.ts` 見本の場面 |
| `src/scenes/` | 場面。`TitleScene` タイトル、`BoardScene` 盤面、`RulesScene` ルール説明 |
| `src/ui/` | 描く部品。`theme.ts` 色と書体と文字の大きさ、`draw.ts` 札や駒やボタン、`cards.ts` 酒の札、`wrap.ts` 日本語の折り返し |
| `src/main.ts` | 書体を読み込んでから Phaser を起動する |
| `sim/run.ts` | 自動プレイ。`src/game/` をそのまま使う |
| `scripts/shot.ts` | スクリーンショットと GIF |
