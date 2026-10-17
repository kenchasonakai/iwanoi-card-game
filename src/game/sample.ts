// 見本の状態。設計書のスクリーンショットと、画面の確認に使う。
// URL に ?sample をつけると 7 ターン目の見本、?sample=ship などで別の場面から始まる。

import { EVENTS, type EventId, type Role } from "./cards.ts";
import { newGame, type GameState } from "./state.ts";

export type SampleName = "mid" | "ship" | "discard" | "end" | "bankrupt" | "select";

export const SAMPLE_NAMES: readonly SampleName[] = ["mid", "ship", "discard", "end", "bankrupt", "select"];

function base(): GameState {
  const s = newGame(7);
  s.turn = 7;
  s.money = 23;
  s.hand = [
    { id: 901, material: "山田錦", bought: false },
    { id: 902, material: "麹", bought: false },
    { id: 903, material: "酵母", bought: false },
    { id: 904, material: "総の舞", bought: true },
  ];
  s.field = [pick(s, "蔵守"), pick(s, "蔵人"), pick(s, "船頭")];
  s.workers.push({ ...pick(s, "酛屋"), hiredTurn: 3, placedOn: null });
  s.workers.push({ ...pick(s, "蔵人"), hiredTurn: 5, placedOn: null });
  s.brews = [
    { sake: "karakuchi", filled: 2 },
    { sake: "fusa", filled: 0 },
    { sake: "koshu20", filled: 3 },
  ];
  s.workers[0]!.placedOn = "koshu20";
  s.workers[2]!.placedOn = "karakuchi";
  s.shipped = { gohyaku: 2, fusa: 1 };
  setEvent(s, "kanzake");
  s.buff = { ...s.event!.buff! };
  s.riceUpTurns = 2;
  s.message = "燗酒コンテストで金賞。次に出荷する山廃の酒が1.5倍になります。";
  s.buysLeft = 1;
  return s;
}

function pick(s: GameState, role: Role) {
  const i = s.recruitDeck.findIndex((r) => r.role === role);
  return s.recruitDeck.splice(i, 1)[0]!;
}

function setEvent(s: GameState, id: EventId) {
  s.event = EVENTS.find((e) => e.id === id)!;
}

export function sampleGame(name: SampleName = "mid"): GameState {
  const s = base();
  switch (name) {
    case "mid":
      break;
    case "select":
      // 人をタップして選んだところ（画面で選ぶので状態は mid と同じ）
      break;
    case "ship":
      // 山廃純米辛口があと 2 マス。酛屋を置いてあるので「仕込む」で出荷できる
      s.workers[1]!.placedOn = "fusa";
      s.workers[3]!.placedOn = "fusa";
      s.message = "酛屋は山廃で2マス、蔵人は1マス。「仕込む」で2本出荷できます。";
      break;
    case "discard":
      s.hand.push({ id: 905, material: "五百万石", bought: false }, { id: 906, material: "麹", bought: false }, { id: 907, material: "愛山", bought: false });
      s.phase = "discard";
      s.brews = s.brews.filter((b) => b.sake !== "karakuchi");
      s.workers[2]!.placedOn = null;
      s.message = "出荷が済みました。手札が5枚を超えているので、捨てる札を選んでください。";
      break;
    case "end":
      s.turn = 20;
      s.money = 152;
      s.phase = "shipped";
      s.shipped = { gohyaku: 3, fusa: 2, aiyama: 1, karakuchi: 3, yamahai240: 1, koshu20: 1, heiwa: 1 };
      setEvent(s, "visit");
      s.buff = null;
      s.riceUpTurns = 0;
      s.message = "最後のターンです。給料を払うと終わります。";
      break;
    case "bankrupt":
      s.turn = 4;
      s.money = 2;
      s.phase = "shipped";
      s.shipped = { gohyaku: 1 };
      setEvent(s, "breakdown");
      s.buff = null;
      s.message = "給料が払えるか、ぎりぎりです。";
      break;
  }
  return s;
}
