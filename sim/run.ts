// シードを固定した自動プレイ。画面と同じルールのモジュールを使う。
// 方針は人より下手なので、数字の傾向を見るためのもの。
//   pnpm sim                                  すべての方針を 2,000 回ずつ
//   pnpm sim 500                              回数を変える
//   pnpm sim 2000 --json guide/sim-results.json  結果を JSON にも書く（ルールと資料のページが読む）

import { writeFileSync } from "node:fs";
import { ROLES, SAKE, SAKES, TURNS, type Role, type SakeId } from "../src/game/cards.ts";
import * as A from "../src/game/actions.ts";
import { newGame, type GameState } from "../src/game/state.ts";

type Policy = "none" | "kurabito" | "spec" | `only:${Role}`;

const SPECIALISTS: Role[] = ["酛屋", "船頭", "蔵守"];
const ABILITIES: Role[] = ["麹屋", "仕入れ係", "帳場", "営業"];

interface Params { targetCap: number; maxAbilities: number; hireUntil: number; reserveTurns: number }

function capacity(s: GameState): number {
  return s.workers.reduce((n, w) => n + (w.role === "蔵人" ? 1 : SPECIALISTS.includes(w.role) ? 2 : 0), 0);
}

function wants(policy: Policy, role: Role): boolean {
  if (policy === "none") return false;
  if (policy === "kurabito") return role === "蔵人";
  if (policy === "spec") return role === "蔵人" || SPECIALISTS.includes(role);
  return role === "蔵人" || role === policy.slice(5);
}

function answerEvents(s: GameState, P: Params) {
  while (s.pending) {
    const p = s.pending;
    const reserve = s.workers.length * P.reserveTurns;
    if (p.type === "pickMaterials") { A.pickMaterial(s, p.onlyRice ? "山田錦" : s.hand.some((c) => c.material === "麹") ? "山田錦" : "麹"); continue; }
    if (p.type === "breakdown") { if (s.money >= 6) A.answerYes(s); else A.answerNo(s); continue; }
    if (p.type === "interview") { if (capacity(s) >= 3) A.answerYes(s); else A.answerNo(s); continue; }
    if (s.money >= reserve + 3) A.answerYes(s); else A.answerNo(s);
  }
}

function hirePhase(s: GameState, policy: Policy, P: Params) {
  if (s.turn > P.hireUntil) return;
  for (;;) {
    const reserve = s.workers.length * P.reserveTurns;
    const cands = s.field.filter((r) => wants(policy, r.role)).sort((a, b) => Number(a.role === "蔵人") - Number(b.role === "蔵人"));
    let hired = false;
    for (const r of cands) {
      const gain = r.role === "蔵人" ? 1 : SPECIALISTS.includes(r.role) ? 2 : 0;
      if (gain && capacity(s) + gain > P.targetCap) continue;
      if (!gain && s.workers.filter((w) => ABILITIES.includes(w.role)).length >= P.maxAbilities) continue;
      if (s.money - ROLES[r.role].fee < reserve + 1) continue;
      A.hire(s, r.id); hired = true; break;
    }
    if (!hired) break;
  }
}

function brewPhase(s: GameState, P: Params) {
  const turnsLeft = TURNS - s.turn + 1;
  for (;;) {
    if (s.brews.length >= 3) break;
    let best: { score: number; id: SakeId; buys: string[] } | null = null;
    for (const sake of SAKES) {
      if (s.brews.some((b) => b.sake === sake.id)) continue;
      const cap = s.workers.reduce((n, w) => n + A.fillBy(w.role, sake), 0);
      if (!cap) continue;
      const est = Math.max(1, cap / (s.brews.length + 1));
      if (sake.gauge > est * turnsLeft) continue;
      const plan = A.payPlan(s, sake);
      if (plan.missing.length > s.buysLeft) continue;
      const buys = plan.missing.map((m) => (m === "米" ? "五百万石" : m));
      let cost = buys.reduce((c, m) => c + A.priceOf(s, m), 0);
      if (s.freeBuyLeft && buys.length) cost -= Math.max(...buys.map((m) => A.priceOf(s, m)));
      if (s.money - cost < s.workers.length * P.reserveTurns) continue;
      const score = (A.saleValue(s, sake, false).value - cost) / Math.ceil(sake.gauge / est);
      if (!best || score > best.score) best = { score, id: sake.id, buys };
    }
    if (!best) break;
    for (const m of best.buys) A.buy(s, m as Parameters<typeof A.buy>[1]);
    if (A.startBrew(s, best.id) !== `${SAKE[best.id].name}の仕込みを始めました。`) break;
  }
}

function placePhase(s: GameState) {
  for (const w of s.workers) w.placedOn = null;
  const remaining = new Map(s.brews.map((b) => [b.sake, SAKE[b.sake].gauge - b.filled]));
  let left = A.placeableCount(s);
  const order = [...s.workers].sort((a, b) => Number(a.role === "蔵人") - Number(b.role === "蔵人"));
  for (const w of order) {
    if (left <= 0) break;
    if (ROLES[w.role].kind === "ability") continue;
    const targets = s.brews
      .map((b) => ({ id: b.sake, fill: A.fillBy(w.role, SAKE[b.sake]), rem: remaining.get(b.sake)! }))
      .filter((t) => t.fill > 0 && t.rem > 0)
      .sort((a, b) => a.rem - b.rem);
    const t = targets[0];
    if (!t) continue;
    if (A.place(s, w.id, t.id) === "") { remaining.set(t.id, t.rem - t.fill); left--; }
  }
}

function discardPhase(s: GameState) {
  if (s.phase !== "discard") return;
  const pri: Record<string, number> = { 麹: 5, 山田錦: 4, 酵母: 3 };
  const sorted = [...s.hand].sort((a, b) => (pri[a.material] ?? 1) - (pri[b.material] ?? 1));
  A.discardCards(s, sorted.slice(0, s.hand.length - 5).map((c) => c.id));
}

function play(seed: number, policy: Policy, P: Params): { money: number | null; bankruptTurn: number | null } {
  const s = newGame(seed);
  A.startTurn(s);
  while (!s.over) {
    answerEvents(s, P);
    hirePhase(s, policy, P);
    brewPhase(s, P);
    placePhase(s);
    A.work(s);
    discardPhase(s);
    A.paySalary(s);
  }
  return s.over.kind === "finish" ? { money: s.money, bankruptTurn: null } : { money: null, bankruptTurn: s.over.turn };
}

function run(policy: Policy, n: number, over: Partial<Params> = {}, note = "") {
  const P: Params = { targetCap: 6, maxAbilities: 4, hireUntil: 12, reserveTurns: 2, ...over };
  const scores: number[] = [];
  let bankrupt = 0;
  for (let seed = 1; seed <= n; seed++) {
    const r = play(seed, policy, P);
    if (r.money === null) bankrupt++; else scores.push(r.money);
  }
  scores.sort((a, b) => a - b);
  const q = (p: number) => scores[Math.min(scores.length - 1, Math.floor(scores.length * p))] ?? 0;
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const row = { label: note || policy, mean: Math.round(mean * 10) / 10, median: q(0.5), p10: q(0.1), p90: q(0.9), bankrupt: Math.round((1000 * bankrupt) / n) / 10 };
  rows.push(row);
  console.log(
    `${row.label.padEnd(26, "　")} 平均 ${mean.toFixed(1).padStart(6)}  中央 ${String(row.median).padStart(4)}  ` +
    `下位1割 ${String(row.p10).padStart(4)}  上位1割 ${String(row.p90).padStart(4)}  廃業 ${row.bankrupt.toFixed(1).padStart(5)}%`,
  );
}

const rows: { label: string; mean: number; median: number; p10: number; p90: number; bankrupt: number }[] = [];

const n = Number(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : 2000);
const jsonAt = process.argv.indexOf("--json");
console.log(`各 ${n} 回`);
run("none", n, {}, "誰も雇わない");
for (const cap of [3, 4, 6]) run("kurabito", n, { targetCap: cap }, `蔵人だけ 置ける力${cap}まで`);
for (const r of SPECIALISTS) run(`only:${r}`, n, {}, `${r}と蔵人`);
run("spec", n, { targetCap: 6 }, "専門職と蔵人 置ける力6まで");
run("spec", n, { targetCap: 8 }, "専門職と蔵人 置ける力8まで");
for (const r of ABILITIES) run(`only:${r}`, n, { targetCap: 2, maxAbilities: 1 }, `${r}だけ足す`);
if (jsonAt >= 0) {
  const out = process.argv[jsonAt + 1]!;
  writeFileSync(out, JSON.stringify({ runs: n, turns: TURNS, rows }, null, 2) + "\n");
  console.log(`${out} に書きました`);
}
