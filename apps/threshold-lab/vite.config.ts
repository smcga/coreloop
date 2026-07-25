import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/coreloop/",
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.GITHUB_SHA?.slice(0, 7) ?? "development",
    ),
  },
  plugins: [
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "offline.html"],
      manifest: {
        id: "./",
        name: "Threshold Lab — Core Loop",
        short_name: "Threshold Lab",
        description:
          "A deterministic run-based score challenge and Core Loop test-bed.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        background_color: "#101827",
        theme_color: "#22d3ee",
        orientation: "any",
        categories: ["games", "developer"],
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,svg,json}"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "core-loop-navigation-v1",
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
