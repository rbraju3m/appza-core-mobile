# appza-core-mobile

APPZA 2.0 TypeScript monorepo. One repo, multiple packages — the shared
renderer that powers both the Capacitor mobile app and the WordPress-embedded
plug-in admin simulator.

Part of APPZA 2.0 — a no-code mobile app builder that turns any WordPress
site into a native mobile app via a single shared renderer.

## Packages

| Package | Purpose |
|---|---|
| `@appza/schemas` | Zod contracts (`packages/schemas`) — typed shape of the bootstrap envelope returned by the WP plug-in's `/wp-json/appza/v1/bootstrap` endpoint. Object-or-array defensive shapes per P31/P32 (PHP empty-array discipline). |
| `@appza/renderer` | The renderer (`packages/renderer`) — walks placements → AppZet → Superstructure → children; maps Ionic primitive slugs to React widgets; resolves the customizations cascade (token cascade + leaf-level REPLACE per P26 Part 4); emits Ionic CSS custom properties. |
| `@appza/plugin-admin` | Vite + React + Ionic app (`packages/plugin-admin`) — the WP-admin simulator. Three-pane layout (TopBar / Sidebar / DeviceFrame + Settings / Themes / Overrides). Built bundle syncs into the WP plug-in's `assets/admin/` via `pnpm build:plugin`. |

Future: `packages/mobile` (Capacitor + Ionic app shell consuming the same
`@appza/renderer` + `@appza/schemas`) — scaffold deferred until 1B.6 JWT auth.

## Stack

Node 20.19 · pnpm 9.15 · Turborepo 2.10 · TypeScript 5.6 · React 18.3 ·
Vite 5.4 · Ionic React 8.4 · Zod 3.23.

## Dev

```
pnpm install
pnpm --filter @appza/plugin-admin dev          # http://127.0.0.1:5174
pnpm --filter @appza/plugin-admin build:plugin # build + sync into the WP plug-in's assets/admin/
pnpm --filter @appza/schemas typecheck
pnpm --filter @appza/renderer typecheck
pnpm --filter @appza/plugin-admin typecheck
```

`build:plugin` syncs to `../wordpress-project/tutor-lms-mobile/wp-content/plugins/appza-core-2.0/assets/admin/`
by default; override with `APPZA_PLUGIN_DIR=/abs/path pnpm --filter @appza/plugin-admin build:plugin`.

The Vite dev server proxies `/wp-json/*` to the local WP install so the
simulator can call the bootstrap endpoint without CORS friction.

## Companion repos

| Repo | Role |
|---|---|
| [APPZA-2-0](https://github.com/nmkhan/APPZA-2-0) | Laravel core — catalog master library + snapshot export endpoint |
| [appza-core-plugin](https://github.com/rbraju3m/appza-core-plugin) | The WP plug-in — embeds the built `@appza/plugin-admin` bundle and serves the bootstrap envelope |
