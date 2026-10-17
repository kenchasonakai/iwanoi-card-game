// タイトル画面。「はじめる」と「ルールを読む」だけを置く。
// URL に ?seed や ?sample があれば盤面へ、?rules があればルール説明へすぐ進む（確認と撮影のため）。

import Phaser from "phaser";
import { Draw } from "../ui/draw.ts";
import { drawSakeLabel } from "../ui/cards.ts";
import { C, DPR, F, H, S, T, W } from "../ui/theme.ts";

export class TitleScene extends Phaser.Scene {
  constructor() { super("title"); }

  create() {
    const q = new URLSearchParams(location.search);
    if (q.has("seed") || q.has("sample")) { this.scene.start("board"); return; }
    if (q.has("rules")) { this.scene.start("rules", { from: "title", page: Math.max(0, Number(q.get("rules") || 1) - 1) }); return; }

    this.scale.refresh(); // 読み込み直後のタップの位置がずれないように、画面の大きさを測り直す
    this.cameras.main.setZoom(DPR).centerOn(W / 2, H / 2);
    const layer = this.add.container(0, 0);
    const d = new Draw(this, layer);
    this.drawBackground(d);

    // 札を扇に広げる
    const labels = [
      { id: "karakuchi" as const, x: 830, rot: -12 },
      { id: "koshu20" as const, x: 1060, rot: 12 },
      { id: "gohyaku" as const, x: 945, rot: 0 },
    ];
    labels.forEach((l, i) => {
      const { c, d: e } = d.group(l.x, 360);
      drawSakeLabel(e, -85, -180, 170, 360, l.id);
      c.setAngle(l.rot).setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, y: 350, duration: 700, delay: 200 + i * 150, ease: "Cubic.easeOut" });
      this.tweens.add({ targets: c, y: 340, duration: 2400 + i * 300, delay: 900 + i * 150, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    });

    d.text(92, 120, "岩瀬酒造（千葉県御宿町）× ハッカソン 試作", S.body, { color: T.chalkDim });
    const title = d.text(86, 156, "蔵元カードゲーム", 72, { font: F.brush, color: T.washi });
    d.text(92, 268, "岩の井の酒を造って売る、1人用のカードゲーム。", 22, { color: T.chalk });
    d.text(92, 304, "20ターンで、どれだけ蔵を盛り立てられるか。", 22, { color: T.chalk });
    title.setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 800, ease: "Sine.easeOut" });

    d.button(92, 380, 340, 80, "はじめる", () => this.scene.start("board", { seed: Math.floor(Math.random() * 100000) }), { primary: true, size: 30 });
    d.button(92, 480, 340, 62, "ルールを読む", () => this.scene.start("rules", { from: "title", page: 0 }), { size: S.title, sub: "はじめての人はこちら（1分）" });

    d.text(92, H - 44, "試作版です。数字はすべて仮です。ゲームの中では購入や決済は扱いません。20歳未満の者の飲酒は法律で禁止されています。", S.small, { color: T.chalkDim });

    // 書体の一部が後から届いたら描き直す
    const redraw = () => this.scene.restart();
    document.fonts.addEventListener("loadingdone", redraw);
    this.events.once("shutdown", () => document.fonts.removeEventListener("loadingdone", redraw));
    (window as unknown as Record<string, unknown>)["__ready"] = true;
  }

  private drawBackground(d: Draw) {
    const g = d.graphics();
    g.fillStyle(C.bg, 1).fillRect(-200, -200, W + 400, H + 400);
    // 月
    g.fillStyle(C.kin, 0.06).fillCircle(950, 300, 300);
    g.fillStyle(C.kin, 0.05).fillCircle(950, 300, 220);
    // 御宿の海の波
    for (let k = 0; k < 5; k++) {
      g.lineStyle(2, C.kin, 0.18 - k * 0.025);
      g.beginPath();
      for (let x = -20; x <= W + 20; x += 8) {
        const y = 600 + k * 22 + Math.sin(x / 70 + k * 1.3) * 8;
        if (x === -20) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokePath();
    }
  }
}
