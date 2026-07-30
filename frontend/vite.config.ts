import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.CREA_ZIK_API_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    headers: {
      "Content-Security-Policy": "default-src 'self'; connect-src 'self' http://127.0.0.1:8001; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'",
    },
    proxy: {
      "/api": apiTarget,
      "/projects": apiTarget,
    },
  },
});
