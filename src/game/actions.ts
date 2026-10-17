// ルール本体。すべての操作はここを通して状態を変える。
// 返り値の文字列は画面に出す説明文で、空文字なら成功して特に言うことがない。

import {
  BREW_MAX, BUYS_PER_TURN, EVENTS, FIELD_SIZE, HAND_MAX, PRICE, REFRESH_FEE, ROLES, SAKE, SALARY, TURNS,
  isRice, specialistWorks, type Buff, type Material, type Rice, type Sake, type SakeId,
} from "./cards.ts";
import { weighted } from "./rng.ts";
import { drawMaterial, drawRecruit, type GameState, type HandCard, type Worker } from "./state.ts";

// ---------- 読むだけの関数（画面でも使う）

export function priceOf(s: GameState, m: Material): number {
  return s.riceUpTurns > 0 && isRice(m) ? PRICE[m] * 2 : PRICE[m];
}

export const salaryTotal = (s: GameState) => s.workers.length * SALARY;

/** 同じ酒の値下がり。1 回目 1.0、2 回目 0.8、3 回目から 0.6。営業がいると 1 段ゆるい */
export function decayRate(s: GameState, id: SakeId): number {
  const n = s.shipped[id] ?? 0;
  const steps = hasRole(s, "営業") ? [1, 1, 0.8] : [1, 0.8, 0.6];
  return steps[Math.min(n, 2)]!;
}

export const hasRole = (s: GameState, role: Worker["role"]) => s.workers.some((w) => w.role === role);

export function buffApplies(b: Buff, sake: Sake): boolean {
  if (b.only) return b.only === sake.id;
  if (b.tag) return sake.tags.includes(b.tag);
  return true;
}

/** 出荷したときの売上。札の売上 → 値下がり → 倍率 → 足し引き → 切り捨て */
export function saleValue(s: GameState, sake: Sake, withBuff: boolean): { value: number; notes: string[] } {
  const notes: string[] = [];
  let v = sake.revenue;
  const rate = decayRate(s, sake.id);
  if (rate < 1) { v *= rate; notes.push(`${Math.round(rate * 100)}%`); }
  if (withBuff && s.buff && buffApplies(s.buff, sake)) {
    v = s.buff.kind === "mult" ? v * s.buff.value : v + s.buff.value;
    notes.push(s.buff.label.split(" ").pop()!);
  }
  return { value: Math.floor(v), notes };
}

export interface PayPlan {
  pay: HandCard[];
  /** 足りない素材。"米" はどの米でもよい */
  missing: (Material | "米")[];
}

/** 今の手札でその酒を仕込めるか。払う札と足りない札を返す */
export function payPlan(s: GameState, sake: Sake): PayPlan {
  const needs: Record<string, number> = { ...sake.needs };
  if (s.freeKojiLeft && needs["麹"]) needs["麹"] -= 1;
  const pool = s.hand.slice();
  const pay: HandCard[] = [];
  const missing: (Material | "米")[] = [];
  const take = (pred: (c: HandCard) => boolean) => {
    // 山田錦は中汲みや大吟醸に要るので、「どの米でも」では後回しにする
    const c = pool.filter(pred).sort((a, b) => Number(a.material === "山田錦") - Number(b.material === "山田錦"))[0];
    if (c) { pay.push(c); pool.splice(pool.indexOf(c), 1); return true; }
    return false;
  };
  for (const [m, n] of Object.entries(needs)) {
    if (m === "ANY") continue;
    for (let i = 0; i < n; i++) if (!take((c) => c.material === m)) missing.push(m as Material);
  }
  for (let i = 0; i < (needs["ANY"] ?? 0); i++) if (!take((c) => isRice(c.material))) missing.push("米");
  return { pay, missing };
}

/** その人を酒に置いたとき埋まるマス */
export function fillBy(role: Worker["role"], sake: Sake): number {
  const def = ROLES[role];
  if (def.kind === "any") return 1;
  if (def.kind === "spec") return specialistWorks(role, sake) ? 2 : 0;
  return 0;
}

/** 今ターン置ける人数（停電などで減る） */
export function placeableCount(s: GameState): number {
  const base = s.workers.filter((w) => ROLES[w.role].kind !== "ability").length + s.temp.extraWorkers;
  return Math.max(0, base - s.temp.minusWorkers);
}

export function placedCount(s: GameState): number {
  return s.workers.filter((w) => w.placedOn !== null).length;
}

// ---------- ターンの進行

export function startTurn(s: GameState): void {
  s.turn += 1;
  s.phase = "act";
  s.temp = { extraWorkers: 0, minusWorkers: 0 };
  s.buysLeft = BUYS_PER_TURN;
  s.freeBuyLeft = hasRole(s, "帳場");
  s.freeKojiLeft = hasRole(s, "麹屋");
  s.refreshedField = false;
  s.lastShip = [];
  // 1. イベント
  s.event = weighted(EVENTS, (e) => e.weight, s.rng);
  s.message = applyEvent(s);
  // 2. 引く
  const n = 2 + (hasRole(s, "仕入れ係") ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const m = drawMaterial(s);
    if (m) s.hand.push({ id: s.nextId++, material: m, bought: false });
  }
}

function setBuff(s: GameState, b: Buff): string {
  if (s.buff) return "すでに出荷の効果を持っているので、何も起きません。";
  s.buff = { ...b };
  return "";
}

function applyEvent(s: GameState): string {
  const ev = s.event!;
  switch (ev.id) {
    case "summit": case "bishu": case "kanzake": case "parker": case "magazine":
      return setBuff(s, ev.buff!);
    case "crowd":
      s.pending = { type: "pickMaterials", title: ev.title, left: 2, onlyRice: false };
      return "好きな素材を2枚選んでください。";
    case "nanbu": s.temp.extraWorkers = 1; return "このターンだけ、蔵人が1人増えます。";
    case "export": s.money += 5; return "5両もらいました。";
    case "visit": s.money += 2; return "2両もらいました。";
    case "harvest": {
      for (let i = 0; i < 2; i++) { const m = drawMaterial(s); if (m) s.hand.push({ id: s.nextId++, material: m, bought: false }); }
      return "山札から2枚引きました。";
    }
    case "riceup": s.riceUpTurns = 3; return "3ターンの間、取引先の米が2倍になります。";
    case "breakdown": {
      const canPay = s.money >= 2, canUndo = s.brews.some((b) => b.filled > 0);
      if (canPay && canUndo) { s.pending = { type: "breakdown", title: ev.title }; return "2両払うか、マスを1つ戻すかを選んでください。"; }
      if (canPay) { s.money -= 2; return "2両払いました。"; }
      if (canUndo) { undoOneMarble(s); return "マスを1つ戻しました。"; }
      return "払えるお金も戻すマスもないので、何も起きません。";
    }
    case "typhoon": s.temp.minusWorkers = 1; return "このターン、置ける人が1人減ります。";
    case "quit": {
      const later = s.workers.filter((w) => w.hiredTurn > 0);
      if (later.length === 0) return "最初の蔵人しかいないので、何も起きません。";
      const last = later.reduce((a, b) => (b.hiredTurn >= a.hiredTurn ? b : a));
      s.workers.splice(s.workers.indexOf(last), 1);
      s.recruitDiscard.push({ id: last.id, role: last.role, name: last.name, line: last.line });
      return `${last.name}（${last.role}）が辞めました。`;
    }
    case "badkoji": {
      const i = s.hand.findIndex((c) => c.material === "麹");
      if (i < 0) return "麹がないので、何も起きません。";
      const [c] = s.hand.splice(i, 1);
      if (!c!.bought) s.discard.push("麹");
      return "麹を1枚捨てました。";
    }
    case "interview":
      if (s.buff) return "すでに出荷の効果を持っているので、取材は受けられません。";
      s.pending = { type: "interview", title: ev.title }; return "取材を受けますか？";
    case "newrice":
      if (s.money < 3) return "3両ないので、見送りです。";
      s.pending = { type: "newrice", title: ev.title }; return "3両払って米を2枚もらいますか？";
    case "tasting":
      if (s.buff) return "すでに出荷の効果を持っているので、出店しても意味がありません。";
      if (s.money < 2) return "2両ないので、見送りです。";
      s.pending = { type: "tasting", title: ev.title }; return "2両払って試飲会に出ますか？";
  }
}

function undoOneMarble(s: GameState): void {
  // いちばん進んでいる仕込みから 1 つ戻す
  const b = s.brews.filter((x) => x.filled > 0).sort((a, b) => b.filled - a.filled)[0];
  if (b) b.filled -= 1;
}

// ---------- イベントの選択に答える

export function answerYes(s: GameState): string {
  const p = s.pending;
  if (!p) return "";
  switch (p.type) {
    case "breakdown": s.money -= 2; s.pending = null; return "2両払いました。";
    case "interview": s.temp.minusWorkers += 1; s.buff = { kind: "add", value: 4, label: "次の出荷 +4両" }; s.pending = null; return "取材を受けました。置ける人が1人減ります。";
    case "newrice": s.money -= 3; s.pending = { type: "pickMaterials", title: p.title, left: 2, onlyRice: true }; return "好きな米を2枚選んでください。";
    case "tasting": s.money -= 2; s.buff = { kind: "mult", value: 1.5, label: "次の出荷 ×1.5" }; s.pending = null; return "試飲会に出店しました。";
    case "pickMaterials": return "";
  }
}

export function answerNo(s: GameState): string {
  const p = s.pending;
  if (!p) return "";
  s.pending = null;
  if (p.type === "breakdown") { undoOneMarble(s); return "マスを1つ戻しました。"; }
  return "見送りました。";
}

/** クラファンや新しい酒米で、もらう素材を 1 枚選ぶ。もらった札は取引先の札として扱う */
export function pickMaterial(s: GameState, m: Material): string {
  const p = s.pending;
  if (!p || p.type !== "pickMaterials") return "";
  if (p.onlyRice && !isRice(m)) return "米を選んでください。";
  s.hand.push({ id: s.nextId++, material: m, bought: true });
  p.left -= 1;
  if (p.left <= 0) { s.pending = null; return `${m}をもらいました。`; }
  return `${m}をもらいました。あと${p.left}枚。`;
}

// ---------- 3. 雇う

export function hire(s: GameState, recruitId: number): string {
  if (s.pending) return "先にイベントに答えてください。";
  const i = s.field.findIndex((r) => r.id === recruitId);
  if (i < 0) return "";
  const r = s.field[i]!;
  const fee = ROLES[r.role].fee;
  if (s.money < fee) return "お金が足りません。";
  s.money -= fee;
  s.field.splice(i, 1);
  s.workers.push({ ...r, hiredTurn: s.turn, placedOn: null });
  const next = drawRecruit(s);
  if (next) s.field.push(next);
  return `${r.name}（${r.role}）を雇いました。`;
}

export function refreshField(s: GameState): string {
  if (s.pending) return "先にイベントに答えてください。";
  if (s.refreshedField) return "入れ替えは1ターン1回です。";
  if (s.money < REFRESH_FEE) return "お金が足りません。";
  s.money -= REFRESH_FEE;
  s.recruitDiscard.push(...s.field);
  s.field = [];
  while (s.field.length < FIELD_SIZE) { const r = drawRecruit(s); if (!r) break; s.field.push(r); }
  s.refreshedField = true;
  return "求人の場を入れ替えました。";
}

// ---------- 4. 買う

export function buy(s: GameState, m: Material): string {
  if (s.pending) return "先にイベントに答えてください。";
  if (s.buysLeft <= 0) return `取引先は1ターン${BUYS_PER_TURN}枚までです。`;
  const p = s.freeBuyLeft ? 0 : priceOf(s, m);
  if (s.money < p) return "お金が足りません。";
  s.money -= p;
  if (s.freeBuyLeft) s.freeBuyLeft = false;
  s.buysLeft -= 1;
  s.hand.push({ id: s.nextId++, material: m, bought: true });
  return p === 0 ? `${m}を無料で仕入れました。` : `${m}を${p}両で仕入れました。`;
}

// ---------- 5. 仕込みを始める

export function startBrew(s: GameState, id: SakeId): string {
  if (s.pending) return "先にイベントに答えてください。";
  if (s.brews.some((b) => b.sake === id)) return "すでに仕込んでいます。";
  if (s.brews.length >= BREW_MAX) return `自分の蔵には${BREW_MAX}枚までです。`;
  const sake = SAKE[id];
  const plan = payPlan(s, sake);
  if (plan.missing.length) return `${plan.missing.join("・")}が足りません。`;
  for (const c of plan.pay) {
    s.hand.splice(s.hand.indexOf(c), 1);
    if (!c.bought) s.discard.push(c.material);
  }
  if (s.freeKojiLeft && sake.needs.麹) s.freeKojiLeft = false;
  s.brews.push({ sake: id, filled: 0 });
  return `${sake.name}の仕込みを始めました。`;
}

/** 途中でやめる。埋めたマスと素材は戻らない */
export function quitBrew(s: GameState, id: SakeId): string {
  const i = s.brews.findIndex((b) => b.sake === id);
  if (i < 0) return "";
  s.brews.splice(i, 1);
  for (const w of s.workers) if (w.placedOn === id) w.placedOn = null;
  return `${SAKE[id].name}の仕込みをやめました。`;
}

// ---------- 6. 人を置く

export function place(s: GameState, workerId: number, id: SakeId | null): string {
  if (s.pending) return "先にイベントに答えてください。";
  const w = s.workers.find((x) => x.id === workerId);
  if (!w) return "";
  if (ROLES[w.role].kind === "ability") return `${w.role}は置いてもマスを埋められません。雇っているだけで効きます。`;
  if (id === null) { w.placedOn = null; return ""; }
  if (!s.brews.some((b) => b.sake === id)) return "仕込んでいない酒には置けません。";
  if (w.placedOn === null && placedCount(s) >= placeableCount(s)) return "このターンはこれ以上置けません。";
  w.placedOn = id;
  const n = fillBy(w.role, SAKE[id]);
  return n === 0 ? `${w.role}はこの酒では働けません（0マス）。` : "";
}

// ---------- 7. 出荷（「仕込む」ボタン）

/** 置いた人の分だけマスを埋め、埋まった酒を出荷する。手札が多ければ捨てる段階へ */
export function work(s: GameState): string {
  if (s.pending) return "先にイベントに答えてください。";
  // 南部からの応援は、いちばんマスの残りが少ない酒に自動で入る
  for (let i = 0; i < s.temp.extraWorkers; i++) {
    const b = s.brews.filter((x) => x.filled < SAKE[x.sake].gauge).sort((a, b) => (SAKE[a.sake].gauge - a.filled) - (SAKE[b.sake].gauge - b.filled))[0];
    if (b) b.filled += 1;
  }
  for (const w of s.workers) {
    if (!w.placedOn) continue;
    const b = s.brews.find((x) => x.sake === w.placedOn);
    if (!b) { w.placedOn = null; continue; }
    const sake = SAKE[b.sake];
    b.filled = Math.min(sake.gauge, b.filled + fillBy(w.role, sake));
  }
  ship(s);
  s.phase = s.hand.length > HAND_MAX ? "discard" : "act";
  return s.lastShip.length ? `${s.lastShip.map((r) => SAKE[r.sake].name).join("、")}を出荷しました。` : "";
}

function ship(s: GameState): void {
  const done = s.brews.filter((b) => b.filled >= SAKE[b.sake].gauge);
  // 出荷の効果は、そのターンにいちばん高く売れる酒にかける
  // （設計書では選べることになっているが、まずは自動で決める）
  done.sort((a, b) => saleValue(s, SAKE[b.sake], true).value - saleValue(s, SAKE[a.sake], true).value);
  for (const b of done) {
    const sake = SAKE[b.sake];
    const used = !!(s.buff && buffApplies(s.buff, sake));
    const { value, notes } = saleValue(s, sake, true);
    if (used) s.buff = null;
    s.money += value;
    s.shipped[b.sake] = (s.shipped[b.sake] ?? 0) + 1;
    s.lastShip.push({ sake: b.sake, value, notes });
    s.brews.splice(s.brews.indexOf(b), 1);
    for (const w of s.workers) if (w.placedOn === b.sake) w.placedOn = null;
  }
}

/** 手札の上限を超えた分を捨てる */
export function discardCards(s: GameState, ids: number[]): string {
  const need = s.hand.length - HAND_MAX;
  if (ids.length !== need) return `${need}枚選んでください。`;
  for (const id of ids) {
    const i = s.hand.findIndex((c) => c.id === id);
    if (i < 0) continue;
    const [c] = s.hand.splice(i, 1);
    if (!c!.bought) s.discard.push(c!.material);
  }
  s.phase = "act";
  return "";
}

// ---------- 8. 給料

export function paySalary(s: GameState): string {
  if (s.hand.length > HAND_MAX) return `手札は${HAND_MAX}枚までです。先に捨ててください。`;
  const sal = salaryTotal(s);
  if (s.money < sal) {
    s.over = { kind: "bankrupt", turn: s.turn };
    s.phase = "over";
    return `給料${sal}両を払えず、${s.turn}ターン目で廃業しました。`;
  }
  s.money -= sal;
  if (s.riceUpTurns > 0) s.riceUpTurns -= 1;
  if (s.turn >= TURNS) {
    s.over = { kind: "finish" };
    s.phase = "over";
    return `${TURNS}ターンを終えました。所持金${s.money}両。`;
  }
  startTurn(s);
  return s.message;
}

export function rankOf(money: number): string {
  return [[170, "S"], [140, "A"], [110, "B"], [-Infinity, "C"]].find(([min]) => money >= (min as number))![1] as string;
}

/** どの米の値段表を出すか（画面用） */
export function riceList(): Rice[] {
  return ["山田錦", "五百万石", "総の舞", "きたしずく", "愛山"];
}
