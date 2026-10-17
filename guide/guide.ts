// ルールと資料のページ。札の表はゲームと同じデータ（src/game/cards.ts）から作り、数字がずれないようにする。

import "@fontsource/zen-kaku-gothic-new/400.css";
import "@fontsource/zen-kaku-gothic-new/700.css";
import "@fontsource/shippori-mincho-b1/700.css";
import "@fontsource/yuji-syuku/400.css";
import "./guide.css";
import { DECK, EVENTS, PRICE, RANKS, RECRUITS, ROLES, SAKES, type Material, type Role } from "../src/game/cards.ts";
import { needList } from "../src/ui/cards.ts";
import sim from "./sim-results.json";

const $ = (id: string) => document.getElementById(id)!;

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function table(id: string, head: string[], rows: string[][], numeric: number[] = []) {
  const th = head.map((h, i) => `<th${numeric.includes(i) ? ' class="num"' : ""}>${h}</th>`).join("");
  const tr = rows.map((r) => `<tr>${r.map((c, i) => `<td${numeric.includes(i) ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`).join("");
  $(id).innerHTML = `<thead><tr>${th}</tr></thead><tbody>${tr}</tbody>`;
}

// 素材を「麹・酵母・山田錦×2」のように書く
function needsText(needs: Parameters<typeof needList>[0]): string {
  const list = needList(needs).map((m) => (m === "米" ? "どの米でも" : m));
  const counts = new Map<string, number>();
  for (const m of list) counts.set(m, (counts.get(m) ?? 0) + 1);
  return [...counts].map(([m, n]) => (n > 1 ? `${m}×${n}` : m)).join("・");
}

// 酒の札
table("sake-table", ["酒", "必要な素材", "マス", "売上", "得意な担当", "札の一言"],
  SAKES.map((s) => [`<b>${esc(s.name)}</b>`, esc(needsText(s.needs)), String(s.gauge), `${s.revenue}両`, s.spec, esc(s.say)]), [2, 3]);

// 人材札
const roleCount = new Map<Role, number>();
for (const r of RECRUITS) roleCount.set(r.role, (roleCount.get(r.role) ?? 0) + 1);
$("recruit-count").textContent = String(RECRUITS.length);
table("role-table", ["担当", "枚数", "契約金", "効果"],
  (Object.keys(ROLES) as Role[]).map((r) => {
    const d = ROLES[r];
    const kind = d.kind === "ability" ? "。置いてもマスは埋まらず、雇っているだけで効く" : "";
    // 枚数は求人の山の数。はじめからいる蔵人2人は含まない
    return [`<span class="piece piece-${d.kind}">${d.mark}</span><b>${r}</b>`, String(roleCount.get(r) ?? 0), `${d.fee}両`, esc(d.effect) + kind];
  }), [1, 2]);

// 素材
const deckTotal = Object.values(DECK).reduce((a, b) => a + b, 0);
$("deck-count").textContent = String(deckTotal);
table("deck-table", ["素材", "枚数", "取引先で買うと"],
  (Object.keys(DECK) as Material[]).map((m) => [esc(m), String(DECK[m]), `${PRICE[m]}両`]), [1, 2]);

// イベント
const totalWeight = EVENTS.reduce((a, e) => a + e.weight, 0);
$("event-count").textContent = String(EVENTS.length);
table("event-table", ["札", "種類", "出る確率", "効果", "もとになった話"],
  EVENTS.map((e) => [
    `<b>${esc(e.title)}</b>`,
    `<span class="kind kind-${e.kind === "トラブル" ? "bad" : e.kind === "選ぶ札" ? "choice" : "good"}">${e.kind}</span>`,
    `${Math.round((e.weight / totalWeight) * 100)}%`,
    esc(e.effect),
    e.origin === "架空" ? '<span class="dim">架空の出来事</span>' : esc(e.origin),
  ]), [2]);

// ランク
$("ranks").textContent = RANKS.filter(([min]) => Number.isFinite(min)).map(([min, r]) => `${r} ${min}両以上`).join("、") + "、それ未満は C";

// 自動プレイの結果
$("sim-runs").textContent = sim.runs.toLocaleString("ja-JP");
const maxMean = Math.max(...sim.rows.map((r) => r.mean));
table("sim-table", ["雇い方", "平均", "下位1割〜上位1割", "廃業"],
  sim.rows.map((r) => [
    esc(r.label),
    `<span class="bar" style="--w:${(r.mean / maxMean) * 100}%"></span>${r.mean.toFixed(1)}両`,
    `${r.p10}〜${r.p90}両`,
    `${r.bankrupt.toFixed(1)}%`,
  ]), [1, 2, 3]);
