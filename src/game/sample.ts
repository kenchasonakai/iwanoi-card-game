// 7 ターン目の見本。設計書のスクリーンショットと、画面の確認に使う。
// URL に ?sample をつけると、この状態から始まる。

import { EVENTS } from "./cards.ts";
import { newGame, type GameState } from "./state.ts";

export function sampleGame(): GameState {
  const s = newGame(7);
  s.turn = 7;
  s.money = 23;
  s.hand = [
    { id: 901, material: "山田錦", bought: false },
    { id: 902, material: "麹", bought: false },
    { id: 903, material: "酵母", bought: false },
    { id: 904, material: "総の舞", bought: true },
  ];
  const pick = (role: string) => {
    const i = s.recruitDeck.findIndex((r) => r.role === role);
    return s.recruitDeck.splice(i, 1)[0]!;
  };
  s.field = [pick("蔵守"), pick("蔵人"), pick("船頭")];
  const moto = pick("酛屋");
  s.workers.push({ ...moto, hiredTurn: 3, placedOn: null });
  s.workers.push({ ...pick("蔵人"), hiredTurn: 5, placedOn: null });
  s.brews = [
    { sake: "karakuchi", filled: 2 },
    { sake: "fusa", filled: 0 },
    { sake: "koshu20", filled: 3 },
  ];
  s.workers[0]!.placedOn = "koshu20";
  s.workers[2]!.placedOn = "karakuchi";
  s.shipped = { gohyaku: 2, fusa: 1 };
  s.event = EVENTS.find((e) => e.id === "kanzake")!;
  s.buff = { ...s.event.buff! };
  s.riceUpTurns = 2;
  s.message = "燗酒コンテストで金賞。次に出荷する山廃の酒が1.5倍になります。";
  s.buysLeft = 1;
  return s;
}
