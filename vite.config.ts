import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    react(),
  ],
  server: {
    host: "0.0.0.0",
    allowedHosts: [
      "clause-graph-production.up.railway.app",
      ".railway.app",
      ".up.railway.app",
      "clause-graph.onrender.com",
      ".onrender.com",
      "localhost",
      "127.0.0.1",
    ],
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: [
      "clause-graph-production.up.railway.app",
      ".railway.app",
      ".up.railway.app",
      "clause-graph.onrender.com",
      ".onrender.com",
      "localhost",
      "127.0.0.1",
    ],
  },
});

