import { defineConfig } from "vite";

export default defineConfig({
  // Nécessaire pour que Vite serve les WASM sans les transformer
  base: "/msdf-font-generator/",
  optimizeDeps: {
    exclude: ["three-msdf-text-utils"],
  },
  server: {
    headers: {
      // Requis pour les Web Workers avec SharedArrayBuffer si besoin
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
