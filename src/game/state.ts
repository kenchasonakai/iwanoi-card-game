// ゲームの状態。画面はこれを描くだけで、書き換えるのは actions.ts だけ。

import {
  BUYS_PER_TURN, DECK, FIELD_SIZE, RECRUITS, START_MONEY,
  type Buff, type GameEvent, type Material, type Role, type SakeId,
} from "./cards.ts";
import { makeRng, shuffle, type Rng } from "./rng.ts";

export interface HandCard {
  id: number;
  material: Material;
  /** 取引先で買った札。使っても捨て札に入らず、取引先に戻る */
  bought: boolean;
}

export interface Worker {
  id: number;
  role: Role;
  name: string;
  line: string;
  /** 雇ったターン。最初の 2 人は 0 */
  hiredTurn: number;
  /** 今置いている酒。置いていなければ null */
  placedOn: SakeId | null;
}

export interface Brew {
  sake: SakeId;
  filled: number;
}

/** イベントでプレイヤーが選ぶ場面 */
export type Pending =
  | { type: "pickMaterials"; title: string; left: number; onlyRice: boolean }
  | { type: "breakdown"; title: string }
  | { type: "interview"; title: string }
  | { type: "newrice"; title: string }
  | { type: "tasting"; title: string };

/**
 * act: 雇う・買う・仕込む・置く（手順 3〜6）
 * discard: 出荷の後、手札が上限を超えていて捨てる札を選ぶ
 * shipped: 出荷が済み、給料を払うだけ
 * over: 終わり
 */
export type Phase = "act" | "discard" | "shipped" | "over";

export interface GameState {
  seed: number;
  turn: number;
  phase: Phase;
  money: number;
  deck: Material[];
  discard: Material[];
  hand: HandCard[];
  recruitDeck: Omit<Worker, "hiredTurn" | "placedOn">[];
  recruitDiscard: Omit<Worker, "hiredTurn" | "placedOn">[];
  field: Omit<Worker, "hiredTurn" | "placedOn">[];
  workers: Worker[];
  brews: Brew[];
  /** 酒ごとの出荷回数（値下がりの計算に使う） */
  shipped: Partial<Record<SakeId, number>>;
  buff: Buff | null;
  /** 酒米の値上がりが残るターン数 */
  riceUpTurns: number;
  event: GameEvent | null;
  pending: Pending | null;
  /** このターンだけの増減 */
  temp: { extraWorkers: number; minusWorkers: number };
  buysLeft: number;
  /** 帳場の無料枠を今ターンまだ使っていないか */
  freeBuyLeft: boolean;
  /** 麹屋の効果を今ターンまだ使っていないか */
  freeKojiLeft: boolean;
  refreshedField: boolean;
  /** 今ターン出荷した結果（画面の演出用） */
  lastShip: { sake: SakeId; value: number; notes: string[] }[];
  over: { kind: "finish" } | { kind: "bankrupt"; turn: number } | null;
  /** 直近の操作の説明文（画面に出す） */
  message: string;
  /** 乱数。シリアライズしない */
  rng: Rng;
  nextId: number;
}

export function newGame(seed: number): GameState {
  const rng = makeRng(seed);
  let nextId = 1;
  const deck = shuffle(
    (Object.keys(DECK) as Material[]).flatMap((m) => Array<Material>(DECK[m]).fill(m)),
    rng,
  );
  const recruitDeck = shuffle(RECRUITS.map((r) => ({ id: nextId++, ...r })), rng);
  const s: GameState = {
    seed, turn: 0, phase: "act", money: START_MONEY,
    deck, discard: [], hand: [],
    recruitDeck, recruitDiscard: [], field: [],
    workers: [
      { id: nextId++, role: "蔵人", name: "蔵人", line: "はじめからいる", hiredTurn: 0, placedOn: null },
      { id: nextId++, role: "蔵人", name: "蔵人", line: "はじめからいる", hiredTurn: 0, placedOn: null },
    ],
    brews: [], shipped: {}, buff: null, riceUpTurns: 0, event: null, pending: null,
    temp: { extraWorkers: 0, minusWorkers: 0 },
    buysLeft: BUYS_PER_TURN, freeBuyLeft: false, freeKojiLeft: false, refreshedField: false,
    lastShip: [], over: null, message: "", rng, nextId,
  };
  for (let i = 0; i < 3; i++) {
    const m = drawMaterial(s);
    if (m) s.hand.push({ id: s.nextId++, material: m, bought: false });
  }
  while (s.field.length < FIELD_SIZE) {
    const r = drawRecruit(s);
    if (!r) break;
    s.field.push(r);
  }
  return s;
}

/** 山札から 1 枚。尽きたら捨て札を混ぜる */
export function drawMaterial(s: GameState): Material | null {
  if (s.deck.length === 0) {
    if (s.discard.length === 0) return null;
    s.deck = shuffle(s.discard, s.rng);
    s.discard = [];
  }
  return s.deck.pop() ?? null;
}

export function drawRecruit(s: GameState) {
  if (s.recruitDeck.length === 0) {
    if (s.recruitDiscard.length === 0) return null;
    s.recruitDeck = shuffle(s.recruitDiscard, s.rng);
    s.recruitDiscard = [];
  }
  return s.recruitDeck.pop() ?? null;
}
