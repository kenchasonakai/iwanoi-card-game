import Phaser from "phaser";
import { BoardScene, DPR, H, W } from "./scenes/BoardScene.ts";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#1c1e22",
  // 盤面は 1280×720 で設計し、高解像度の画面でにじまないように DPR 倍で描いてカメラで拡大する
  width: W * DPR,
  height: H * DPR,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BoardScene],
});
