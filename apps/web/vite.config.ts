import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

/**
 * Официальный плагин React Router вместо ручной настройки SSR (D-016).
 * Алиас `~` соответствует `paths` в tsconfig.json и указывает на `app/`.
 */
export default defineConfig({
  plugins: [reactRouter()],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
});
