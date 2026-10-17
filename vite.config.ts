import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// GitHub Pages は https://<user>.github.io/iwanoi-card-game/ に置かれるので、
// ビルドとその確認（vite preview）では base をリポジトリ名にする。
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/iwanoi-card-game/" : "/",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 2000, // Phaser 本体が 1MB を超えるため
    // ゲーム（/）と、ルールと資料のページ（/guide/）の 2 つを出す
    rollupOptions: { input: { main: here("./index.html"), guide: here("./guide/index.html") } },
  },
}));
