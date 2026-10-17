// 盤面の部品。どれも container に足して返すので、描き直すときは container を空にすればよい。

import Phaser from "phaser";
import { ROLES, type Material, type Role } from "../game/cards.ts";
import { C, DPR, F, MATERIAL_COLOR, MATERIAL_GLYPH, S, T } from "./theme.ts";
import { wrapJa } from "./wrap.ts";

export interface TextOpts {
  font?: string; color?: string; bold?: boolean; ox?: number; oy?: number; wrap?: number; align?: "left" | "center" | "right"; lineSpacing?: number;
}

export interface ButtonOpts { primary?: boolean; disabled?: boolean; size?: number; sub?: string; danger?: boolean }

export class Draw {
  private scene: Phaser.Scene;
  layer: Phaser.GameObjects.Container;
  /** 入れ物ごと拡大して描くときの倍率。文字をその分だけ細かく描いて、にじまないようにする */
  private res: number;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, res = 1) {
    this.scene = scene;
    this.layer = layer;
    this.res = res;
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.add(o);
    return o;
  }

  text(x: number, y: number, str: string, size: number, o: TextOpts = {}) {
    const family = o.font ?? F.body;
    const font = `${o.bold ? "bold " : ""}${size}px ${family}`;
    const t = this.scene.add.text(x, y, str, {
      fontFamily: family, fontSize: `${size}px`, color: o.color ?? T.sumi,
      fontStyle: o.bold ? "bold" : "normal", align: o.align ?? "left", lineSpacing: o.lineSpacing ?? 2,
      wordWrap: o.wrap ? { width: o.wrap, callback: (s: string) => wrapJa(s, o.wrap!, font) } : undefined,
    });
    t.setResolution(DPR * this.res);
    t.setOrigin(o.ox ?? 0, o.oy ?? 0);
    return this.add(t);
  }

  /** 文字が maxW より広ければ、横に縮めて収める */
  fit<T extends Phaser.GameObjects.Text>(t: T, maxW: number): T {
    if (t.width > maxW) t.setScale(maxW / t.width, Math.max(0.82, maxW / t.width));
    return t;
  }

  graphics() {
    return this.add(this.scene.add.graphics());
  }

  /** 札。影つきの角丸 */
  card(x: number, y: number, w: number, h: number, fill: number = C.washi, o: { ring?: number | null; r?: number; alpha?: number; shadow?: boolean } = {}) {
    const g = this.graphics();
    const r = o.r ?? 10;
    if (o.shadow !== false) g.fillStyle(C.shadow, 0.28).fillRoundedRect(x + 2, y + 4, w, h, r);
    g.fillStyle(fill, o.alpha ?? 1).fillRoundedRect(x, y, w, h, r);
    // 和紙の縁
    g.lineStyle(1, 0x000000, 0.08).strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
    if (o.ring != null) g.lineStyle(3, o.ring, 1).strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, r + 1);
    return g;
  }

  /** 場の区切り。左上に名前、右上に補足 */
  zone(x: number, y: number, w: number, h: number, title: string, sub = "") {
    const g = this.graphics();
    g.fillStyle(C.boardDeep, 0.55).fillRoundedRect(x, y, w, h, 12);
    g.lineStyle(1.5, C.boardLine, 1).strokeRoundedRect(x, y, w, h, 12);
    this.text(x + 12, y + 6, title, S.body, { font: F.brush, color: T.chalk });
    if (sub) this.text(x + w - 12, y + 8, sub, S.small, { color: T.chalkDim, ox: 1 });
  }

  /** タップできる透明な面。container の中に置き、ほかの部品より上で受ける */
  hit(x: number, y: number, w: number, h: number, onTap: () => void) {
    const z = this.scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on("pointerup", onTap);
    return this.add(z);
  }

  button(x: number, y: number, w: number, h: number, label: string, onTap: () => void, o: ButtonOpts = {}) {
    const g = this.graphics();
    const fill = o.disabled ? 0x454b52 : o.primary ? C.kin : o.danger ? C.shu : C.washi;
    if (!o.disabled) g.fillStyle(C.shadow, 0.3).fillRoundedRect(x + 1, y + 3, w, h, 10);
    g.fillStyle(fill, 1).fillRoundedRect(x, y, w, h, 10);
    if (o.primary && !o.disabled) g.lineStyle(2, C.glow, 1).strokeRoundedRect(x, y, w, h, 10);
    const color = o.disabled ? "#8a8f95" : o.danger ? T.washi : T.sumi;
    const size = o.size ?? S.strong;
    this.text(x + w / 2, y + (o.sub ? h / 2 - size * 0.42 : h / 2), label, size, { color, bold: true, ox: 0.5, oy: 0.5 });
    if (o.sub) this.text(x + w / 2, y + h / 2 + size * 0.62, o.sub, S.small, { color: o.disabled ? "#8a8f95" : o.danger ? T.washi : T.dim, ox: 0.5, oy: 0.5 });
    if (!o.disabled) this.hit(x, y, w, h, onTap);
    return g;
  }

  chip(x: number, y: number, label: string, fill: number, color: string) {
    const t = this.scene.add.text(0, 0, label, { fontFamily: F.body, fontSize: `${S.body}px`, color, fontStyle: "bold" }).setResolution(DPR);
    const g = this.graphics();
    g.fillStyle(fill, 1).fillRoundedRect(x, y, t.width + 24, 30, 15);
    t.setPosition(x + 12, y + 15).setOrigin(0, 0.5);
    this.add(t);
    return t.width + 24;
  }

  /** おはじき。埋まっていれば朱、空なら薄い穴 */
  marble(x: number, y: number, on: boolean, r: number, alpha = 1) {
    // 中心を原点に描き、位置で動かす（大きさのトゥイーンが中心から効くように）
    const g = this.graphics().setPosition(x, y).setAlpha(alpha);
    if (on) {
      g.fillStyle(C.shuDeep, 1).fillCircle(0, r * 0.12, r);
      g.fillStyle(C.shu, 1).fillCircle(0, 0, r);
      g.fillStyle(0xffffff, 0.4).fillCircle(-r * 0.32, -r * 0.32, r * 0.32);
    } else {
      g.fillStyle(0x000000, 0.1).fillCircle(0, 0, r);
      g.lineStyle(1.2, 0x000000, 0.22).strokeCircle(0, 0, r);
    }
    return g;
  }

  /** 中心を (x, y) に置いた入れ物。中の部品は中心からの位置で描く */
  group(x: number, y: number, scale = 1): { c: Phaser.GameObjects.Container; d: Draw } {
    const c = this.add(this.scene.add.container(x, y).setScale(scale));
    return { c, d: new Draw(this.scene, c, this.res * scale) };
  }

  /** 人の駒。将棋の駒の形に 1 文字。基準の大きさは幅 32 */
  piece(x: number, y: number, role: Role, scale = 1) {
    const c = this.scene.add.container(x, y).setScale(scale);
    const def = ROLES[role];
    const fill = def.kind === "any" ? 0xead7ad : def.kind === "spec" ? 0xdcb65c : 0xb5c6d3;
    const g = this.scene.add.graphics();
    const shape = (dx: number, dy: number) => {
      g.beginPath();
      g.moveTo(dx, dy - 18); g.lineTo(dx + 13, dy - 10); g.lineTo(dx + 16, dy + 18); g.lineTo(dx - 16, dy + 18); g.lineTo(dx - 13, dy - 10);
      g.closePath(); g.fillPath();
    };
    g.fillStyle(C.shadow, 0.35); shape(1, 3);
    g.fillStyle(fill, 1); shape(0, 0);
    g.lineStyle(1, 0x000000, 0.25);
    g.beginPath(); g.moveTo(0, -18); g.lineTo(13, -10); g.lineTo(16, 18); g.lineTo(-16, 18); g.lineTo(-13, -10); g.closePath(); g.strokePath();
    c.add(g);
    c.add(this.scene.add.text(0, 3, def.mark, { fontFamily: F.mincho, fontSize: "17px", color: T.sumi, fontStyle: "bold" }).setResolution(DPR * this.res * Math.max(1, scale)).setOrigin(0.5));
    return this.add(c);
  }

  /** 素材の丸。色と 1 文字で見分ける */
  material(x: number, y: number, m: Material | "米", r = 11, o: { missing?: boolean } = {}) {
    const g = this.graphics();
    g.fillStyle(MATERIAL_COLOR[m], o.missing ? 0.35 : 1).fillCircle(x, y, r);
    g.lineStyle(1.2, o.missing ? C.shu : 0x000000, o.missing ? 0.9 : 0.3).strokeCircle(x, y, r);
    this.text(x, y + 0.5, MATERIAL_GLYPH[m], Math.round(r * 1.15), { font: F.mincho, bold: true, color: o.missing ? T.dim : T.sumi, ox: 0.5, oy: 0.5 });
    return g;
  }

  koban(x: number, y: number, scale = 1) {
    const g = this.graphics();
    g.fillStyle(C.kinDeep, 1).fillEllipse(x, y + 1.5 * scale, 22 * scale, 15 * scale);
    g.fillStyle(C.kin, 1).fillEllipse(x, y, 20 * scale, 13 * scale);
    g.lineStyle(1, C.kinDeep, 0.8).lineBetween(x - 4 * scale, y - 3 * scale, x - 4 * scale, y + 3 * scale).lineBetween(x + 4 * scale, y - 3 * scale, x + 4 * scale, y + 3 * scale);
    return g;
  }

  /** 画面全体を暗くして、下の盤面のタップを止める */
  scrim(alpha = 0.6, onTap?: () => void) {
    const r = this.scene.add.rectangle(0, 0, 4000, 4000, 0x000000, alpha).setOrigin(0.5).setInteractive();
    if (onTap) r.on("pointerup", onTap);
    return this.add(r);
  }
}
