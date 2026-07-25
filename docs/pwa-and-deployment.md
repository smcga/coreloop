# PWA, browser boundaries and deployment

Threshold Lab remains a normal website at `/coreloop/`. `vite-plugin-pwa` generates the hashed precache and service worker during production builds. The manifest uses base-aware `./` ID, start URL, scope and SVG icon paths. Versioned JS/CSS/HTML/SVG/JSON assets are precached; navigations use network-first with a short timeout and cached shell fallback. Workbox removes obsolete precaches. No third-party or imported save/replay text is cached.

Registration is disabled in Vite development. The status notice distinguishes preparation, offline readiness, offline play, registration failure and a waiting update. “Ready for offline use” is shown only after Workbox reports completion. A waiting build is applied only through **Save and reload**; framework commands already autosave coherent transitions. Active encounters are never reloaded silently. Network-only update checks fail without preventing packaged play.

`BrowserAudioActivation` is a reusable host-only boundary: it reports unavailable/locked/ready/failed and creates/resumes `AudioContext` only after a pointer gesture. It never enters a save or affects RNG, and gameplay does not depend on it.

The only icon is readable UTF-8 SVG with maskable padding. Some platforms—notably integrations expecting PNG or an Apple touch icon—may show a generic icon. Binary derivatives are intentionally prohibited.

## Deploy

`deploy-pages.yml` runs the lockfile install and complete validation suite on `main`, uploads only `apps/threshold-lab/dist`, and uses supported Pages permissions. Configure another app's Vite `base`, build its workspace, upload only its `dist`, and keep production source maps disabled unless deliberately reviewed. Pull requests validate but never deploy production.

After one online load reports ready, test reopening offline, both modules, an existing save, shops and completion. Installation and service-worker lifecycle require a supported secure browser; localhost is treated as secure for testing.
