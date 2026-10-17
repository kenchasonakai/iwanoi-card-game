import "@fontsource/zen-kaku-gothic-new/400.css";
import "@fontsource/zen-kaku-gothic-new/700.css";
import "@fontsource/shippori-mincho-b1/700.css";
import "@fontsource/yuji-syuku/400.css";
import Phaser from "phaser";
import { EVENTS, RECRUITS, ROLES, SAKES } from "./game/cards.ts";
import { BoardScene } from "./scenes/BoardScene.ts";
import { RulesScene } from "./scenes/RulesScene.ts";
import { TitleScene } from "./scenes/TitleScene.ts";
import { DPR, H, W } from "./ui/theme.ts";

// 日本語の書体は文字の範囲ごとに分かれて届くので、ゲームで使う文字を先に読み込んでから描き始める
const UI_TEXT = "どんなゲーム？盤面の見方流れ札人を雇って置くとお金はじめのコツタイトルへ戻る前へ次へ読む御宿町岩の井盛り立て試作版仮購入決済歳未満飲酒法律禁止岩瀬酒造蔵元カードゲーム遊び方ターン次の給料両イベント酒の場自分の蔵仕込み中空き求人の場入替済み雇っている人置ける手札山札捨て枚多い取引先無料あと出荷もう一度造った種類結果をコピー見るショップ直送廃業ランク続ける閉じるはじめる本当にやめる売上合計所持金必要な素材足りない得意特徴今出すと回目まで済み契約金毎ターン雇う0123456789/+−×%・（）「」、。";
const DATA_TEXT = JSON.stringify([SAKES, RECRUITS, EVENTS, ROLES]);
const FONTS = ['400 16px "Zen Kaku Gothic New"', '700 16px "Zen Kaku Gothic New"', '700 16px "Shippori Mincho B1"', '400 16px "Yuji Syuku"'];

async function loadFonts() {
  const text = [...new Set(UI_TEXT + DATA_TEXT)].join("");
  const all = Promise.all(FONTS.map((f) => document.fonts.load(f, text)));
  await Promise.race([all, new Promise((r) => setTimeout(r, 4000))]);
}

await loadFonts();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#15171b",
  // 盤面は 1280×720 で設計し、高解像度の画面でにじまないように DPR 倍で描いてカメラで拡大する
  width: W * DPR,
  height: H * DPR,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // 動きは実時間で進める。ならしがあると、描くのが遅い端末で演出やタイマーが遅れる
  fps: { smoothStep: false },
  // 最初の場面がタイトル。ルール説明は盤面の上に重ねても開くので、盤面より後に置く
  scene: [TitleScene, BoardScene, RulesScene],
});
