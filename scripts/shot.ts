// 盤面のスクリーンショットを撮る。設計書に貼る画像と、画面の確認に使う。
//   pnpm shot                 開発サーバーを起動して docs/images/ に撮る
//   pnpm shot http://host:port  起動済みのサーバーを使う
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const OUT = "docs/images";
const SHOTS: { name: string; query: string; note: string }[] = [
  { name: "board-sample", query: "?sample", note: "7ターン目の見本" },
  { name: "board-turn1", query: "?seed=1", note: "1ターン目" },
];

async function waitFor(url: string, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(url)).ok) return; } catch { /* まだ */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`サーバーが起きません: ${url}`);
}

let server: ChildProcess | null = null;
let base = process.argv[2];
if (!base) {
  server = spawn("pnpm", ["exec", "vite", "--port", "5199", "--strictPort"], { stdio: "ignore" });
  base = "http://localhost:5199";
}
try {
  await waitFor(base);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" }); // 端末の Chrome を使う
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.error("ページのエラー:", e.message));
  for (const s of SHOTS) {
    await page.goto(`${base}/${s.query}`);
    await page.waitForSelector("canvas");
    await page.waitForTimeout(1200); // 書体の読み込みと最初の描画を待つ
    await page.screenshot({ path: `${OUT}/${s.name}.png` });
    console.log(`${OUT}/${s.name}.png  ${s.note}`);
  }
  await browser.close();
} finally {
  server?.kill();
}
