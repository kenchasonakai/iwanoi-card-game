// 色、書体、文字の大きさ。盤面はすべてここの値を使う。

import type { Material } from "../game/cards.ts";

/** 盤面の設計上の大きさ。画面に合わせて拡大縮小する */
export const W = 1280, H = 720;
/** 高解像度の画面でにじまないように、この倍率で描いてカメラで拡大する */
export const DPR = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)));

// 和紙、墨、朱、金、藍。夜の蔵の板の間に札を並べる見立て
export const C = {
  bg: 0x15171b, board: 0x1f2a31, boardLine: 0x34444e, boardDeep: 0x182127,
  washi: 0xf3ede0, washiDim: 0xe2d9c6, washiDark: 0xcfc4ad, sumi: 0x2b2a28,
  shu: 0xb3412e, shuDeep: 0x8a2f21, kin: 0xd9b45b, kinDeep: 0xa8863a, ai: 0x2f4858, aiDeep: 0x223541,
  good: 0x8cc27a, glow: 0xf3d27a, shadow: 0x000000,
};

export const T = {
  washi: "#f3ede0", chalk: "#ddd6c7", chalkDim: "#9a9486", sumi: "#2b2a28", dim: "#6b665c",
  shu: "#b3412e", kin: "#e2c06a", red: "#e8735f", good: "#9fd18c", ai: "#3b6e8f", green: "#4f7a3f",
};

export const F = {
  body: '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic", sans-serif',
  mincho: '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", serif',
  brush: '"Yuji Syuku", "Shippori Mincho B1", serif',
};

/**
 * 文字の大きさ（設計上の px）。iPhone の横画面では約 0.54 倍に縮むので、
 * 遊ぶのに読む文字は 15 以上、飾りの文字でも 12 以上にする。
 */
export const S = {
  flavor: 12, small: 13, body: 15, strong: 17, number: 18, title: 22, big: 28, huge: 44,
};

export const MATERIAL_COLOR: Record<Material | "米", number> = {
  山田錦: 0xd8b85e, 五百万石: 0xe4d49a, 総の舞: 0xa9c47e, きたしずく: 0x93c0d0, 愛山: 0xdc9aa8,
  麹: 0xf6f1e3, 酵母: 0xc6b0dc, 米: 0xe8e2d0,
};

/** 素材の丸に書く 1 文字 */
export const MATERIAL_GLYPH: Record<Material | "米", string> = {
  山田錦: "山", 五百万石: "五", 総の舞: "総", きたしずく: "き", 愛山: "愛", 麹: "麹", 酵母: "酵", 米: "米",
};
