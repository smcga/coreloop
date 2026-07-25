# 1.0 release checklist

- [ ] Issues 1–9 accepted; CI green; version numbers and compatibility expectations reviewed.
- [ ] Threshold Lab production build/deployment and normal URL verified.
- [ ] PWA install, offline reopen/update, both modules and complete runs verified on a supported phone.
- [ ] Starter independently tests/builds; Garden Loop wins and loses complete deterministic seasons.
- [ ] Seed links, save/migration and replay compatibility verified.
- [ ] Documentation links and clone-to-deploy tutorial dry run pass.
- [ ] `npm run check:no-binaries`; staged `--numstat` contains no `- -`; no generated output tracked.
- [ ] Changelog/release notes reviewed; create the `1.0` tag and GitHub release manually after merge.

## Draft release notes — 1.0 — Starter Kit

Core Loop 1.0 provides a deterministic command/event run framework, ordered effect system, validated content packs, policies and multiple gameplay modules. Versioned saves, migrations, canonical replay verification, simulation and inspection tools support safe iteration. Threshold Lab is an installable/offline-capable PWA; a reusable starter and distinct Garden Loop demonstrate theming without core changes. Known limitations: static hosting only, no cloud accounts/multiplayer/native wrappers, and SVG-only icons are not honoured by every platform integration.
