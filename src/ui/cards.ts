// 盤面とルール説明で同じ見た目にする札の描き方。

import { ROLES, SAKE, type Material, type Sake, type SakeId } from "../game/cards.ts";
import type { Draw } from "./draw.ts";
import { C, F, S, T } from "./theme.ts";

/** 必要な素材を 1 枚ずつ並べる。「どの米でも」は "米" */
export function needList(needs: Sake["needs"]): (Material | "米")[] {
  return Object.entries(needs).flatMap(([m, n]) => Array<Material | "米">(n ?? 0).fill(m === "ANY" ? "米" : (m as Material)));
}

export const SAKE_CARD = { w: 130, h: 76 };

/**
 * 酒の場の札（130×76）。左上を (x, y) に置く。
 * missing は手札に足りない素材で、その丸を赤く縁どる。
 */
export function drawSakeCard(d: Draw, x: number, y: number, sake: Sake, o: { missing?: (Material | "米")[]; brewing?: boolean; ready?: boolean } = {}) {
  const { w: cw, h: ch } = SAKE_CARD;
  const brewing = !!o.brewing;
  d.card(x, y, cw, ch, brewing ? C.washiDark : C.washi, { ring: o.ready ? C.good : null, alpha: brewing ? 0.55 : 1 });
  d.fit(d.text(x + 8, y + 6, sake.short, S.body, { font: F.mincho, bold: true, color: brewing ? T.dim : T.sumi }), cw - 16);
  const missing = [...(o.missing ?? [])];
  needList(sake.needs).forEach((m, j) => {
    const k = missing.indexOf(m);
    const miss = k >= 0 && !brewing;
    if (miss) missing.splice(k, 1);
    d.material(x + 18 + j * 23, y + 41, m, 10, { missing: miss });
  });
  // 得意な担当を小さな駒の字で
  d.graphics().fillStyle(C.kin, brewing ? 0.4 : 1).fillCircle(x + cw - 17, y + 41, 11);
  d.text(x + cw - 17, y + 41.5, ROLES[sake.spec].mark, S.small, { font: F.mincho, bold: true, ox: 0.5, oy: 0.5 });
  for (let j = 0; j < sake.gauge; j++) d.marble(x + 13 + (j % 4) * 11, y + 62 + Math.floor(j / 4) * 9 - (sake.gauge > 4 ? 4 : 0), false, 4.2);
  d.text(x + cw - 8, y + 62, brewing ? "仕込み中" : `${sake.revenue}両`, brewing ? S.small : S.number, { color: brewing ? T.dim : T.shu, bold: true, ox: 1, oy: 0.5 });
}

/** 酒の札を大きく。ラベルのように縦書きで名前を載せる */
export function drawSakeLabel(d: Draw, x: number, y: number, w: number, h: number, id: SakeId) {
  const sake = SAKE[id];
  const g = d.graphics();
  g.fillStyle(C.shadow, 0.35).fillRoundedRect(x + 3, y + 5, w, h, 12);
  g.fillStyle(C.sumi, 1).fillRoundedRect(x, y, w, h, 12);
  g.lineStyle(2, C.kin, 0.9).strokeRoundedRect(x + 8, y + 8, w - 16, h - 16, 8);
  const sp = sake.name.indexOf(" ");
  const head = sake.label?.head ?? (sp > 0 ? sake.name.slice(0, sp) : "");
  const body = sake.label?.body ?? (sp > 0 ? sake.name.slice(sp + 1) : sake.name);
  const scale = h / 432;
  if (head) d.fit(d.text(x + w / 2, y + 34 * scale, head, Math.round(S.strong * Math.max(0.8, scale)), { color: T.kin, bold: true, ox: 0.5, oy: 0.5 }), w - 28);
  // 縦書き。数字の並びは 1 行にまとめて横に置く（縦中横）
  const chars = body.replace(/ /g, "").match(/[0-9]+|./gu) ?? [];
  const size = Math.round((chars.length > 6 ? 34 : 40) * scale);
  d.text(x + w / 2, y + h / 2 + (head ? 14 * scale : 0), chars.join("\n"), size, { font: F.mincho, color: T.washi, bold: true, ox: 0.5, oy: 0.5, align: "center", lineSpacing: -4 * scale });
  d.text(x + w / 2, y + h - 30 * scale, "岩の井", Math.round(S.body * Math.max(0.8, scale)), { font: F.brush, color: T.kin, ox: 0.5, oy: 0.5 });
}
