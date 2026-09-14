import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: resolve(__dirname, "client"),
  server: {
    port: 3000,
    host: "0.0.0.0",
    cors: true,
    proxy: {
      "/api": "http://127.0.0.1:2567",
      "/avatars": "http://127.0.0.1:2567",
    },
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
