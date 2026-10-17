// 盤面。状態（GameState）を毎回描き直すだけで、ルールは actions.ts に任せる。
// 横画面 1280×720 に 6 か所の場をすべて置き、一目で全体が見えるようにする。
// 詳しい説明は、札をタップしたときだけ重ねて出す。

import Phaser from "phaser";
import {
  BREW_MAX, EVENTS, HAND_MAX, RICES, ROLES, SAKE, SAKES, SALARY, TURNS,
  type Material, type SakeId,
} from "../game/cards.ts";
import * as A from "../game/actions.ts";
import { newGame, type GameState } from "../game/state.ts";
import { SAMPLE_NAMES, sampleGame, type SampleName } from "../game/sample.ts";
import { Draw } from "../ui/draw.ts";
import { SAKE_CARD, drawSakeCard, drawSakeLabel, needList } from "../ui/cards.ts";
import { C, DPR, F, H, S, T, W } from "../ui/theme.ts";

type Modal =
  | { type: "sake"; id: SakeId }
  | { type: "brew"; id: SakeId; confirmQuit?: boolean }
  | { type: "recruit"; id: number }
  | { type: "worker"; id: number }
  | { type: "event" }
  | { type: "ship" }
  | { type: "restart" };

/**
 * ターンの中の手順。画面はこの順に 1 つずつ案内し、触る場所だけを光らせる。
 * ルールの上では雇う・買う・仕込むの順番は自由なので、前の手順に戻ってもよい。
 */
type Step = "event" | "hire" | "buy" | "brew" | "place";
const STEPS: { key: Step | "ship" | "salary"; label: string }[] = [
  { key: "event", label: "イベント" }, { key: "hire", label: "雇う" }, { key: "buy", label: "買う" }, { key: "brew", label: "仕込む" },
  { key: "place", label: "置く" }, { key: "ship", label: "出荷" }, { key: "salary", label: "給料" },
];
const NEXT_LABEL: Record<Step, string> = { event: "雇う", hire: "買う", buy: "仕込む", brew: "人を置く", place: "" };

/** 直前の操作で何が変わったか。描き直すときの演出に使う */
interface Anim {
  flipEvent?: boolean;
  newHand?: Map<number, "deck" | "shop" | "event">;
  marbles?: Map<SakeId, number>;
  placed?: number;
}

const SHOP_URL = "https://iwanoi.base.ec/";

// 場の位置
const L = {
  left: { x: 16, y: 66, w: 262, h: 468 },
  field: { x: 290, y: 66, w: 700, h: 196 },
  brew: { x: 290, y: 274, w: 700, h: 260 },
  recruit: { x: 1002, y: 66, w: 262, h: 234 },
  workers: { x: 1002, y: 312, w: 262, h: 222 },
  hand: { x: 16, y: 546, w: 684, h: 166 },
  shop: { x: 712, y: 546, w: 278, h: 166 },
  action: { x: 1002, y: 546, w: 262, h: 166 },
};
const MONEY_AT = { x: 1040, y: 28 };
const DECK_AT = { x: 60, y: 632 };

export class BoardScene extends Phaser.Scene {
  private s!: GameState;
  private layer!: Phaser.GameObjects.Container;
  private fx!: Phaser.GameObjects.Container;
  private d!: Draw;
  private modal: Modal | null = null;
  private selectedWorker: number | null = null;
  private discardSel: number[] = [];
  private anim: Anim = {};
  private step: Step = "event";
  /** このターンに山札から引いた札（イベントの画面で見せる） */
  private drawn: Material[] = [];
  /** イベントの画面を閉じたときに見せる、手札が配られる演出 */
  private dealPending: Map<number, "deck" | "shop" | "event"> | null = null;
  private coins!: Phaser.GameObjects.Particles.ParticleEmitter;
  private startSeed: number | undefined;

  constructor() { super("board"); }

  create() {
    this.makeTextures();
    this.scale.refresh(); // 読み込み直後のタップの位置がずれないように、画面の大きさを測り直す
    this.cameras.main.setZoom(DPR).centerOn(W / 2, H / 2);
    this.layer = this.add.container(0, 0);
    this.fx = this.add.container(0, 0).setDepth(100);
    this.d = new Draw(this, this.layer);
    this.coins = this.add.particles(0, 0, "coin", {
      speed: { min: 160, max: 360 }, angle: { min: 200, max: 340 }, gravityY: 700, lifespan: 1000,
      scale: { start: 1, end: 0.6 }, rotate: { min: 0, max: 360 }, emitting: false,
    }).setDepth(110);

    this.startFromUrl();
    // 書体の一部が後から届いたら描き直す（日本語の書体は文字の範囲ごとに分かれて届く）
    const redraw = () => this.render();
    document.fonts.addEventListener("loadingdone", redraw);
    this.events.once("shutdown", () => document.fonts.removeEventListener("loadingdone", redraw));

    const w = window as unknown as Record<string, unknown>;
    w["__kura"] = { scene: this, state: () => this.s };
    w["__ready"] = true;
  }

  init(data: { seed?: number }) {
    this.startSeed = data?.seed;
  }

  private startFromUrl() {
    const q = new URLSearchParams(location.search);
    if (q.has("sample") && this.startSeed === undefined) {
      const name = (q.get("sample") || "mid") as SampleName;
      this.s = sampleGame(SAMPLE_NAMES.includes(name) ? name : "mid");
      this.step = (q.get("step") as Step | null) ?? "place";
      if (name === "select") this.selectedWorker = this.s.workers[1]!.id;
    } else {
      const seed = this.startSeed ?? Number(q.get("seed") ?? Math.floor(Math.random() * 100000));
      this.s = newGame(seed);
      const before = new Set(this.s.hand.map((c) => c.id));
      A.startTurn(this.s);
      this.step = "event";
      this.drawn = this.s.hand.filter((c) => !before.has(c.id) && !c.bought).map((c) => c.material);
      this.dealPending = new Map(this.s.hand.map((c) => [c.id, "deck" as const]));
    }
    this.render();
  }

  private makeTextures() {
    if (this.textures.exists("coin")) return; // 始め直したときは作ってある
    const g = this.add.graphics();
    g.fillStyle(C.kinDeep, 1).fillEllipse(11, 8, 22, 15);
    g.fillStyle(C.kin, 1).fillEllipse(11, 7, 20, 13);
    g.generateTexture("coin", 22, 16);
    g.destroy();
  }

  // ---------- 操作。前後の差から演出を決めて描き直す

  private act(fn: () => string) {
    const s = this.s;
    const before = {
      hand: new Set(s.hand.map((c) => c.id)), money: s.money, turn: s.turn,
      filled: new Map(s.brews.map((b) => [b.sake, b.filled] as const)),
    };
    const msg = fn();
    if (msg) s.message = msg;
    const newHand = new Map<number, "deck" | "shop" | "event">();
    for (const c of s.hand) if (!before.hand.has(c.id)) newHand.set(c.id, c.bought ? (s.pending || s.turn !== before.turn ? "event" : "shop") : "deck");
    const marbles = new Map<SakeId, number>();
    for (const b of s.brews) { const f = before.filled.get(b.sake); if (f !== undefined && f < b.filled) marbles.set(b.sake, f); }
    if (s.turn !== before.turn) {
      // 新しいターン。イベントの画面から始め、手札が配られる演出はその画面を閉じてから
      this.step = "event";
      this.selectedWorker = null;
      this.discardSel = [];
      this.drawn = s.hand.filter((c) => newHand.get(c.id) === "deck").map((c) => c.material);
      this.dealPending = newHand;
      this.anim = { ...this.anim, marbles };
    } else {
      this.anim = { ...this.anim, newHand, marbles };
    }
    const delta = s.money - before.money;
    this.render();
    if (delta !== 0) this.moneyFx(delta);
  }

  private moneyFx(delta: number) {
    const t = this.add.text(MONEY_AT.x + 60, MONEY_AT.y + 10, `${delta > 0 ? "+" : "−"}${Math.abs(delta)}両`, {
      fontFamily: F.body, fontSize: "24px", fontStyle: "bold", color: delta > 0 ? T.kin : T.red,
    }).setResolution(DPR).setOrigin(0.5).setStroke("#15171b", 5);
    this.fx.add(t);
    this.tweens.add({ targets: t, y: t.y + (delta > 0 ? 34 : 30), alpha: 0, duration: 1300, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
    if (delta > 0) this.coins.explode(Math.min(24, 6 + delta), MONEY_AT.x, MONEY_AT.y);
  }

  // ---------- 描画

  /** 描き直すと対象が消えるので、くり返しの演出はここに集めて毎回止める */
  private loops: Phaser.Tweens.Tween[] = [];

  render() {
    if (!this.layer) return;
    for (const tw of this.loops) tw.remove();
    this.loops = [];
    this.layer.removeAll(true);
    const d = this.d;
    const g = d.graphics();
    g.fillStyle(C.bg, 1).fillRect(-200, -200, W + 400, H + 400);
    g.fillStyle(C.board, 1).fillRoundedRect(8, 58, W - 16, H - 62, 16);

    this.drawTop();
    this.drawLeft();
    this.drawField();
    this.drawBrews();
    this.drawRecruits();
    this.drawWorkers();
    this.drawHand();
    this.drawShop();
    this.drawAction();
    this.drawFocus();

    if (this.s.over) this.drawOver();
    else if (this.s.pending) this.drawPending();
    else if (this.modal) this.drawModal(this.modal);
    else if (this.step === "event" && this.s.phase === "act") this.drawEventStep();
    this.anim = {};
  }

  private drawTop() {
    const s = this.s, d = this.d;
    d.text(22, 29, "岩瀬酒造 蔵元カードゲーム", 26, { font: F.brush, color: T.washi, oy: 0.5 });
    d.button(350, 14, 80, 30, "ルール", () => { this.scene.pause(); this.scene.launch("rules", { from: "board" }); }, { size: S.small });
    d.button(438, 14, 96, 30, "最初から", () => {
      // 終わった後はそのまま始め直す。途中なら確かめる
      if (this.s.over) this.newGame(); else { this.modal = { type: "restart" }; this.render(); }
    }, { size: S.small });
    // ターン。数字と 20 個の点
    d.text(W / 2, 21, `${s.turn}`, S.big, { color: T.washi, bold: true, ox: 1, oy: 0.5 });
    d.text(W / 2 + 4, 24, `/ ${TURNS} ターン`, S.body, { color: T.chalkDim, oy: 0.5 });
    const g = d.graphics();
    for (let i = 0; i < TURNS; i++) {
      const x = W / 2 - 95 + i * 10;
      g.fillStyle(i < s.turn ? C.kin : 0x3a4148, 1).fillCircle(x, 46, i === s.turn - 1 ? 3.6 : 2.6);
    }
    // 所持金と次の給料
    d.koban(MONEY_AT.x, MONEY_AT.y, 1.4);
    d.text(MONEY_AT.x + 22, MONEY_AT.y, `${s.money}`, 30, { color: T.kin, bold: true, oy: 0.5 });
    d.text(MONEY_AT.x + 22 + measure(this, `${s.money}`, 30) + 4, MONEY_AT.y + 4, "両", S.strong, { color: T.kin, bold: true, oy: 0.5 });
    const sal = A.salaryTotal(s);
    d.text(1262, 20, "次の給料", S.small, { color: T.chalkDim, ox: 1, oy: 0.5 });
    d.text(1262, 40, `−${sal}両`, S.strong, { color: s.money < sal ? T.red : T.chalk, bold: true, ox: 1, oy: 0.5 });
  }

  private drawLeft() {
    const s = this.s, d = this.d, Z = L.left;
    d.zone(Z.x, Z.y, Z.w, Z.h, "イベント");
    const ev = s.event;
    const cw = 236, ch = 196, cx = Z.x + 13 + cw / 2, cy = Z.y + 34 + ch / 2;
    const { c, d: e } = d.group(cx, cy);
    const trouble = ev?.kind === "トラブル";
    e.card(-cw / 2, -ch / 2, cw, ch, trouble ? C.washiDim : C.washi);
    if (ev) {
      const kindColor = trouble ? T.shu : ev.kind === "選ぶ札" ? T.ai : T.green;
      const x0 = -cw / 2 + 14, y0 = -ch / 2;
      e.text(x0, y0 + 12, ev.kind, S.small, { color: kindColor, bold: true });
      e.text(x0, y0 + 32, ev.title, S.title, { font: F.mincho, bold: true, wrap: cw - 28 });
      e.text(x0, y0 + 98, ev.effect, S.body, { wrap: cw - 28, lineSpacing: 4 });
      e.text(x0, y0 + ch - 22, ev.origin === "架空" ? "架空の出来事" : "実話がもと（タップで詳しく）", S.flavor, { color: T.dim });
      e.hit(-cw / 2, -ch / 2, cw, ch, () => { this.modal = { type: "event" }; this.render(); });
    }
    if (this.anim.flipEvent) {
      c.scaleX = 0;
      this.tweens.add({ targets: c, scaleX: 1, duration: 360, delay: 120, ease: "Back.easeOut" });
    }
    // 持っている効果など
    let y = cy + ch / 2 + 12;
    const chip = (label: string, fill: number, color: string) => { d.chip(Z.x + 13, y, label, fill, color); y += 36; };
    if (s.buff) chip(`効 ${s.buff.label}`, C.kin, T.sumi);
    if (s.riceUpTurns > 0) chip(`米の値段 2倍 あと${s.riceUpTurns}ターン`, C.shu, T.washi);
    if (s.temp.extraWorkers) chip("応援の蔵人 +1（自動で入る）", C.good, T.sumi);
    if (s.temp.minusWorkers) chip(`置ける人 −${s.temp.minusWorkers}`, C.shu, T.washi);
    // いまの説明
    const my = Math.max(y + 4, Z.y + Z.h - 112);
    const mg = d.graphics();
    const boxH = Z.y + Z.h - my - 10;
    mg.fillStyle(0x000000, 0.25).fillRoundedRect(Z.x + 10, my, Z.w - 20, boxH, 10);
    // 長いときは文字を小さくして枠に収める
    const hint = this.hint();
    let ht = d.text(Z.x + 22, my + 10, hint, S.body, { color: T.chalk, wrap: Z.w - 44, lineSpacing: 4 });
    if (ht.height > boxH - 16) { ht.destroy(); ht = d.text(Z.x + 22, my + 8, hint, S.small, { color: T.chalk, wrap: Z.w - 44, lineSpacing: 2 }); }
    if (ht.height > boxH - 12) ht.setMaxLines(Math.floor((boxH - 12) / (S.small + 4)));
  }

  /** 左下に出す、いまの説明 */
  private hint(): string {
    const s = this.s;
    if (this.selectedWorker !== null) {
      const w = s.workers.find((x) => x.id === this.selectedWorker);
      if (w) return `${w.role}を選んでいます。置く酒の札（自分の蔵）をタップしてください。`;
    }
    if (s.phase === "discard") return `手札は${HAND_MAX}枚まで。捨てる札をあと${Math.max(0, s.hand.length - HAND_MAX - this.discardSel.length)}枚タップしてください。`;
    if (s.phase === "shipped") return `${s.message}\n給料を払って次のターンへ進みます。`;
    if (s.over) return s.message;
    const head = s.message ? `${s.message}\n` : "";
    switch (this.step) {
      case "event": return s.message;
      case "hire": return `${head}【雇う】求人の札をタップすると、その人の説明と「雇う」ボタンが出ます。給料は毎ターン1人1両。雇わないなら「次へ」。`;
      case "buy": return `${head}【買う】取引先の素材をタップすると買えます（あと${s.buysLeft}枚）。酒の場の札で、赤く縁どられた丸が足りない素材です。`;
      case "brew": return `${head}【仕込む】酒の場の札をタップすると説明と「仕込む」ボタンが出ます。緑に光る札は、いまの手札で仕込めます。`;
      case "place": return `${head}【置く】雇っている人の駒をタップし、自分の蔵の酒をタップして置きます。蔵人は1マス、得意な人は2マス。置けたら右下の「仕込む」。`;
    }
  }

  private drawField() {
    const s = this.s, d = this.d, Z = L.field;
    d.zone(Z.x, Z.y, Z.w, Z.h, "酒の場", "タップで詳しく・仕込む");
    const { w: cw, h: ch } = SAKE_CARD;
    SAKES.forEach((sake, i) => {
      const x = Z.x + 12 + (i % 5) * (cw + 6), y = Z.y + 32 + Math.floor(i / 5) * (ch + 6);
      const brewing = s.brews.some((b) => b.sake === sake.id);
      const plan = A.payPlan(s, sake);
      const ready = !brewing && plan.missing.length === 0 && s.brews.length < BREW_MAX && !s.pending && (this.inStep("brew") || this.inStep("buy"));
      drawSakeCard(d, x, y, sake, { missing: plan.missing, brewing, ready });
      d.hit(x, y, cw, ch, () => { this.modal = { type: brewing ? "brew" : "sake", id: sake.id }; this.render(); });
    });
  }

  private drawBrews() {
    const s = this.s, d = this.d, Z = L.brew;
    d.zone(Z.x, Z.y, Z.w, Z.h, "自分の蔵", `仕込み中 ${s.brews.length}/${BREW_MAX}`);
    const sel = s.workers.find((w) => w.id === this.selectedWorker) ?? null;
    for (let i = 0; i < BREW_MAX; i++) {
      const cw = 218, ch = 218, x = Z.x + 14 + i * (cw + 9), y = Z.y + 32;
      const b = s.brews[i];
      if (!b) {
        const g = d.graphics();
        g.lineStyle(2, C.boardLine, 1).strokeRoundedRect(x, y, cw, ch, 12);
        d.text(x + cw / 2, y + ch / 2 - 12, "空き", S.strong, { color: T.chalkDim, ox: 0.5, oy: 0.5, font: F.brush });
        d.text(x + cw / 2, y + ch / 2 + 16, "酒の場の札から仕込む", S.small, { color: T.chalkDim, ox: 0.5, oy: 0.5 });
        continue;
      }
      const sake = SAKE[b.sake];
      const done = b.filled >= sake.gauge;
      const fill = sel ? A.fillBy(sel.role, sake) : -1;
      d.card(x, y, cw, ch, C.washi, { ring: done ? C.kin : fill > 0 ? C.good : null, r: 12 });
      if (sel && fill === 0) d.graphics().fillStyle(0x000000, 0.35).fillRoundedRect(x, y, cw, ch, 12);
      d.fit(d.text(x + 14, y + 12, sake.name, 19, { font: F.mincho, bold: true }), cw - 28);
      const sale = A.saleValue(s, sake, true);
      d.text(x + 14, y + 44, `${sale.value}両`, S.title, { color: T.shu, bold: true });
      if (sale.notes.length) d.text(x + 14 + measure(this, `${sale.value}両`, S.title, true) + 8, y + 50, sale.notes.join(" "), S.small, { color: T.shu });
      // おはじき
      const from = this.anim.marbles?.get(b.sake);
      for (let j = 0; j < sake.gauge; j++) {
        const m = d.marble(x + 33 + (j % 4) * 50, y + 100 + Math.floor(j / 4) * 42, j < b.filled, 17);
        if (from !== undefined && j >= from && j < b.filled) {
          m.setScale(0);
          this.tweens.add({ targets: m, scale: 1, duration: 260, delay: 150 + (j - from) * 130, ease: "Back.easeOut" });
        }
      }
      d.text(x + 14, y + 166, `${b.filled} / ${sake.gauge} マス`, S.small, { color: T.dim });
      d.text(x + cw - 14, y + 166, `得意 ${sake.spec}`, S.small, { color: T.dim, ox: 1 });
      const placed = s.workers.filter((w) => w.placedOn === b.sake);
      placed.forEach((w, j) => {
        const p = d.piece(x + 30 + j * 38, y + 196, w.role, 0.85);
        if (this.anim.placed === w.id) { p.setScale(0); this.tweens.add({ targets: p, scale: 0.85, duration: 220, ease: "Back.easeOut" }); }
      });
      if (sel && fill >= 0) d.text(x + cw - 14, y + 196, fill > 0 ? `+${fill}マス` : "0マス", S.strong, { color: fill > 0 ? T.green : T.shu, bold: true, ox: 1, oy: 0.5 });
      d.hit(x, y, cw, ch, () => {
        if (this.selectedWorker !== null) {
          const id = this.selectedWorker;
          this.selectedWorker = null;
          this.anim.placed = id;
          this.act(() => A.place(s, id, b.sake));
        } else { this.modal = { type: "brew", id: b.sake }; this.render(); }
      });
    }
  }

  private drawRecruits() {
    const s = this.s, d = this.d, Z = L.recruit;
    d.zone(Z.x, Z.y, Z.w, Z.h, "求人の場");
    d.button(Z.x + Z.w - 104, Z.y + 5, 92, 24, s.refreshedField ? "入替済み" : "入替 1両", () => this.act(() => A.refreshField(s)), { size: S.small, disabled: s.refreshedField || !this.inStep("hire") });
    s.field.forEach((r, i) => {
      const x = Z.x + 12, y = Z.y + 36 + i * 64, cw = 238, ch = 58;
      const def = ROLES[r.role];
      d.card(x, y, cw, ch, C.washi, { r: 8 });
      d.piece(x + 26, y + ch / 2, r.role, 0.95);
      d.text(x + 50, y + 7, r.role, S.strong, { bold: true });
      d.text(x + 50 + measure(this, r.role, S.strong, true) + 6, y + 11, r.name, S.flavor, { color: T.dim });
      d.text(x + 50, y + 33, def.brief, S.small, { color: T.dim });
      d.text(x + cw - 10, y + 8, `${def.fee}両`, S.number, { color: s.money >= def.fee ? T.shu : T.dim, bold: true, ox: 1 });
      d.hit(x, y, cw, ch, () => { this.modal = { type: "recruit", id: r.id }; this.render(); });
    });
  }

  private drawWorkers() {
    const s = this.s, d = this.d, Z = L.workers;
    d.zone(Z.x, Z.y, Z.w, Z.h, "雇っている人", `置ける ${A.placedCount(s)}/${A.placeableCount(s)}`);
    s.workers.forEach((w, i) => {
      const x = Z.x + 30 + (i % 5) * 48, y = Z.y + 60 + Math.floor(i / 5) * 50;
      const selected = this.selectedWorker === w.id;
      if (selected) d.graphics().fillStyle(C.glow, 0.35).fillCircle(x, y + 2, 25).lineStyle(2.5, C.glow, 1).strokeCircle(x, y + 2, 25);
      const p = d.piece(x, y, w.role, 1.1);
      if (w.placedOn) p.setAlpha(0.35);
      if (selected) this.loops.push(this.tweens.add({ targets: p, y: y - 4, duration: 450, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }));
      d.hit(x - 22, y - 24, 44, 48, () => {
        if (ROLES[w.role].kind === "ability" || !this.inStep("place")) { this.modal = { type: "worker", id: w.id }; this.render(); return; }
        if (w.placedOn) { this.act(() => A.place(s, w.id, null)); return; }
        this.selectedWorker = selected ? null : w.id;
        this.render();
      });
    });
    if (s.workers.some((w) => w.placedOn)) d.text(Z.x + 12, Z.y + Z.h - 22, "薄い駒は置いてある人。タップで外す", S.flavor, { color: T.chalkDim });
  }

  private drawHand() {
    const s = this.s, d = this.d, Z = L.hand;
    const over = s.hand.length > HAND_MAX;
    d.zone(Z.x, Z.y, Z.w, Z.h, "手札", `${s.hand.length}/${HAND_MAX}枚`);
    if (over) d.text(Z.x + Z.w - 80, Z.y + 8, `${s.hand.length - HAND_MAX}枚多い`, S.small, { color: T.red, bold: true, ox: 1 });
    // 山札
    d.card(DECK_AT.x - 32, DECK_AT.y - 50, 64, 100, C.ai, { r: 8 });
    d.graphics().lineStyle(1.5, C.kin, 0.6).strokeRoundedRect(DECK_AT.x - 26, DECK_AT.y - 44, 52, 88, 6);
    d.text(DECK_AT.x, DECK_AT.y - 10, "山札", S.body, { color: T.washi, font: F.brush, ox: 0.5, oy: 0.5 });
    d.text(DECK_AT.x, DECK_AT.y + 14, `${s.deck.length}`, S.number, { color: T.washi, bold: true, ox: 0.5, oy: 0.5 });
    d.text(DECK_AT.x, DECK_AT.y + 62, `捨て札 ${s.discard.length}`, S.flavor, { color: T.chalkDim, ox: 0.5, oy: 0.5 });
    // 手札
    const n = s.hand.length, cw = 78, ch = 112, x0 = 112 + cw / 2;
    const step = n > 1 ? Math.min(86, (Z.x + Z.w - 12 - cw / 2 - x0) / (n - 1)) : 0;
    s.hand.forEach((card, i) => {
      const x = x0 + i * step, y = Z.y + 34 + ch / 2;
      const sel = this.discardSel.includes(card.id);
      const { c, d: e } = d.group(x, sel ? y - 10 : y);
      e.card(-cw / 2, -ch / 2, cw, ch, C.washi, { ring: sel ? C.shu : s.phase === "discard" ? C.glow : null, r: 8 });
      e.material(0, -22, card.material, 19);
      e.text(0, 14, card.material, S.body, { bold: true, ox: 0.5, oy: 0.5 });
      e.text(0, 38, card.bought ? "取引先から" : RICES.includes(card.material as never) ? "酒米" : "", S.flavor, { color: T.dim, ox: 0.5, oy: 0.5 });
      if (sel) e.text(0, -ch / 2 - 2, "捨てる", S.small, { color: T.red, bold: true, ox: 0.5, oy: 1 });
      if (s.phase === "discard") e.hit(-cw / 2, -ch / 2, cw, ch, () => {
        this.discardSel = sel ? this.discardSel.filter((id) => id !== card.id) : [...this.discardSel, card.id].slice(-(s.hand.length - HAND_MAX));
        this.render();
      });
      const from = this.anim.newHand?.get(card.id);
      if (from) {
        const k = [...this.anim.newHand!.keys()].indexOf(card.id);
        const src = from === "deck" ? DECK_AT : from === "shop" ? { x: L.shop.x + L.shop.w / 2, y: L.shop.y + 80 } : { x: L.left.x + 130, y: L.left.y + 130 };
        c.setPosition(src.x, src.y).setScale(0.5).setAlpha(0);
        this.tweens.add({ targets: c, x, y, scale: 1, alpha: 1, duration: 380, delay: 420 + k * 130, ease: "Cubic.easeOut" });
      }
    });
    if (n === 0) d.text(Z.x + 360, Z.y + 90, "手札はありません", S.body, { color: T.chalkDim, ox: 0.5, oy: 0.5 });
  }

  private drawShop() {
    const s = this.s, d = this.d, Z = L.shop;
    const sub = s.freeBuyLeft ? "帳場: 1枚無料" : `あと${s.buysLeft}枚`;
    d.zone(Z.x, Z.y, Z.w, Z.h, "取引先", sub);
    const items: Material[] = [...RICES, "麹", "酵母"];
    const disabled = !this.inStep("buy") || s.buysLeft <= 0;
    items.forEach((m, i) => {
      const cw = 62, ch = 62, x = Z.x + 9 + (i % 4) * (cw + 4), y = Z.y + 32 + Math.floor(i / 4) * (ch + 4);
      const price = s.freeBuyLeft ? 0 : A.priceOf(s, m);
      d.card(x, y, cw, ch, disabled ? C.washiDark : C.washi, { r: 8, alpha: disabled ? 0.7 : 1 });
      d.material(x + cw / 2, y + 15, m, 11);
      d.text(x + cw / 2, y + 36, m, S.flavor, { bold: true, ox: 0.5, oy: 0.5 });
      const up = s.riceUpTurns > 0 && RICES.includes(m as never);
      d.text(x + cw / 2, y + 52, price === 0 ? "無料" : `${price}両`, S.body, { color: up ? T.red : T.shu, bold: true, ox: 0.5, oy: 0.5 });
      d.hit(x, y, cw, ch, () => {
        if (!this.inStep("buy")) { s.message = "取引先で買えるのは「買う」の手順です。右下の手順の札から戻れます。"; this.render(); return; }
        this.act(() => A.buy(s, m));
      });
    });
  }

  /** いまの手順。出荷の後は出荷・給料の手順になる */
  private curStep(): Step | "ship" | "salary" | "over" {
    const s = this.s;
    if (s.over) return "over";
    if (s.phase === "discard") return "ship";
    if (s.phase === "shipped") return "salary";
    return this.step;
  }

  private inStep(step: Step): boolean {
    return this.s.phase === "act" && !this.s.pending && !this.s.over && this.step === step;
  }

  private goStep(step: Step) {
    this.step = step;
    this.selectedWorker = null;
    this.s.message = ""; // 前の手順の結果は消して、新しい手順の説明だけにする
    if (this.dealPending && step !== "event") {
      this.anim.newHand = this.dealPending;
      this.anim.flipEvent = true;
      this.dealPending = null;
    }
    this.render();
  }

  private drawAction() {
    const s = this.s, d = this.d, Z = L.action;
    // 手順の札。2 段に並べ、済んだ手順はタップで戻れる
    const cur = this.curStep();
    const curIndex = STEPS.findIndex((x) => x.key === cur);
    STEPS.forEach((st, i) => {
      const row = i < 4 ? 0 : 1, col = i < 4 ? i : i - 4;
      const w = row === 0 ? 62.5 : 84, x = Z.x + col * (w + 4), y = Z.y + row * 28;
      const here = i === curIndex, done = curIndex > i || cur === "over";
      const g = d.graphics();
      g.fillStyle(here ? C.kin : done ? 0x3b4a45 : 0x2c363d, 1).fillRoundedRect(x, y, w, 24, 12);
      d.text(x + w / 2, y + 12, st.label, S.small, { color: here ? T.sumi : done ? T.good : T.chalkDim, bold: here || done, ox: 0.5, oy: 0.5 });
      const back = s.phase === "act" && !s.pending && done && st.key !== "event" && st.key !== "ship" && st.key !== "salary";
      if (back) d.hit(x, y, w, 24, () => this.goStep(st.key as Step));
    });
    const by = Z.y + 58, bh = 106;
    if (s.over) {
      d.button(Z.x, by, Z.w, bh, "もう一度", () => this.newGame(), { primary: true, size: S.title });
    } else if (s.phase === "discard") {
      const need = s.hand.length - HAND_MAX;
      d.button(Z.x, by, Z.w, bh, `${this.discardSel.length} / ${need}枚を捨てる`, () => {
        const ids = this.discardSel; this.discardSel = [];
        this.act(() => A.discardCards(s, ids));
      }, { primary: true, size: S.title, disabled: this.discardSel.length !== need, sub: "手札は5枚まで" });
    } else if (s.phase === "shipped") {
      const sal = A.salaryTotal(s);
      const last = s.turn >= TURNS;
      d.button(Z.x, by, Z.w, bh, last ? "給料を払って終える" : "給料を払って次のターンへ", () => this.act(() => A.paySalary(s)), {
        primary: true, size: S.strong, sub: `${s.workers.length}人 × ${SALARY}両 = ${sal}両 → 残り ${s.money - sal}両`, danger: s.money < sal,
      });
    } else if (this.step === "place") {
      const placed = A.placedCount(s);
      d.button(Z.x, by, Z.w, bh, "仕込む", () => { this.selectedWorker = null; this.work(); }, {
        primary: true, size: S.big, disabled: !!s.pending,
        sub: s.brews.length === 0 ? "仕込み中の酒がありません（このまま進めます）" : placed ? `置いた${placed}人の分だけマスを埋めて出荷` : "誰も置いていません（このまま進めます）",
      });
    } else {
      const sub = { event: "イベントを読んだら", hire: "雇わないなら、そのまま次へ", buy: "買わないなら、そのまま次へ", brew: "仕込み終えたら" }[this.step];
      d.button(Z.x, by, Z.w, bh, `次へ：${NEXT_LABEL[this.step]}`, () => this.goStep(nextStep(this.step)), { primary: true, size: S.title, disabled: !!s.pending, sub });
    }
  }

  /** いまの手順で触る場を光らせ、ほかを暗くする */
  private drawFocus() {
    const s = this.s, d = this.d;
    if (s.over || s.pending || this.modal) return;
    const cur = this.curStep();
    const active: (keyof typeof L)[] = {
      event: ["left"], hire: ["recruit", "workers"], buy: ["shop", "field", "hand"], brew: ["field", "hand", "brew"],
      place: ["workers", "brew"], ship: ["hand"], salary: ["brew", "left"], over: [],
    }[cur] as (keyof typeof L)[];
    const g = d.graphics();
    for (const k of ["left", "field", "brew", "recruit", "workers", "hand", "shop"] as const) {
      const z = L[k];
      if (!active.includes(k)) g.fillStyle(0x000000, 0.42).fillRoundedRect(z.x, z.y, z.w, z.h, 12);
    }
    const glow = d.graphics();
    for (const k of active) {
      const z = L[k];
      glow.lineStyle(2.5, C.kin, 1).strokeRoundedRect(z.x - 1, z.y - 1, z.w + 2, z.h + 2, 13);
    }
    this.loops.push(this.tweens.add({ targets: glow, alpha: 0.35, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }));
  }

  /** 毎ターンの最初に、イベントの札を大きく見せる */
  private drawEventStep() {
    const s = this.s, d = this.d, ev = s.event;
    if (!ev) return;
    d.scrim(0.6);
    const w = 800, h = 440, x = W / 2 - w / 2, y = H / 2 - h / 2;
    d.card(x, y, w, h, C.washi, { ring: C.kin, r: 16 });
    d.hit(x, y, w, h, () => {});
    d.text(x + 36, y + 26, `${s.turn}ターン目`, S.strong, { color: T.dim });
    // 札
    const cw = 250, ch = 330;
    const { c, d: e } = d.group(x + 36 + cw / 2, y + 66 + ch / 2);
    const trouble = ev.kind === "トラブル";
    e.card(-cw / 2, -ch / 2, cw, ch, trouble ? C.washiDim : 0xfbf7ee, { ring: trouble ? C.shu : C.kin, r: 12 });
    e.text(-cw / 2 + 18, -ch / 2 + 18, ev.kind, S.body, { color: trouble ? T.shu : ev.kind === "選ぶ札" ? T.ai : T.green, bold: true });
    e.text(-cw / 2 + 18, -ch / 2 + 46, ev.title, 26, { font: F.mincho, bold: true, wrap: cw - 36 });
    e.text(-cw / 2 + 18, -ch / 2 + 140, ev.effect, S.strong, { wrap: cw - 36, lineSpacing: 5 });
    e.text(-cw / 2 + 18, ch / 2 - 28, ev.origin === "架空" ? "架空の出来事" : "実話がもと", S.small, { color: T.dim });
    c.scaleX = 0;
    this.tweens.add({ targets: c, scaleX: 1, duration: 380, delay: 100, ease: "Back.easeOut" });
    // 起きたこと、もとの話、引いた札
    const rx = x + 320, rw = w - 320 - 36;
    d.text(rx, y + 66, "起きたこと", S.body, { color: T.dim });
    d.text(rx, y + 90, s.message || ev.effect, 19, { wrap: rw, lineSpacing: 5 });
    if (ev.origin !== "架空") {
      d.text(rx, y + 170, "もとになった話", S.body, { color: T.dim });
      d.text(rx, y + 194, ev.origin, S.body, { wrap: rw, lineSpacing: 4 });
    }
    d.text(rx, y + 272, "山札から引いた札", S.body, { color: T.dim });
    this.drawn.forEach((m, i) => {
      d.material(rx + 18 + i * 110, y + 312, m, 16);
      d.text(rx + 40 + i * 110, y + 312, m, S.body, { bold: true, oy: 0.5 });
    });
    if (!this.drawn.length) d.text(rx, y + 300, "なし", S.body);
    d.button(x + w - 36 - 260, y + h - 30 - 56, 260, 56, `次へ：${NEXT_LABEL.event}`, () => this.goStep("hire"), { primary: true, size: S.title });
  }

  private work() {
    const s = this.s;
    this.act(() => A.work(s));
    if (s.lastShip.length) {
      // おはじきが埋まるのを見せてから出荷の画面を出す
      this.time.delayedCall(900, () => { this.modal = { type: "ship" }; this.render(); });
    }
  }

  // ---------- 重ねて出す画面

  private panel(w: number, h: number, ring: number = C.kin) {
    const d = this.d;
    d.scrim(0.6, () => { if (this.modal && this.modal.type !== "ship") { this.modal = null; this.render(); } });
    const x = W / 2 - w / 2, y = H / 2 - h / 2;
    d.card(x, y, w, h, C.washi, { ring, r: 16 });
    // パネルの中のタップで閉じないように受け止める
    d.hit(x, y, w, h, () => {});
    return { x, y };
  }

  private close = () => { this.modal = null; this.render(); };

  private drawModal(m: Modal) {
    switch (m.type) {
      case "sake": case "brew": return this.drawSakeModal(m.id, m.type === "brew" ? m : null);
      case "recruit": return this.drawRecruitModal(m.id);
      case "worker": return this.drawWorkerModal(m.id);
      case "event": return this.drawEventModal();
      case "ship": return this.drawShipModal();
      case "restart": return this.drawRestartModal();
    }
  }

  private drawSakeModal(id: SakeId, brewModal: { confirmQuit?: boolean } | null) {
    const s = this.s, d = this.d, sake = SAKE[id];
    const { x, y } = this.panel(820, 500);
    drawSakeLabel(d, x + 34, y + 34, 200, 432, id);
    const rx = x + 268, rw = 520;
    d.text(rx, y + 34, sake.name, S.big + 2, { font: F.mincho, bold: true });
    d.text(rx, y + 80, sake.say, 19, { wrap: rw, lineSpacing: 6 });
    let ry = y + 150;
    const row = (label: string) => { d.text(rx, ry, label, S.body, { color: T.dim }); };
    const plan = A.payPlan(s, sake);
    const brew = s.brews.find((b) => b.sake === id);
    row("必要な素材");
    const missing = [...plan.missing];
    needList(sake.needs).forEach((m, j) => {
      const k = missing.indexOf(m); const miss = k >= 0 && !brew; if (miss) missing.splice(k, 1);
      d.material(rx + 130 + j * 40, ry + 10, m, 16, { missing: miss });
    });
    if (!brew && plan.missing.length) d.text(rx + 130 + needList(sake.needs).length * 40 + 8, ry + 10, `足りない: ${plan.missing.join("・")}`, S.body, { color: T.shu, oy: 0.5 });
    ry += 44;
    row("仕込みのマス");
    for (let j = 0; j < sake.gauge; j++) d.marble(rx + 142 + j * 30, ry + 10, brew ? j < brew.filled : false, 11);
    ry += 40;
    row("売上");
    const sale = A.saleValue(s, sake, true);
    d.text(rx + 130, ry - 4, `${sake.revenue}両`, S.title, { color: T.shu, bold: true });
    const shipped = s.shipped[id] ?? 0;
    const now = sale.value !== sake.revenue ? `今出すと ${sale.value}両（${sale.notes.join("・")}）` : "";
    d.text(rx + 210, ry + 2, [now, shipped ? `出荷 ${shipped}回目まで済み` : ""].filter(Boolean).join("　"), S.body, { color: T.dim });
    ry += 40;
    row("得意な人");
    d.piece(rx + 146, ry + 10, sake.spec, 0.8);
    d.text(rx + 170, ry, `${sake.spec}（${ROLES[sake.spec].brief}）`, S.body);
    d.text(rx + 170, ry + 22, "蔵人はどの酒でも1マス", S.small, { color: T.dim });
    ry += 40;
    row("特徴");
    d.text(rx + 130, ry, sake.tags.join("・") || "なし", S.body);
    // ボタン
    const by = y + 500 - 34 - 52;
    if (brew) {
      d.button(rx, by, 240, 52, brewModal?.confirmQuit ? "本当にやめる" : "仕込みをやめる", () => {
        if (brewModal?.confirmQuit) { this.modal = null; this.act(() => A.quitBrew(s, id)); }
        else { this.modal = { type: "brew", id, confirmQuit: true }; this.render(); }
      }, { danger: true, disabled: !(this.inStep("brew") || this.inStep("place")), sub: brewModal?.confirmQuit ? "埋めたマスと素材は戻りません" : undefined, size: S.body });
    } else {
      const can = plan.missing.length === 0 && s.brews.length < BREW_MAX && this.inStep("brew");
      const why = s.phase !== "act" ? "このターンはもう仕込みました" : !this.inStep("brew") ? "「仕込む」の手順で仕込めます" : s.brews.length >= BREW_MAX ? "自分の蔵がいっぱいです" : plan.missing.length ? "取引先で買えます" : `手札から${plan.pay.length}枚払う`;
      d.button(rx, by, 240, 52, "仕込む", () => { this.modal = null; this.act(() => A.startBrew(s, id)); }, { primary: true, disabled: !can, sub: why, size: S.title });
    }
    d.button(rx + 280, by, 180, 52, "閉じる", this.close);
  }

  private drawRecruitModal(id: number) {
    const s = this.s, d = this.d;
    const r = s.field.find((x) => x.id === id);
    if (!r) { this.modal = null; return; }
    const def = ROLES[r.role];
    const { x, y } = this.panel(680, 380);
    d.piece(x + 110, y + 150, r.role, 3.2);
    d.text(x + 110, y + 250, r.role, S.title, { font: F.mincho, bold: true, ox: 0.5 });
    const rx = x + 220;
    d.text(rx, y + 36, r.name, S.big + 2, { font: F.mincho, bold: true });
    d.text(rx, y + 82, `「${r.line}」`, S.strong, { color: T.dim });
    d.text(rx, y + 126, def.effect, 19, { wrap: 420, lineSpacing: 6 });
    d.text(rx, y + 196, `契約金 ${def.fee}両　給料 毎ターン${SALARY}両`, S.strong, { color: T.shu, bold: true });
    d.text(rx, y + 228, "雇った人は手放せず、最後まで給料がかかります。", S.body, { color: T.dim, wrap: 420 });
    const can = s.money >= def.fee && this.inStep("hire");
    d.button(rx, y + 380 - 34 - 52, 220, 52, `${def.fee}両で雇う`, () => { this.modal = null; this.act(() => A.hire(s, id)); }, {
      primary: true, disabled: !can, size: S.title,
      sub: s.phase !== "act" ? "このターンはもう仕込みました" : !this.inStep("hire") ? "「雇う」の手順で雇えます" : s.money < def.fee ? "お金が足りません" : undefined,
    });
    d.button(rx + 250, y + 380 - 34 - 52, 160, 52, "閉じる", this.close);
  }

  private drawWorkerModal(id: number) {
    const s = this.s, d = this.d;
    const w = s.workers.find((x) => x.id === id);
    if (!w) { this.modal = null; return; }
    const def = ROLES[w.role];
    const { x, y } = this.panel(620, 300);
    d.piece(x + 96, y + 120, w.role, 2.6);
    const rx = x + 190;
    d.text(rx, y + 36, `${w.name}（${w.role}）`, S.title + 2, { font: F.mincho, bold: true });
    d.text(rx, y + 80, `「${w.line}」`, S.body, { color: T.dim });
    d.text(rx, y + 118, def.effect, 19, { wrap: 400, lineSpacing: 6 });
    d.text(rx, y + 176, def.kind === "ability" ? "置いてもマスは埋まりません。雇っているだけで効きます。" : w.hiredTurn ? `${w.hiredTurn}ターン目に雇った` : "はじめからいる", S.body, { color: T.dim, wrap: 400 });
    d.button(rx, y + 300 - 30 - 48, 160, 48, "閉じる", this.close);
  }

  private drawEventModal() {
    const s = this.s, d = this.d, ev = s.event;
    if (!ev) { this.modal = null; return; }
    const { x, y } = this.panel(680, 360);
    d.text(x + 40, y + 34, ev.kind, S.body, { color: ev.kind === "トラブル" ? T.shu : ev.kind === "選ぶ札" ? T.ai : T.green, bold: true });
    d.text(x + 40, y + 60, ev.title, 34, { font: F.mincho, bold: true });
    d.text(x + 40, y + 120, ev.effect, 20, { wrap: 600 });
    d.text(x + 40, y + 172, "もとになった話", S.body, { color: T.dim });
    d.text(x + 40, y + 198, ev.origin === "架空" ? "これは架空の出来事です。" : ev.origin, S.strong, { wrap: 600, lineSpacing: 5 });
    d.button(x + 40, y + 360 - 30 - 48, 160, 48, "閉じる", this.close);
    // どんな札があるかの割合
    const total = EVENTS.reduce((a, e) => a + e.weight, 0);
    d.text(x + 640, y + 360 - 30 - 24, `この札が出る確率 ${Math.round((ev.weight / total) * 100)}%`, S.small, { color: T.dim, ox: 1, oy: 0.5 });
  }

  /** 新しい山札で、1ターン目のイベントから始め直す。ページは読み込み直さない */
  private newGame() {
    this.modal = null;
    this.selectedWorker = null;
    this.discardSel = [];
    this.scene.restart({ seed: Math.floor(Math.random() * 100000) });
  }

  private drawRestartModal() {
    const s = this.s, d = this.d;
    const { x, y } = this.panel(600, 290);
    d.text(x + 40, y + 34, "最初からやり直しますか？", S.big, { font: F.mincho, bold: true });
    d.text(x + 40, y + 90, `いまは${s.turn}ターン目、所持金${s.money}両です。やり直すと、新しい山札と求人で1ターン目から始まり、いまの蔵は消えます。`, S.body + 1, { wrap: 520, lineSpacing: 5 });
    d.button(x + 40, y + 290 - 36 - 56, 240, 56, "最初からやり直す", () => this.newGame(), { danger: true, size: S.strong });
    d.button(x + 600 - 40 - 240, y + 290 - 36 - 56, 240, 56, "続ける", this.close, { primary: true, size: S.strong });
  }

  private drawShipModal() {
    const s = this.s, d = this.d;
    const rs = s.lastShip;
    if (!rs.length) { this.modal = null; return; }
    d.scrim(0.65);
    d.text(W / 2, 92, "出荷", 54, { font: F.brush, color: T.washi, ox: 0.5, oy: 0.5 });
    const cw = 300, ch = 330, gap = 24;
    const x0 = W / 2 - ((cw + gap) * rs.length - gap) / 2;
    rs.forEach((r, i) => {
      const sake = SAKE[r.sake];
      const { c, d: e } = d.group(x0 + i * (cw + gap) + cw / 2, 330);
      e.card(-cw / 2, -ch / 2, cw, ch, C.washi, { ring: C.kin, r: 14 });
      e.fit(e.text(0, -ch / 2 + 30, sake.name, S.title + 2, { font: F.mincho, bold: true, ox: 0.5, oy: 0.5 }), cw - 32);
      e.text(0, -ch / 2 + 92, `+${r.value}両`, S.huge, { color: T.shu, bold: true, ox: 0.5, oy: 0.5 });
      if (r.notes.length) e.text(0, -ch / 2 + 136, r.notes.join("・"), S.body, { color: T.shu, ox: 0.5, oy: 0.5 });
      e.graphics().lineStyle(1, 0x000000, 0.15).lineBetween(-cw / 2 + 24, -ch / 2 + 160, cw / 2 - 24, -ch / 2 + 160);
      e.text(-cw / 2 + 24, -ch / 2 + 176, sake.say, S.strong, { wrap: cw - 48, lineSpacing: 6 });
      e.text(0, ch / 2 - 24, `${(s.shipped[r.sake] ?? 1)}回目の出荷`, S.small, { color: T.dim, ox: 0.5, oy: 0.5 });
      c.setScale(0);
      this.tweens.add({ targets: c, scale: 1, duration: 340, delay: 140 * i, ease: "Back.easeOut", onStart: () => this.coins.explode(16, c.x, c.y - 80) });
    });
    const gain = rs.reduce((a, r) => a + r.value, 0);
    d.text(W / 2, 534, `売上 合計 +${gain}両　→　所持金 ${s.money}両`, S.title, { color: T.washi, bold: true, ox: 0.5, oy: 0.5 });
    d.button(W / 2 - 150, 574, 300, 56, "続ける", this.close, { primary: true, size: S.title });
  }

  private drawPending() {
    const s = this.s, d = this.d, p = s.pending!;
    const ev = s.event;
    const { x, y } = this.panel(720, 360);
    d.text(x + 36, y + 30, ev?.kind ?? "", S.body, { color: T.ai, bold: true });
    d.text(x + 36, y + 56, p.title, 32, { font: F.mincho, bold: true });
    d.text(x + 36, y + 110, s.message, 19, { wrap: 640 });
    if (ev && p.type !== "pickMaterials") d.text(x + 36, y + 150, `札の効果: ${ev.effect}`, S.body, { color: T.dim, wrap: 640 });
    if (p.type === "pickMaterials") {
      const list: Material[] = p.onlyRice ? [...RICES] : [...RICES, "麹", "酵母"];
      list.forEach((m, j) => {
        const bx = x + 36 + (j % 4) * 160, by = y + 170 + Math.floor(j / 4) * 70;
        d.button(bx, by, 148, 58, "", () => this.act(() => A.pickMaterial(s, m)));
        d.material(bx + 30, by + 29, m, 16);
        d.text(bx + 54, by + 29, m, S.strong, { bold: true, oy: 0.5 });
      });
    } else {
      const yes = { breakdown: "2両払う", interview: "受ける", newrice: "3両払う", tasting: "2両払う" }[p.type];
      const no = { breakdown: "マスを1つ戻す", interview: "断る", newrice: "見送る", tasting: "見送る" }[p.type];
      const yesSub = { breakdown: "", interview: "次の出荷 +4両、置ける人 −1", newrice: "好きな米を2枚", tasting: "次の出荷 ×1.5" }[p.type];
      d.button(x + 36, y + 360 - 36 - 64, 300, 64, yes, () => this.act(() => A.answerYes(s)), { primary: true, size: S.title, sub: yesSub || undefined });
      d.button(x + 720 - 36 - 300, y + 360 - 36 - 64, 300, 64, no, () => this.act(() => A.answerNo(s)), { size: S.title });
    }
  }

  private drawOver() {
    const s = this.s, d = this.d, o = s.over!;
    d.scrim(0.7);
    const w = 980, h = 640, x = W / 2 - w / 2, y = H / 2 - h / 2;
    d.card(x, y, w, h, C.washi, { ring: C.kin, r: 18 });
    d.hit(x, y, w, h, () => {});
    if (o.kind === "finish") {
      const rank = A.rankOf(s.money);
      d.text(x + 50, y + 36, `${TURNS}ターンを終えました`, S.strong, { color: T.dim });
      d.text(x + 50, y + 66, `${s.money}両`, 64, { color: T.shu, bold: true });
      d.text(x + w - 60, y + 40, rank, 120, { font: F.brush, color: T.sumi, ox: 1 });
      d.text(x + w - 200, y + 100, "ランク", S.strong, { color: T.dim, ox: 1 });
    } else {
      d.text(x + 50, y + 40, `${o.turn}ターン目で廃業`, 52, { font: F.brush, color: T.shu });
      d.text(x + 50, y + 116, "給料を払えませんでした。雇うのは、最初の出荷でお金ができてからが安全です。", S.body, { color: T.dim });
    }
    // 図鑑
    d.text(x + 50, y + 168, "造った酒", S.strong, { bold: true });
    const cw = 170, ch = 120;
    SAKES.forEach((sake, i) => {
      const cx = x + 50 + (i % 5) * (cw + 12), cy = y + 202 + Math.floor(i / 5) * (ch + 12);
      const n = s.shipped[sake.id] ?? 0;
      d.card(cx, cy, cw, ch, n ? C.washi : C.washiDark, { ring: n ? C.kin : null, alpha: n ? 1 : 0.6, r: 10 });
      d.fit(d.text(cx + 12, cy + 10, sake.short, S.body, { font: F.mincho, bold: true, color: n ? T.sumi : T.dim }), cw - 24);
      d.text(cx + 12, cy + 34, n ? sake.say : "まだ造っていない", S.flavor, { color: T.dim, wrap: cw - 24, lineSpacing: 2 });
      if (n) d.text(cx + cw - 12, cy + ch - 12, `×${n}`, S.number, { color: T.shu, bold: true, ox: 1, oy: 1 });
    });
    const made = SAKES.filter((k) => s.shipped[k.id]).length;
    d.text(x + w - 50, y + 168, `${made} / ${SAKES.length} 種類`, S.strong, { color: T.dim, ox: 1 });
    // 共有と案内
    const by = y + h - 110;
    d.button(x + 50, by, 240, 56, "結果をコピー", () => {
      void navigator.clipboard?.writeText(shareText(s)).then(() => { s.message = "結果をコピーしました。"; });
      this.toast("結果をコピーしました");
    }, { size: S.strong, sub: "LINE などに貼れます" });
    d.button(x + 310, by, 280, 56, "蔵元直送ショップを見る", () => window.open(SHOP_URL, "_blank", "noopener"), { size: S.strong, sub: "岩の井のお酒を見る（外部サイト）" });
    d.button(x + w - 50 - 240, by, 240, 56, "もう一度", () => this.newGame(), { primary: true, size: S.title });
    d.text(x + 50, y + h - 32, "20歳未満の者の飲酒は法律で禁止されています。ゲームの中では購入や決済は扱いません。", S.small, { color: T.dim });
  }

  private toast(msg: string) {
    const t = this.add.text(W / 2, H - 40, msg, { fontFamily: F.body, fontSize: "20px", color: T.washi, backgroundColor: "#2b2a28", padding: { x: 18, y: 10 } })
      .setResolution(DPR).setOrigin(0.5);
    this.fx.add(t);
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 400, onComplete: () => t.destroy() });
  }
}

// ---------- 小さな関数

function nextStep(step: Step): Step {
  const order: Step[] = ["event", "hire", "buy", "brew", "place"];
  return order[Math.min(order.length - 1, order.indexOf(step) + 1)]!;
}


const measureCache = new Map<string, number>();
function measure(scene: Phaser.Scene, str: string, size: number, bold = true): number {
  const key = `${str}|${size}|${bold}`;
  const hit = measureCache.get(key);
  if (hit !== undefined) return hit;
  const t = scene.make.text({ text: str, style: { fontFamily: F.body, fontSize: `${size}px`, fontStyle: bold ? "bold" : "normal" } }, false);
  const w = t.width;
  t.destroy();
  if (document.fonts.status === "loaded") measureCache.set(key, w);
  return w;
}

function shareText(s: GameState): string {
  const made = SAKES.filter((k) => s.shipped[k.id]).map((k) => k.short).join("、") || "なし";
  if (s.over?.kind === "bankrupt") return `岩瀬酒造 蔵元カードゲーム（試作）で${s.over.turn}ターン目に廃業。造った酒: ${made}`;
  return `岩瀬酒造 蔵元カードゲーム（試作）で${TURNS}ターン。所持金${s.money}両、ランク${A.rankOf(s.money)}。造った酒: ${made}`;
}

