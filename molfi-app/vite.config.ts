/// <reference types="vitest/config" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
// The app migrated from Sui/HashKey to HashKey Chain (EVM). A few legacy LeverX
// Sui trading modules still reference `@mysten/*`, but are not part of the
// HashKey market/bet flow, so those specifiers resolve to an inert local shim.
const mystenShim = path.resolve(appRoot, "src/lib/sui/mysten-shim.ts");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  return {
    define: envDefine,
    server: {
      host: "::",
      port: 8080,
    },
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
        // Neutralize removed Sui packages — legacy trading modules only.
        "@mysten/sui/jsonRpc": mystenShim,
        "@mysten/sui/transactions": mystenShim,
        "@mysten/sui/utils": mystenShim,
        "@mysten/wallet-standard": mystenShim,
        "@mysten/enoki": mystenShim,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    plugins: [
      tailwindcss(),
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
      }),
      react(),
      // Some deps still expect Node Buffer/global/process in the browser.
      nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
    ],
    test: {
      environment: "node",
      include: ["src/**/*.spec.ts"],
    },
  };
});
