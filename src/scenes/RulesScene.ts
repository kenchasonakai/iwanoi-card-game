// ルール説明。数ページをめくって読む。タイトルからも、盤面の「ルール」ボタンからも開く。

import Phaser from "phaser";
import { RANKS, ROLES, SAKE, TURNS, START_MONEY, type Role } from "../game/cards.ts";
import { Draw } from "../ui/draw.ts";
import { drawSakeCard } from "../ui/cards.ts";
import { C, DPR, F, H, S, T, W } from "../ui/theme.ts";

interface Data { from: "title" | "board"; page?: number }

const PAGES: { title: string; draw: (d: Draw, scene: RulesScene) => void }[] = [
  { title: "どんなゲーム？", draw: pageAbout },
  { title: "盤面の見方", draw: pageBoard },
  { title: "1ターンの流れ", draw: pageTurn },
  { title: "酒の札の見方", draw: pageSake },
  { title: "人を雇って置く", draw: pagePeople },
  { title: "出荷とお金", draw: pageMoney },
  { title: "はじめのコツ", draw: pageTips },
];

export class RulesScene extends Phaser.Scene {
  private from: Data["from"] = "title";
  private page = 0;
  private layer!: Phaser.GameObjects.Container;

  constructor() { super("rules"); }

  init(data: Data) {
    this.from = data?.from ?? "title";
    this.page = Math.min(PAGES.length - 1, Math.max(0, data?.page ?? 0));
  }

  create() {
    this.scale.refresh(); // 読み込み直後のタップの位置がずれないように、画面の大きさを測り直す
    this.cameras.main.setZoom(DPR).centerOn(W / 2, H / 2);
    this.layer = this.add.container(0, 0);
    this.render();
    const redraw = () => this.render();
    document.fonts.addEventListener("loadingdone", redraw);
    this.events.once("shutdown", () => document.fonts.removeEventListener("loadingdone", redraw));
    (window as unknown as Record<string, unknown>)["__ready"] = true;
  }

  private render() {
    this.layer.removeAll(true);
    const d = new Draw(this, this.layer);
    const g = d.graphics();
    g.fillStyle(C.bg, 1).fillRect(-200, -200, W + 400, H + 400);
    g.fillStyle(C.board, 1).fillRoundedRect(24, 24, W - 48, H - 48, 20);
    // 見出しと閉じる
    d.text(64, 48, "ルール", S.body, { color: T.chalkDim });
    d.text(64, 70, PAGES[this.page]!.title, 44, { font: F.brush, color: T.washi });
    d.button(W - 64 - 150, 52, 150, 44, this.from === "board" ? "盤面に戻る" : "タイトルへ", () => this.close(), { size: S.body });
    // 中身
    const { c, d: e } = d.group(0, 0);
    PAGES[this.page]!.draw(e, this);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 250 });
    // めくる
    PAGES.forEach((_, i) => {
      const x = W / 2 - (PAGES.length - 1) * 12 + i * 24;
      d.graphics().fillStyle(i === this.page ? C.kin : 0x45505a, 1).fillCircle(x, H - 64, i === this.page ? 6 : 4.5);
      d.hit(x - 10, H - 76, 20, 24, () => { this.page = i; this.render(); });
    });
    if (this.page > 0) d.button(64, H - 96, 180, 56, "← 前へ", () => { this.page--; this.render(); }, { size: S.strong });
    const last = this.page === PAGES.length - 1;
    d.button(W - 64 - 240, H - 96, 240, 56, last ? (this.from === "board" ? "盤面に戻る" : "はじめる") : "次へ →", () => {
      if (!last) { this.page++; this.render(); return; }
      if (this.from === "board") this.close();
      else this.scene.start("board", { seed: Math.floor(Math.random() * 100000) });
    }, { primary: true, size: S.title });
  }

  private close() {
    if (this.from === "board") {
      this.scene.stop();
      this.scene.resume("board");
    } else {
      this.scene.start("title");
    }
  }
}

// ---------- 各ページ。中身は y 140〜620 に収める

function lead(d: Draw, text: string, y = 140) {
  d.text(64, y, text, 21, { color: T.chalk, wrap: W - 128, lineSpacing: 6 });
}

function panel(d: Draw, x: number, y: number, w: number, h: number) {
  d.card(x, y, w, h, C.washi, { r: 14 });
}

function pageAbout(d: Draw) {
  lead(d, "岩瀬酒造（千葉県御宿町、銘柄「岩の井」）の蔵元になって、酒を造って売るゲームです。素材を集め、人を雇い、酒を仕込んで出荷します。");
  const items = [
    { big: `${TURNS}ターン`, sub: "1ターンで、雇う・買う・仕込む・置く・出荷・給料をひととおり。1回10〜15分。" },
    { big: `${START_MONEY}両から`, sub: "はじめは所持金12両と、蔵人が2人。雇った人には毎ターン給料がかかります。" },
    { big: "所持金が点数", sub: `${TURNS}ターン後の所持金でランクが決まります。給料が払えなくなったら廃業です。` },
  ];
  items.forEach((it, i) => {
    const x = 64 + i * 392, y = 240, w = 368, h = 300;
    panel(d, x, y, w, h);
    d.text(x + w / 2, y + 70, it.big, 46, { font: F.mincho, bold: true, color: T.shu, ox: 0.5, oy: 0.5 });
    if (i === 0) for (let k = 0; k < TURNS; k++) d.graphics().fillStyle(k < 7 ? C.kin : 0xcfc4ad, 1).fillCircle(x + 46 + k * 14.5, y + 128, 4.5);
    if (i === 1) { d.koban(x + w / 2 - 60, y + 128, 1.6); d.piece(x + w / 2 + 10, y + 128, "蔵人", 0.9); d.piece(x + w / 2 + 50, y + 128, "蔵人", 0.9); }
    if (i === 2) d.text(x + w / 2, y + 128, "S  A  B  C", S.title, { font: F.brush, color: T.sumi, ox: 0.5, oy: 0.5 });
    d.text(x + 28, y + 170, it.sub, S.strong, { wrap: w - 56, lineSpacing: 6 });
  });
  d.text(64, 568, "酒の札には、実際の受賞歴や味、合う料理が書いてあります。遊ぶうちに岩の井に少し詳しくなります。", S.strong, { color: T.kin });
}

function pageBoard(d: Draw) {
  // 盤面を 0.6 倍の見取り図にして、場所ごとに番号をふる
  const k = 0.6, ox = 64, oy = 140;
  const zones: { n: number; x: number; y: number; w: number; h: number; name: string; desc: string }[] = [
    { n: 1, x: 16, y: 66, w: 262, h: 468, name: "イベント", desc: "毎ターンの出来事と、いまやること" },
    { n: 2, x: 290, y: 66, w: 700, h: 196, name: "酒の場", desc: "造れる10種類の酒。タップで詳しく見て、仕込む" },
    { n: 3, x: 290, y: 274, w: 700, h: 260, name: "自分の蔵", desc: "仕込み中の酒。人を置いてマスを埋める" },
    { n: 4, x: 1002, y: 66, w: 262, h: 234, name: "求人の場", desc: "雇える人。3人ずつ並ぶ" },
    { n: 5, x: 1002, y: 312, w: 262, h: 222, name: "雇っている人", desc: "酒に置く駒" },
    { n: 6, x: 16, y: 546, w: 684, h: 166, name: "手札", desc: "山札から引いた素材（5枚まで）" },
    { n: 7, x: 712, y: 546, w: 278, h: 166, name: "取引先", desc: "素材を買う（1ターン2枚まで）" },
    { n: 8, x: 1002, y: 546, w: 262, h: 166, name: "手順と「次へ」", desc: "いまの手順が光る。押して進む" },
  ];
  const g = d.graphics();
  g.fillStyle(C.bg, 1).fillRoundedRect(ox, oy, W * k, H * k, 10);
  g.fillStyle(0x2c363d, 1).fillRoundedRect(ox + 8, oy + 6, W * k - 16, 24, 6);
  d.text(ox + W * k / 2, oy + 18, "ターン ・ 所持金 ・ 次の給料", S.flavor, { color: T.chalkDim, ox: 0.5, oy: 0.5 });
  zones.forEach((z) => {
    const x = ox + z.x * k, y = oy + z.y * k, w = z.w * k, h = z.h * k;
    g.fillStyle(C.board, 1).fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(1.5, C.kin, 0.7).strokeRoundedRect(x, y, w, h, 8);
    g.fillStyle(C.kin, 1).fillCircle(x + 16, y + 16, 11);
    d.text(x + 16, y + 16, `${z.n}`, S.small, { bold: true, ox: 0.5, oy: 0.5 });
    d.text(x + 32, y + 8, z.name, S.small, { color: T.chalk, bold: true });
  });
  const lx = ox + W * k + 28;
  zones.forEach((z, i) => {
    const y = oy + i * 54;
    d.graphics().fillStyle(C.kin, 1).fillCircle(lx + 12, y + 12, 12);
    d.text(lx + 12, y + 12, `${z.n}`, S.body, { bold: true, ox: 0.5, oy: 0.5 });
    d.text(lx + 34, y, z.name, S.strong, { color: T.washi, bold: true });
    d.text(lx + 34, y + 24, z.desc, S.small, { color: T.chalkDim, wrap: W - 64 - lx - 34 });
  });
}

function pageTurn(d: Draw) {
  const steps = [
    { name: "イベント", desc: "札がめくれて、すぐ効く。素材を2枚引く" },
    { name: "雇う", desc: "求人の場から人を雇う。給料は毎ターン1人1両" },
    { name: "買う", desc: "取引先で素材を2枚まで買う" },
    { name: "仕込む", desc: "酒の札を選び、素材を払って自分の蔵へ" },
    { name: "置く", desc: "雇っている人を、仕込み中の酒に置く" },
    { name: "出荷", desc: "置いた人の分だけおはじきが埋まり、埋まった酒が売れる" },
    { name: "給料", desc: "1人1両払って次のターンへ。手札は5枚まで" },
  ];
  const sx = 64 + 82, step = (W - 128 - 164) / (steps.length - 1);
  steps.forEach((st, i) => {
    const x = sx + i * step, y = 250;
    if (i < steps.length - 1) {
      const g = d.graphics().lineStyle(3, C.kin, 0.5);
      g.lineBetween(x + 50, y, x + step - 50, y);
      g.fillStyle(C.kin, 0.5).fillTriangle(x + step - 50, y, x + step - 60, y - 7, x + step - 60, y + 7);
    }
    const g = d.graphics();
    g.fillStyle(i === 0 || i >= 5 ? C.washiDim : C.kin, 1).fillCircle(x, y, 42);
    d.text(x, y - 10, `${i + 1}`, S.small, { bold: true, ox: 0.5, oy: 0.5, color: T.dim });
    d.text(x, y + 10, st.name, st.name.length >= 3 ? S.strong : S.title, { bold: true, ox: 0.5, oy: 0.5 });
    d.text(x - 74, y + 62, st.desc, S.body, { color: T.chalk, wrap: 148, lineSpacing: 4, align: "center" }).setX(x).setOrigin(0.5, 0);
  });
  // 雇う・買う・仕込むは、してもしなくてもいい
  const bx0 = sx + step - 44, bx1 = sx + step * 3 + 44;
  d.graphics().lineStyle(2, C.kin, 0.8).lineBetween(bx0, 192, bx1, 192).lineBetween(bx0, 192, bx0, 202).lineBetween(bx1, 192, bx1, 202);
  d.text((bx0 + bx1) / 2, 180, "ここは、してもしなくてもいい", S.body, { color: T.kin, ox: 0.5, oy: 0.5 });
  panel(d, 64, 440, W - 128, 120);
  d.text(92, 462, "画面の右下に手順の札があり、いまの手順が光ります。触る場所も光るので、光っているところを触って「次へ」で進みます。", S.strong, { wrap: W - 184, lineSpacing: 6 });
  d.text(92, 526, "前の手順には、手順の札をタップすると戻れます。", S.body, { color: T.dim });
}

function pageSake(d: Draw) {
  // 酒の札を 2.6 倍に拡大して、部分ごとに説明をつける
  const sake = SAKE["daiginjo"];
  const k = 2.6, cx = 330, cy = 360;
  const { d: e } = d.group(cx, cy, k);
  drawSakeCard(e, -65, -38, sake, { missing: ["山田錦"] });
  const left = cx - 65 * k, top = cy - 38 * k;
  const at = (px: number, py: number) => ({ x: left + px * k, y: top + py * k });
  const notes = [
    { p: at(8, 4), title: "酒の名前", desc: "実在する岩の井の酒です" },
    { p: at(8, 30), title: "必要な素材", desc: "仕込むときに手札から払う。赤い縁は、手札に足りない素材" },
    { p: at(124, 30), title: "得意な担当", desc: "酛＝酛屋、船＝船頭、守＝蔵守。得意な人は1人で2マス埋める" },
    { p: at(4, 54), title: "仕込みのマス", desc: "全部埋まると出荷できる。この酒は6マス" },
    { p: at(124, 54), title: "売上", desc: "出荷したときにもらえるお金" },
  ];
  const lx = 700;
  notes.forEach((n, i) => {
    const badge = (x: number, y: number) => {
      d.graphics().fillStyle(C.shu, 1).fillCircle(x, y, 15).lineStyle(2, C.washi, 1).strokeCircle(x, y, 15);
      d.text(x, y, `${i + 1}`, S.body, { color: T.washi, bold: true, ox: 0.5, oy: 0.5 });
    };
    badge(n.p.x, n.p.y);
    const y = 180 + i * 88;
    badge(lx + 15, y + 15);
    d.text(lx + 42, y, n.title, S.title, { color: T.washi, bold: true });
    d.text(lx + 42, y + 32, n.desc, S.body, { color: T.chalk, wrap: W - 64 - lx - 42 });
  });
  d.text(64, 150, "酒の場には10種類の酒が並びます。札をタップすると、味や受賞歴、いまの手札で仕込めるかが分かります。", S.strong, { color: T.chalk, wrap: 600, lineSpacing: 5 });
  d.text(64, 520, "同じ酒を2つ同時には仕込めません。出荷すると酒の場に戻り、また仕込めます。", S.body, { color: T.chalkDim, wrap: 560 });
}

function pagePeople(d: Draw) {
  const cols: { roles: Role[]; title: string; fee: string; desc: string }[] = [
    { roles: ["蔵人"], title: "蔵人", fee: `契約金 ${ROLES.蔵人.fee}両`, desc: "どの酒に置いても1マス埋める。はじめから2人いる" },
    { roles: ["酛屋", "船頭", "蔵守"], title: "酛屋・船頭・蔵守", fee: `契約金 ${ROLES.酛屋.fee}両`, desc: "得意な酒では2マス、ほかでは0マス。酛屋は山廃、船頭はi240と中汲み、蔵守は古酒が得意" },
    { roles: ["麹屋", "仕入れ係", "帳場", "営業"], title: "麹屋・仕入れ係・帳場・営業", fee: `契約金 ${ROLES.麹屋.fee}両`, desc: "置いてもマスは埋まらない。雇っているだけで、麹が少なくて済む、多く引けるなどの効果" },
  ];
  cols.forEach((c, i) => {
    const x = 64 + i * 392, y = 150, w = 368, h = 360;
    panel(d, x, y, w, h);
    const n = c.roles.length;
    c.roles.forEach((r, j) => d.piece(x + w / 2 + (j - (n - 1) / 2) * 70, y + 76, r, 1.7));
    d.text(x + w / 2, y + 140, c.title, c.title.length > 8 ? S.strong : S.title, { font: F.mincho, bold: true, ox: 0.5 });
    d.text(x + w / 2, y + 176, c.fee, S.strong, { color: T.shu, bold: true, ox: 0.5 });
    d.text(x + 28, y + 214, c.desc, S.body + 1, { wrap: w - 56, lineSpacing: 6 });
  });
  d.graphics().fillStyle(C.shu, 1).fillRoundedRect(64, 530, W - 128, 60, 12);
  d.text(W / 2, 560, "給料は全員、毎ターン1両。雇った人は手放せず、最後まで給料がかかります。", S.title, { color: T.washi, bold: true, ox: 0.5, oy: 0.5 });
}

function pageMoney(d: Draw) {
  // 値下がり
  panel(d, 64, 150, 560, 230);
  d.text(92, 168, "同じ酒は、出すほど安くなる", S.title, { bold: true });
  [["1回目", 1], ["2回目", 0.8], ["3回目から", 0.6]].forEach(([label, r], i) => {
    const x = 120 + i * 170, base = 352, hh = 120 * (r as number);
    d.graphics().fillStyle(C.shu, 0.85).fillRoundedRect(x, base - hh, 70, hh, 6);
    d.text(x + 35, base - hh - 22, `${Math.round((r as number) * 100)}%`, S.strong, { color: T.shu, bold: true, ox: 0.5 });
    d.text(x + 35, base + 6, label as string, S.small, { color: T.dim, ox: 0.5 });
  });
  d.text(596, 176, "営業がいると1段ゆるい", S.small, { color: T.dim, ox: 1 });
  // イベントの効果
  panel(d, 656, 150, 560, 230);
  d.text(684, 168, "イベントで売上が伸びる", S.title, { bold: true });
  let x = 684;
  for (const label of ["次の出荷 ×1.5", "次の山廃 ×1.5", "次の出荷 +3両"]) { x += d.chip(x, 214, label, C.kin, T.sumi) + 10; }
  d.text(684, 262, "持てる効果は1つだけ。その手番でいちばん高く売れる酒にかかります。持っている間に出た効果は何も起きません。", S.body, { wrap: 504, lineSpacing: 5 });
  // 廃業とランク
  panel(d, 64, 400, 560, 200);
  d.text(92, 418, "廃業", S.title, { bold: true, color: T.shu });
  d.text(92, 456, "給料を払うときにお金が足りないと、そこで終わりです。点数はつきません。0両ちょうどなら続けられます。", S.body, { wrap: 504, lineSpacing: 5 });
  panel(d, 656, 400, 560, 200);
  d.text(684, 418, `${TURNS}ターン後のランク（仮）`, S.title, { bold: true });
  RANKS.forEach(([min, r], i) => {
    const xx = 690 + i * 128;
    d.text(xx + 30, 486, r, 56, { font: F.brush, ox: 0.5, oy: 0.5 });
    d.text(xx + 30, 540, Number.isFinite(min) ? `${min}両〜` : "それ未満", S.body, { color: T.dim, ox: 0.5 });
  });
}

function pageTips(d: Draw) {
  const tips = [
    { t: "最初は蔵人2人で i240 を回す", d: "i240 は2マスで出荷できる。蔵人2人を置けば、そのターンに売れてお金になる" },
    { t: "雇うのは、最初の出荷のあと", d: "給料は最後までかかる。お金が少ないうちに雇うと、序盤に廃業しやすい" },
    { t: "来た人に合わせて酒を選ぶ", d: "酛屋が来たら山廃、蔵守が来たら古酒。得意な酒なら1人で2マス" },
    { t: "いろいろな酒を造る", d: "同じ酒は値下がりする。造った酒は最後に図鑑に並ぶ" },
    { t: "終盤は間に合う酒だけ", d: "仕込み途中の酒は、終わったときにお金にならない" },
  ];
  tips.forEach((tip, i) => {
    const col = i < 3 ? 0 : 1, row = i < 3 ? i : i - 3;
    const x = 64 + col * 584, y = 150 + row * 152, w = 560, h = 136;
    panel(d, x, y, w, h);
    d.graphics().fillStyle(C.shu, 1).fillCircle(x + 36, y + 36, 18);
    d.text(x + 36, y + 36, `${i + 1}`, S.strong, { color: T.washi, bold: true, ox: 0.5, oy: 0.5 });
    d.text(x + 66, y + 22, tip.t, S.title, { font: F.mincho, bold: true });
    d.text(x + 66, y + 62, tip.d, S.body, { wrap: w - 92, lineSpacing: 5 });
  });
  d.text(64 + 584, 150 + 2 * 152 + 30, "わからなくなったら、盤面の「ルール」ボタンでここに戻れます。", S.strong, { color: T.kin, wrap: 540 });
}
