import { defineConfig } from "vite";

// GitHub Pages は https://<user>.github.io/iwanoi-card-game/ に置かれるので、
// ビルドとその確認（vite preview）では base をリポジトリ名にする。
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/iwanoi-card-game/" : "/",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 2000, // Phaser 本体が 1MB を超えるため
  },
}));
