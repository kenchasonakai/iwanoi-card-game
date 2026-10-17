// 盤面のスクリーンショットと動きの GIF を撮る。設計書に貼る画像と、画面の確認に使う。
//   pnpm shot                      ビルドして vite preview で開き、docs/images/ に全部撮る
//   pnpm shot --only flow          名前に flow を含む場面だけ撮る
//   pnpm shot --base http://...    起動済みのサーバーや公開先を使う
//   SHOT_OUT=dir pnpm shot         保存先を変える
//
// 盤面は 1280×720 で設計しているので、pc の画角ではクリックの座標が盤面の座標と一致する。
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const OUT = process.env["SHOT_OUT"] ?? "docs/images";

const VIEWPORTS = {
  pc: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 },
  // iPhone 14 を横にしたときの大きさ
  phone: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
} as const;

type Step =
  | { click: [number, number] }
  | { wait: number }
  | { shot: string; note: string };

interface Scene {
  name: string;
  query: string;
  view: keyof typeof VIEWPORTS;
  steps: Step[];
  /** 録画して GIF にする */
  gif?: { file: string; width: number; fps: number };
}

// よく押す場所（盤面の座標）
const P = {
  fieldCard: (i: number): [number, number] => [302 + (i % 5) * 136 + 65, 98 + Math.floor(i / 5) * 82 + 38],
  sakeModalBrew: [618, 550] as [number, number],
  worker: (i: number): [number, number] => [1032 + (i % 5) * 48, 372 + Math.floor(i / 5) * 50],
  brewSlot: (i: number): [number, number] => [304 + i * 227 + 109, 306 + 109],
  main: [1133, 657] as [number, number],
  eventNext: [854, 522] as [number, number],
  shipContinue: [640, 602] as [number, number],
  recruit: (i: number): [number, number] => [1133, 131 + i * 64],
  handCard: (i: number): [number, number] => [151 + i * 86, 636],
  shop: (i: number): [number, number] => [721 + (i % 4) * 66 + 31, 578 + Math.floor(i / 4) * 66 + 31],
};

/** シード 19 の 1 ターン目を、手順どおりに進めて給料を払うまで */
const TURN_FLOW: Step[] = [
  { wait: 1200 },
  { shot: "flow-1-event", note: "① イベント。毎ターン最初に札がめくれ、山札から2枚引く" },
  { click: P.eventNext }, { wait: 700 },
  { shot: "flow-2-hire", note: "② 雇う。求人の場だけが光る" },
  { click: P.main }, { wait: 400 },
  { shot: "flow-3-buy", note: "③ 買う。取引先と、足りない素材が分かる酒の場が光る" },
  { click: P.main }, { wait: 400 },
  { shot: "flow-4-brew", note: "④ 仕込む。いまの手札で仕込める札が緑に光る" },
  { click: P.fieldCard(1) }, { wait: 500 },
  { shot: "flow-5-sake", note: "札をタップすると詳しく出て、ここから仕込む" },
  { click: P.sakeModalBrew }, { wait: 500 },
  { click: P.main }, { wait: 300 },
  { click: P.worker(0) }, { wait: 400 },
  { shot: "flow-6-place", note: "⑤ 置く。人を選ぶと、置いたときに埋まるマスが出る" },
  { click: P.brewSlot(0) }, { wait: 300 },
  { click: P.worker(1) }, { wait: 200 }, { click: P.brewSlot(0) }, { wait: 500 },
  { shot: "flow-7-placed", note: "2人を置いた" },
  { click: P.main }, { wait: 2000 },
  { shot: "flow-8-ship", note: "⑥ 出荷。おはじきが埋まって売れる。サミットの乾杯酒で1.5倍" },
  { click: P.shipContinue }, { wait: 500 },
  { shot: "flow-9-salary", note: "⑦ 給料を払って次のターンへ" },
  { click: P.main }, { wait: 1400 },
  { shot: "flow-10-turn2", note: "2ターン目のイベント" },
];

const SCENES: Scene[] = [
  { name: "title", query: "", view: "pc", steps: [{ wait: 1500 }, { shot: "title", note: "タイトル" }] },
  ...[1, 2, 3, 4, 5, 6, 7].map((n): Scene => ({ name: `rules-${n}`, query: `?rules=${n}`, view: "pc", steps: [{ wait: 600 }, { shot: `rules-${n}`, note: `ルール ${n}ページ目` }] })),
  { name: "flow", query: "?seed=19", view: "pc", steps: TURN_FLOW },
  {
    name: "gif-flow", query: "?seed=19", view: "pc", steps: TURN_FLOW.filter((s) => !("shot" in s)),
    gif: { file: "turn-flow.gif", width: 720, fps: 8 },
  },
  { name: "board", query: "?sample", view: "pc", steps: [{ shot: "board-sample", note: "7ターン目の見本" }] },
  { name: "recruit", query: "?sample", view: "pc", steps: [{ click: P.recruit(2) }, { wait: 1000 }, { shot: "modal-recruit", note: "求人の札の詳しい説明" }] },
  { name: "brew", query: "?sample", view: "pc", steps: [{ click: P.brewSlot(2) }, { wait: 1000 }, { shot: "modal-brew", note: "仕込み中の酒。縦書きのラベル" }] },
  { name: "event-choice", query: "?seed=3", view: "pc", steps: [{ wait: 800 }, { shot: "event-choice", note: "選ぶ札のイベント" }] },
  { name: "event-pick", query: "?seed=27", view: "pc", steps: [{ wait: 800 }, { shot: "event-pick", note: "素材を選んでもらうイベント" }] },
  { name: "discard", query: "?sample=discard", view: "pc", steps: [{ click: P.handCard(1) }, { wait: 800 }, { shot: "discard", note: "手札が5枚を超えたら捨てる" }] },
  { name: "end", query: "?sample=end", view: "pc", steps: [{ click: P.main }, { wait: 900 }, { shot: "end", note: "20ターンの終わり" }] },
  { name: "bankrupt", query: "?sample=bankrupt", view: "pc", steps: [{ click: P.main }, { wait: 900 }, { shot: "bankrupt", note: "廃業" }] },
  { name: "restart", query: "?sample", view: "pc", steps: [{ click: [486, 29] }, { wait: 600 }, { shot: "restart", note: "途中で最初からやり直す" }] },
  { name: "phone", query: "?sample", view: "phone", steps: [{ shot: "phone-sample", note: "スマホの横画面" }] },
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function waitFor(url: string, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(url)).ok) return; } catch { /* まだ */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`サーバーが起きません: ${url}`);
}

async function run(browser: Browser, base: string, sc: Scene) {
  const videoDir = join(OUT, `.video-${sc.name}`);
  rmSync(videoDir, { recursive: true, force: true }); // 前に失敗したときの録画を残さない
  const context = await browser.newContext({
    ...VIEWPORTS[sc.view],
    ...(sc.gif ? { deviceScaleFactor: 1, recordVideo: { dir: videoDir, size: VIEWPORTS[sc.view].viewport } } : {}),
  });
  const page: Page = await context.newPage();
  page.on("pageerror", (e) => console.error(`[${sc.name}] ページのエラー:`, e.message));
  page.on("console", (m) => { if (m.type() === "error") console.error(`[${sc.name}] console:`, m.text()); });
  const t0 = Date.now();
  await page.goto(`${base}/${sc.query}`);
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 40000 });
  const readyAt = (Date.now() - t0) / 1000;
  // Phaser は画面の大きさを 0.5 秒ごとに測り直すので、読み込み直後のタップは座標がずれることがある
  await page.waitForTimeout(1500);
  for (const st of sc.steps) {
    if ("click" in st) await page.mouse.click(st.click[0], st.click[1]);
    else if ("wait" in st) await page.waitForTimeout(st.wait);
    else {
      // ヘッドレスでは描き替えが画面に出る前に撮ってしまうことがあるので、2 フレーム待ってから撮る
      await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
      await page.screenshot({ path: join(OUT, `${st.shot}.png`) });
      console.log(`${join(OUT, `${st.shot}.png`)}  ${st.note}`);
    }
  }
  await page.waitForTimeout(sc.gif ? 600 : 0);
  await context.close();
  if (sc.gif) {
    const webm = readdirSync(videoDir).find((f) => f.endsWith(".webm"))!;
    const src = join(videoDir, webm), dst = join(OUT, sc.gif.file);
    const vf = `fps=${sc.gif.fps},scale=${sc.gif.width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`;
    const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", `${readyAt + 0.4}`, "-i", src, "-vf", vf, "-loop", "0", `${dst}.tmp.gif`]);
    if (r.status !== 0) throw new Error(`ffmpeg に失敗: ${r.stderr.toString()}`);
    renameSync(`${dst}.tmp.gif`, dst);
    rmSync(videoDir, { recursive: true, force: true });
    console.log(`${dst}  動き`);
  }
}

let server: ChildProcess | null = null;
let base = arg("base");
if (!base) {
  // 開発サーバーは最初の読み込みのあとに依存を作り直してページを読み直すことがあり、操作の途中で状態が消える。
  // 撮るときは本番と同じビルドを開く
  const b = spawnSync("pnpm", ["build"], { stdio: "inherit" });
  if (b.status !== 0) process.exit(1);
  // pnpm を通すと止めたときに中の vite が残るので、直接起動する
  server = spawn("node_modules/.bin/vite", ["preview", "--port", "5198", "--strictPort"], { stdio: "ignore" });
  base = "http://localhost:5198/iwanoi-card-game";
}
const only = arg("only");
try {
  await waitFor(`${base}/`);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" }); // 端末の Chrome を使う
  for (const sc of SCENES.filter((x) => !only || x.name.includes(only))) {
    // WSL ではネットワークが切り替わって読み込みが落ちる（ERR_NETWORK_CHANGED）ことがあるので、2 回まで撮り直す
    for (let attempt = 1; ; attempt++) {
      try { await run(browser, base, sc); break; } catch (e) {
        if (attempt >= 3) throw e;
        console.error(`[${sc.name}] 撮り直します（${attempt}回目の失敗）: ${(e as Error).message.split("\n")[0]}`);
      }
    }
  }
  await browser.close();
} finally {
  server?.kill();
}
