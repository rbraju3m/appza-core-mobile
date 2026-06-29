# appza-mobile

APPZA 2.0 TypeScript monorepo. One repo, multiple packages — the shared renderer
that powers both the Capacitor mobile app and the WordPress-embedded
plug-in admin simulator.

## Packages

| Package | Purpose |
|---|---|
| `@appza/schemas` | Zod contracts (`packages/schemas`) — typed shape of the bootstrap envelope returned by the `appza-core-2.0` plug-in's `/wp-json/appza/v1/bootstrap` endpoint. |
| `@appza/plugin-admin` | Vite + React + Ionic app (`packages/plugin-admin`) — the WP-admin simulator. v1: bare end-to-end fetch + schema-validate. |

More packages land in later slices: `@appza/renderer`, `@appza/foundations`,
`@appza/components-*`, `@appza/templates-*`, `@appza/mobile`.

## Dev

```
pnpm install
pnpm --filter @appza/plugin-admin dev
```

The Vite dev server proxies `/wp-json/*` to the local WP install hosting
the `appza-core-2.0` plug-in, so the admin app can call the bootstrap
endpoint without CORS friction.

## Companion repos

- `/var/www/html/appza-core-2.0/` — Laravel core (catalog + snapshot export)
- `/var/www/html/wordpress-project/tutor-lms-mobile/wp-content/plugins/appza-core-2.0/` — the WP plug-in (bootstrap endpoint + admin pull)