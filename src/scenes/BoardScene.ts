// 盤面。状態（GameState）を毎回描き直すだけで、ルールは actions.ts に任せる。
// 横画面 1280×720 に 6 か所の場をすべて置き、一目で全体が見えるようにする。

import Phaser from "phaser";
import {
  BREW_MAX, HAND_MAX, RICES, ROLES, SAKE, SAKES, TURNS,
  type Material, type Role, type SakeId,
} from "../game/cards.ts";
import * as A from "../game/actions.ts";
import { newGame, type GameState } from "../game/state.ts";
import { sampleGame } from "../game/sample.ts";

export const W = 1280, H = 720;
export const DPR = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)));

// 色。和紙、墨、朱、金、藍
const C = {
  board: 0x1c1e22, felt: 0x24313a, feltLine: 0x3a4a55,
  washi: 0xf3ede0, washiDim: 0xe4dccb, sumi: 0x2b2a28,
  shu: 0xb3412e, kin: 0xd9b45b, kinDeep: 0xa8863a, ai: 0x2f4858,
  good: 0x7fb069, glow: 0xf3d27a,
};
const T = { washi: "#f3ede0", chalk: "#d8d2c4", chalkDim: "#8f8a7e", sumi: "#2b2a28", dim: "#6b665c", shu: "#b3412e", kin: "#d9b45b", red: "#e06c5c" };
const FONT = '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", system-ui, sans-serif';
const SERIF = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif';

const MATERIAL_COLOR: Record<Material, number> = {
  山田錦: 0xcfb36a, 五百万石: 0xd9c98a, 総の舞: 0xb8c98a, きたしずく: 0x9fc3cf, 愛山: 0xd39aa6, 麹: 0xf0ead8, 酵母: 0xc9b5d9,
};

interface TextOpts { font?: string; color?: string; bold?: boolean; ox?: number; oy?: number; wrap?: number; align?: string }

export class BoardScene extends Phaser.Scene {
  private s!: GameState;
  private layer!: Phaser.GameObjects.Container;
  private selectedWorker: number | null = null;
  private discardSel: number[] = [];

  constructor() { super("board"); }

  create() {
    const q = new URLSearchParams(location.search);
    const seed = Number(q.get("seed") ?? Date.now() % 100000);
    this.s = q.has("sample") ? sampleGame() : (() => { const g = newGame(seed); A.startTurn(g); return g; })();
    this.cameras.main.setZoom(DPR).centerOn(W / 2, H / 2);
    this.layer = this.add.container(0, 0);
    this.render();
  }

  // ---------- 描画

  render() {
    this.layer.removeAll(true);
    this.drawTable();
    this.drawTop();
    this.drawEvent();
    this.drawSakeField();
    this.drawBrewery();
    this.drawRecruits();
    this.drawWorkers();
    this.drawShop();
    this.drawDeckAndHand();
    this.drawButtons();
    if (this.s.pending) this.drawPending();
    if (this.s.phase === "discard") this.drawDiscardHint();
    if (this.s.over) this.drawOver();
  }

  private drawTable() {
    const g = this.add.graphics();
    g.fillStyle(C.board, 1).fillRect(0, 0, W, H);
    g.fillStyle(C.felt, 1).fillRoundedRect(8, 60, W - 16, H - 68, 18);
    this.layer.add(g);
    // 場の区切り
    this.zone(290, 70, 700, 190, "酒の場");
    this.zone(290, 272, 700, 262, "自分の蔵", `仕込み中 ${this.s.brews.length}/${BREW_MAX}`);
    this.zone(16, 70, 262, 464, "イベント");
    this.zone(1002, 70, 262, 216, "求人の場");
    this.zone(1002, 298, 262, 102, "雇っている人", `給料 ${A.salaryTotal(this.s)}両/ターン`);
    this.zone(1002, 412, 262, 122, "取引先", `あと${this.s.buysLeft}枚`);
    this.zone(16, 546, 974, 158, "手札", `${this.s.hand.length}/${HAND_MAX}枚`);
  }

  private zone(x: number, y: number, w: number, h: number, title: string, sub = "") {
    const g = this.add.graphics();
    g.lineStyle(1.5, C.feltLine, 1).strokeRoundedRect(x, y, w, h, 10);
    this.layer.add(g);
    this.layer.add(this.text(x + 12, y - 1, title, 13, { font: SERIF, color: T.chalk, bold: true, oy: 0.5 }).setBackgroundColor("#24313a").setPadding(4, 0, 4, 0));
    if (sub) this.layer.add(this.text(x + w - 12, y - 1, sub, 11, { color: T.chalkDim, ox: 1, oy: 0.5 }).setBackgroundColor("#24313a").setPadding(4, 0, 4, 0));
  }

  private drawTop() {
    const s = this.s;
    this.layer.add(this.text(20, 28, "岩瀬酒造 蔵元カードゲーム", 20, { font: SERIF, color: T.washi, bold: true, oy: 0.5 }));
    this.layer.add(this.text(300, 30, "試作", 11, { color: T.chalkDim, oy: 0.5 }));
    this.layer.add(this.text(W / 2, 28, `${s.turn} / ${TURNS} ターン`, 20, { color: T.washi, bold: true, ox: 0.5, oy: 0.5 }));
    // 所持金
    this.layer.add(this.koban(1080, 28, 1.1));
    this.layer.add(this.text(1100, 28, `${s.money} 両`, 22, { color: T.kin, bold: true, oy: 0.5 }));
    this.layer.add(this.text(1262, 20, "次の給料", 10, { color: T.chalkDim, ox: 1, oy: 0.5 }));
    this.layer.add(this.text(1262, 38, `−${A.salaryTotal(s)} 両`, 13, { color: s.money < A.salaryTotal(s) ? T.red : T.chalk, ox: 1, oy: 0.5 }));
  }

  private drawEvent() {
    const s = this.s, ev = s.event;
    const x = 32, y = 86, w = 230, h = 170;
    this.layer.add(this.card(x, y, w, h, ev?.kind === "トラブル" ? C.washiDim : C.washi));
    if (ev) {
      const kindColor = ev.kind === "トラブル" ? T.shu : ev.kind === "選ぶ札" ? "#3b6e8f" : "#4f7a3f";
      this.layer.add(this.text(x + 14, y + 16, ev.kind, 11, { color: kindColor, bold: true }));
      this.layer.add(this.text(x + 14, y + 34, ev.title, 19, { font: SERIF, color: T.sumi, bold: true, wrap: w - 28 }));
      this.layer.add(this.text(x + 14, y + 86, ev.effect, 12, { color: T.sumi, wrap: w - 28 }));
      this.layer.add(this.text(x + 14, y + h - 26, ev.origin === "架空" ? "架空の出来事" : `もとの話: ${ev.origin}`, 9, { color: T.dim, wrap: w - 28 }).setMaxLines(2));
    }
    // 持っている効果
    let cy = y + h + 14;
    if (s.buff) { this.layer.add(this.chip(x, cy, `効 ${s.buff.label}`, C.kin, T.sumi)); cy += 30; }
    if (s.riceUpTurns > 0) { this.layer.add(this.chip(x, cy, `米の値段 2倍 あと${s.riceUpTurns}ターン`, C.shu, T.washi)); cy += 30; }
    if (s.temp.extraWorkers) { this.layer.add(this.chip(x, cy, "応援の蔵人 +1", C.good, T.sumi)); cy += 30; }
    if (s.temp.minusWorkers) { this.layer.add(this.chip(x, cy, `置ける人 −${s.temp.minusWorkers}`, C.shu, T.washi)); cy += 30; }
    // 直近の説明
    if (s.message) this.layer.add(this.text(x, Math.max(cy + 6, 400), s.message, 12, { color: T.chalk, wrap: w }));
  }

  private drawSakeField() {
    const s = this.s;
    SAKES.forEach((sake, i) => {
      const x = 302 + i * 69, y = 84, w = 63, h = 164;
      const brewing = s.brews.some((b) => b.sake === sake.id);
      const plan = A.payPlan(s, sake);
      const ready = !brewing && plan.missing.length === 0 && s.brews.length < BREW_MAX && !s.pending && s.phase === "act";
      const c = this.card(x, y, w, h, brewing ? C.washiDim : C.washi, ready ? C.good : null);
      c.setAlpha(brewing ? 0.45 : 1);
      this.layer.add(c);
      this.layer.add(this.text(x + w / 2, y + 8, sake.short, 10.5, { font: SERIF, color: T.sumi, bold: true, ox: 0.5, align: "center" }));
      // 必要な素材
      const needs = Object.entries(sake.needs).flatMap(([m, n]) => Array<string>(n).fill(m === "ANY" ? "米" : m));
      needs.forEach((m, j) => this.layer.add(this.materialDot(x + 12 + (j % 2) * 20, y + 60 + Math.floor(j / 2) * 18, m)));
      // ゲージ
      for (let j = 0; j < sake.gauge; j++) this.layer.add(this.marble(x + 10 + (j % 4) * 12, y + 108 + Math.floor(j / 4) * 12, false, 4.5));
      this.layer.add(this.text(x + w / 2, y + h - 30, `${sake.revenue}両`, 13, { color: T.shu, bold: true, ox: 0.5 }));
      this.layer.add(this.text(x + w / 2, y + h - 13, ROLES[sake.spec].mark, 9, { color: T.dim, ox: 0.5 }));
      if (!brewing) this.hit(c, x, y, w, h, () => this.say(A.startBrew(s, sake.id)));
    });
  }

  private drawBrewery() {
    const s = this.s;
    for (let i = 0; i < BREW_MAX; i++) {
      const x = 320 + i * 226, y = 290, w = 200, h = 230;
      const b = s.brews[i];
      if (!b) {
        const g = this.add.graphics().lineStyle(2, C.feltLine, 1).strokeRoundedRect(x, y, w, h, 12);
        this.layer.add(g);
        this.layer.add(this.text(x + w / 2, y + h / 2, "空いている", 12, { color: T.chalkDim, ox: 0.5, oy: 0.5 }));
        continue;
      }
      const sake = SAKE[b.sake];
      const done = b.filled >= sake.gauge;
      const c = this.card(x, y, w, h, C.washi, done ? C.kin : null);
      this.layer.add(c);
      this.layer.add(this.text(x + 14, y + 14, sake.name, 15, { font: SERIF, color: T.sumi, bold: true, wrap: w - 28 }));
      this.layer.add(this.text(x + w - 14, y + 16, `${A.saleValue(s, sake, true).value}両`, 14, { color: T.shu, bold: true, ox: 1 }));
      // ゲージ（おはじき）
      for (let j = 0; j < sake.gauge; j++) this.layer.add(this.marble(x + 26 + (j % 4) * 46, y + 78 + Math.floor(j / 4) * 40, j < b.filled, 15));
      this.layer.add(this.text(x + 14, y + h - 70, `${b.filled} / ${sake.gauge} マス`, 11, { color: T.dim }));
      this.layer.add(this.text(x + w - 14, y + h - 70, `得意: ${sake.spec}`, 11, { color: T.dim, ox: 1 }));
      // 置いている駒
      const placed = s.workers.filter((w2) => w2.placedOn === b.sake);
      placed.forEach((w2, j) => this.layer.add(this.piece(x + 28 + j * 34, y + h - 30, w2.role, 0.8)));
      if (placed.length === 0) this.layer.add(this.text(x + 14, y + h - 38, "人をタップしてから、この札をタップ", 10, { color: T.dim }));
      this.hit(c, x, y, w, h, () => {
        if (this.selectedWorker !== null) { this.say(A.place(s, this.selectedWorker, b.sake)); this.selectedWorker = null; }
      });
    }
  }

  private drawRecruits() {
    const s = this.s;
    s.field.forEach((r, i) => {
      const x = 1014, y = 84 + i * 60, w = 238, h = 54;
      const def = ROLES[r.role];
      const c = this.card(x, y, w, h, C.washi, null, 8);
      this.layer.add(c);
      this.layer.add(this.piece(x + 24, y + h / 2, r.role, 0.9));
      this.layer.add(this.text(x + 46, y + 8, `${r.name}（${r.role}）`, 12, { color: T.sumi, bold: true }));
      this.layer.add(this.text(x + 46, y + 26, def.effect, 9.5, { color: T.dim, wrap: 150 }).setMaxLines(2));
      this.layer.add(this.text(x + w - 10, y + 10, `${def.fee}両`, 13, { color: s.money >= def.fee ? T.shu : T.dim, bold: true, ox: 1 }));
      this.hit(c, x, y, w, h, () => this.say(A.hire(s, r.id)));
    });
    const bx = 1014, by = 262;
    this.layer.add(this.button(bx, by, 238, 18, `1両で入れ替える${s.refreshedField ? "（済み）" : ""}`, () => this.say(A.refreshField(s)), { small: true, disabled: s.refreshedField }));
  }

  private drawWorkers() {
    const s = this.s;
    const placeable = A.placeableCount(s), placed = A.placedCount(s);
    this.layer.add(this.text(1014, 306, `置ける ${placed} / ${placeable}`, 11, { color: T.chalkDim }));
    s.workers.forEach((w, i) => {
      const x = 1030 + (i % 7) * 34, y = 342 + Math.floor(i / 7) * 36;
      const p = this.piece(x, y, w.role, 1);
      const isPlaced = w.placedOn !== null;
      if (isPlaced) p.setAlpha(0.4);
      if (this.selectedWorker === w.id) {
        const g = this.add.graphics().lineStyle(3, C.glow, 1).strokeCircle(x, y, 17);
        this.layer.add(g);
      }
      this.layer.add(p);
      this.hit(p, x - 16, y - 16, 32, 32, () => {
        if (isPlaced) { A.place(s, w.id, null); this.render(); return; }
        if (ROLES[w.role].kind === "ability") { this.say(`${w.role}は雇っているだけで効きます。`); return; }
        this.selectedWorker = this.selectedWorker === w.id ? null : w.id;
        this.render();
      });
    });
  }

  private drawShop() {
    const s = this.s;
    const items: Material[] = [...RICES, "麹", "酵母"];
    items.forEach((m, i) => {
      const x = 1014 + (i % 4) * 60, y = 426 + Math.floor(i / 4) * 52, w = 56, h = 46;
      const price = s.freeBuyLeft ? 0 : A.priceOf(s, m);
      const c = this.card(x, y, w, h, C.washi, null, 6);
      this.layer.add(c);
      this.layer.add(this.materialDot(x + w / 2, y + 9, m, 5));
      this.layer.add(this.text(x + w / 2, y + 16, m, 8.5, { color: T.sumi, bold: true, ox: 0.5 }));
      this.layer.add(this.text(x + w / 2, y + h - 10, price === 0 ? "無料" : `${price}両`, 11, { color: s.riceUpTurns > 0 && RICES.includes(m as never) ? T.red : T.shu, bold: true, ox: 0.5, oy: 0.5 }));
      this.hit(c, x, y, w, h, () => this.say(A.buy(s, m)));
    });
  }

  private drawDeckAndHand() {
    const s = this.s;
    // 山札と捨て札
    this.layer.add(this.card(36, 572, 70, 100, C.ai, null, 8));
    this.layer.add(this.text(71, 612, "山札", 12, { color: T.washi, bold: true, ox: 0.5, oy: 0.5 }));
    this.layer.add(this.text(71, 632, `${s.deck.length}枚`, 11, { color: T.chalk, ox: 0.5, oy: 0.5 }));
    this.layer.add(this.text(71, 690, `捨て札 ${s.discard.length}枚`, 10, { color: T.chalkDim, ox: 0.5, oy: 0.5 }));
    // 手札
    const n = s.hand.length;
    s.hand.forEach((c, i) => {
      const x = 150 + i * 84, y = 568, w = 76, h = 108;
      const sel = this.discardSel.includes(c.id);
      const card = this.card(x, y, w, h, C.washi, sel ? C.shu : null, 8);
      this.layer.add(card);
      this.layer.add(this.materialDot(x + w / 2, y + 36, c.material, 14));
      this.layer.add(this.text(x + w / 2, y + 64, c.material, 11, { color: T.sumi, bold: true, ox: 0.5 }));
      this.layer.add(this.text(x + w / 2, y + 86, c.bought ? "取引先から" : RICES.includes(c.material as never) ? "酒米" : "", 9, { color: T.dim, ox: 0.5 }));
      if (s.phase === "discard") this.hit(card, x, y, w, h, () => {
        this.discardSel = sel ? this.discardSel.filter((id) => id !== c.id) : [...this.discardSel, c.id];
        this.render();
      });
    });
    if (n === 0) this.layer.add(this.text(400, 622, "手札はありません", 12, { color: T.chalkDim, ox: 0.5, oy: 0.5 }));
    if (n > HAND_MAX) this.layer.add(this.text(150 + n * 84, 622, `${n - HAND_MAX}枚多い`, 12, { color: T.red, oy: 0.5 }));
  }

  private drawButtons() {
    const s = this.s;
    const disabled = !!s.pending || s.phase !== "act" || !!s.over;
    this.layer.add(this.button(1002, 556, 262, 60, "仕込む", () => this.say(A.work(s)), { primary: true, disabled, sub: "置いた人の分だけマスが埋まり、埋まった酒を出荷" }));
    const salaryDisabled = !!s.pending || s.phase === "discard" || !!s.over;
    this.layer.add(this.button(1002, 630, 262, 60, s.turn >= TURNS ? "給料を払って終える" : "給料を払って次のターンへ", () => this.say(A.paySalary(s)), { disabled: salaryDisabled, sub: `${A.salaryTotal(s)}両` }));
  }

  private drawDiscardHint() {
    const s = this.s, need = s.hand.length - HAND_MAX;
    const x = 290, y = 528;
    this.layer.add(this.text(x, y, `手札は${HAND_MAX}枚まで。捨てる札を${need}枚タップしてください`, 13, { color: T.red, bold: true, oy: 0.5 }).setBackgroundColor("#24313a").setPadding(6, 2, 6, 2));
    this.layer.add(this.button(700, 516, 180, 26, `${this.discardSel.length} / ${need}枚を捨てる`, () => {
      this.say(A.discardCards(s, this.discardSel)); this.discardSel = [];
    }, { small: true, primary: true, disabled: this.discardSel.length !== need }));
  }

  private drawPending() {
    const s = this.s, p = s.pending!;
    const w = 520, h = 220, x = W / 2 - w / 2, y = H / 2 - h / 2;
    const scrim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setInteractive();
    this.layer.add(scrim);
    this.layer.add(this.card(x, y, w, h, C.washi, C.kin, 14));
    this.layer.add(this.text(x + 24, y + 20, p.title, 22, { font: SERIF, color: T.sumi, bold: true }));
    this.layer.add(this.text(x + 24, y + 60, s.message, 13, { color: T.sumi, wrap: w - 48 }));
    if (p.type === "pickMaterials") {
      const list: Material[] = p.onlyRice ? [...RICES] : [...RICES, "麹", "酵母"];
      list.forEach((m, j) => this.layer.add(this.button(x + 24 + (j % 4) * 120, y + 100 + Math.floor(j / 4) * 48, 110, 38, m, () => this.say(A.pickMaterial(s, m)), { small: true })));
    } else {
      const yes = { breakdown: "2両払う", interview: "受ける（+4両、置ける人 −1）", newrice: "3両払う", tasting: "2両払う" }[p.type];
      const no = { breakdown: "マスを1つ戻す", interview: "断る", newrice: "見送る", tasting: "見送る" }[p.type];
      this.layer.add(this.button(x + 24, y + h - 70, 230, 46, yes, () => this.say(A.answerYes(s)), { primary: true }));
      this.layer.add(this.button(x + w - 24 - 230, y + h - 70, 230, 46, no, () => this.say(A.answerNo(s))));
    }
  }

  private drawOver() {
    const s = this.s, o = s.over!;
    const w = 560, h = 300, x = W / 2 - w / 2, y = H / 2 - h / 2;
    this.layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive());
    this.layer.add(this.card(x, y, w, h, C.washi, C.kin, 14));
    if (o.kind === "finish") {
      this.layer.add(this.text(x + w / 2, y + 36, `${TURNS}ターンを終えました`, 16, { color: T.dim, ox: 0.5 }));
      this.layer.add(this.text(x + w / 2, y + 70, `${s.money} 両`, 44, { color: T.shu, bold: true, ox: 0.5 }));
      this.layer.add(this.text(x + w / 2, y + 130, `ランク ${A.rankOf(s.money)}`, 30, { font: SERIF, color: T.sumi, bold: true, ox: 0.5 }));
    } else {
      this.layer.add(this.text(x + w / 2, y + 60, `${o.turn}ターン目で廃業`, 34, { font: SERIF, color: T.shu, bold: true, ox: 0.5 }));
      this.layer.add(this.text(x + w / 2, y + 120, "給料を払えませんでした", 14, { color: T.dim, ox: 0.5 }));
    }
    const made = Object.entries(s.shipped).map(([id, n]) => `${SAKE[id as SakeId].name}×${n}`).join("、") || "なし";
    this.layer.add(this.text(x + 24, y + 180, `造った酒: ${made}`, 12, { color: T.sumi, wrap: w - 48 }));
    this.layer.add(this.button(x + w / 2 - 110, y + h - 60, 220, 44, "もう一度", () => { location.search = `?seed=${Date.now() % 100000}`; }, { primary: true }));
  }

  // ---------- 部品

  private say(msg: string) {
    if (msg) this.s.message = msg;
    this.render();
  }

  private text(x: number, y: number, str: string, size: number, o: TextOpts = {}) {
    const t = this.add.text(x, y, str, {
      fontFamily: o.font ?? FONT, fontSize: `${size}px`, color: o.color ?? T.sumi,
      fontStyle: o.bold ? "bold" : "normal", align: o.align ?? "left",
      wordWrap: o.wrap ? { width: o.wrap, useAdvancedWrap: true } : undefined,
    });
    t.setResolution(DPR);
    t.setOrigin(o.ox ?? 0, o.oy ?? 0);
    return t;
  }

  private card(x: number, y: number, w: number, h: number, fill: number, ring: number | null = null, r = 10) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(x + 2, y + 3, w, h, r);
    g.fillStyle(fill, 1).fillRoundedRect(x, y, w, h, r);
    if (ring !== null) g.lineStyle(3, ring, 1).strokeRoundedRect(x, y, w, h, r);
    return g;
  }

  private hit(obj: Phaser.GameObjects.GameObject, x: number, y: number, w: number, h: number, onTap: () => void) {
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", onTap);
    this.layer.add(zone);
    return obj;
  }

  private button(x: number, y: number, w: number, h: number, label: string, onTap: () => void, o: { primary?: boolean; disabled?: boolean; small?: boolean; sub?: string } = {}) {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    const fill = o.disabled ? 0x4a4f55 : o.primary ? C.kin : C.washi;
    g.fillStyle(fill, 1).fillRoundedRect(x, y, w, h, o.small ? 6 : 10);
    c.add(g);
    const color = o.disabled ? "#8a8f95" : T.sumi;
    c.add(this.text(x + w / 2, y + (o.sub ? h / 2 - 8 : h / 2), label, o.small ? 11 : 16, { color, bold: true, ox: 0.5, oy: 0.5 }));
    if (o.sub) c.add(this.text(x + w / 2, y + h / 2 + 12, o.sub, 9.5, { color: o.disabled ? "#8a8f95" : T.dim, ox: 0.5, oy: 0.5 }));
    if (!o.disabled) this.hit(c, x, y, w, h, onTap);
    return c;
  }

  private chip(x: number, y: number, label: string, fill: number, color: string) {
    const c = this.add.container(0, 0);
    const t = this.text(x + 10, y + 11, label, 11, { color, bold: true, oy: 0.5 });
    const g = this.add.graphics().fillStyle(fill, 1).fillRoundedRect(x, y, t.width + 20, 22, 11);
    c.add([g, t]);
    return c;
  }

  /** おはじき。埋まっていれば朱、空なら薄い穴 */
  private marble(x: number, y: number, on: boolean, r: number) {
    const g = this.add.graphics();
    if (on) {
      g.fillStyle(C.shu, 1).fillCircle(x, y, r);
      g.fillStyle(0xffffff, 0.35).fillCircle(x - r * 0.3, y - r * 0.3, r * 0.35);
    } else {
      g.fillStyle(0x000000, 0.12).fillCircle(x, y, r);
      g.lineStyle(1, 0x000000, 0.2).strokeCircle(x, y, r);
    }
    return g;
  }

  /** 人の駒。将棋の駒の形に 1 文字 */
  private piece(x: number, y: number, role: Role, scale: number) {
    const c = this.add.container(x, y).setScale(scale);
    const def = ROLES[role];
    const fill = def.kind === "any" ? 0xe7d3a8 : def.kind === "spec" ? 0xd9b45b : 0xb9c7d2;
    const g = this.add.graphics();
    const shape = (dx: number, dy: number) => {
      g.beginPath();
      g.moveTo(dx, dy - 15); g.lineTo(dx + 11, dy - 8); g.lineTo(dx + 14, dy + 15); g.lineTo(dx - 14, dy + 15); g.lineTo(dx - 11, dy - 8);
      g.closePath(); g.fillPath();
    };
    g.fillStyle(0x000000, 0.3); shape(1, 2);
    g.fillStyle(fill, 1); shape(0, 0);
    c.add(g);
    c.add(this.text(0, 2, def.mark, 13, { font: SERIF, color: T.sumi, bold: true, ox: 0.5, oy: 0.5 }));
    return c;
  }

  private materialDot(x: number, y: number, m: string, r = 7) {
    const g = this.add.graphics();
    const color = (MATERIAL_COLOR as Record<string, number>)[m] ?? 0xcfcfcf;
    g.fillStyle(color, 1).fillCircle(x, y, r);
    g.lineStyle(1, 0x000000, 0.25).strokeCircle(x, y, r);
    if (m === "米") g.lineStyle(1.5, 0x000000, 0.4).strokeCircle(x, y, r * 0.5);
    return g;
  }

  private koban(x: number, y: number, scale: number) {
    const g = this.add.graphics();
    g.fillStyle(C.kinDeep, 1).fillEllipse(x, y + 1, 20 * scale, 14 * scale);
    g.fillStyle(C.kin, 1).fillEllipse(x, y, 18 * scale, 11 * scale);
    return g;
  }
}
