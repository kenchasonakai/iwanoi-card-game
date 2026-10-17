# iwanoi-card-game

岩瀬酒造（岩の井）の酒造りを 1 人で遊ぶカードゲーム。ハッカソンの題材。

## 最初に読む

- [design.md](design.md) 設計書。ルール、カード一覧、画面、技術はすべてこれに従う。数字はすべて仮。
- [README.md](README.md) コマンドとファイルの場所。

## 技術

- Phaser 4、Vite、TypeScript、pnpm。ブラウザだけで動かし、サーバーやログインは使わない。公開は GitHub Pages。
- ルールは `src/game/` に置き、Phaser に依存させない。画面（`src/scenes/`）は状態を描くだけで、状態を変えるのは `actions.ts` の関数だけ。
- `sim/run.ts` は `src/game/` をそのまま使う。ルールを変えたら `pnpm sim` で数字の傾向を見る。
- Phaser 4 の使い方は `node_modules/phaser/skills/` に公式の解説がある（v3 からの変更点も）。

## 守ること

- 変更後は `pnpm typecheck` を通す。画面を変えたら `pnpm shot` で撮り直し、設計書の画像を更新する。
- 点数や売上の計算はルールで決め、生成 AI に任せない。
- 決済も購入も扱わない。購入につながる画面には「20歳未満の者の飲酒は法律で禁止されています」を置く。
- 実在の人の名前は使わない。写真は蔵から提供されたものだけ使う。
