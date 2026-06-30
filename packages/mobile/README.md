# @appza/mobile

Capacitor mobile shell. Mounts `@appza/renderer` against the same bootstrap envelope the WP-plugin admin simulator consumes, so the **same TypeScript renderer code** drives both the plugin preview and the mobile APK.

## Architecture

```
[WP install]
  └── /wp-json/appza/v1/bootstrap?template=<slug>      ← snapshot envelope
  └── /wp-json/appza/v1/preview/data?ds=<slug>         ← live data proxy

[Renderer @ @appza/renderer]
  ScreenRenderer ── reads bootstrap envelope
                 ── useDataSource() hits preview proxy
                 ── shared Ionic primitives via PrimitiveRenderer

[@appza/plugin-admin]   ← WP admin preview pane
[@appza/mobile]         ← this package — APK shell
```

## Configure

Set the site URL at build/dev time via Vite env:

```bash
VITE_APPZA_SITE_URL=https://customer-site.example.com pnpm dev
VITE_APPZA_TEMPLATE=fluent-community-default pnpm dev
```

## Develop in browser

```bash
pnpm dev
```

Vite serves on http://127.0.0.1:5175.

## Build + sync to Android

```bash
pnpm build
pnpm cap:android
```

Requires:
- Android Studio + SDK (API 33+)
- `JAVA_HOME` pointing at JDK 17

First-time Android setup:

```bash
pnpm cap add android
pnpm build
pnpm cap:sync
pnpm cap:open:android   # opens Android Studio
```

## Notes

- The same `@appza/renderer` package is consumed here and in `@appza/plugin-admin`. Any rendering change lands once and shows up in both contexts.
- JWT auth (`/wp-json/appza/auth/v1/*`) is wired on the WP plugin side. The login screen for this shell is the next slice after this scaffold.
- Customizations come through the bootstrap envelope automatically — the same override cascade (DC#13 Q2) applies as in plugin-admin.
