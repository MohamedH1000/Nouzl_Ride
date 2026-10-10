# Nouzl Ride

Ride hailing for Saudi Arabia: one Expo app with a rider mode and a captain mode. Ride logic lives in `Nouzl_Backend/src/rides` (behind `RIDES_ENABLED`), operations in nouzl_admin, shared pure rules in `nouzl_rules`. Product source of truth: `docs/ar/prd.md`, plan in `docs/scope/scope.md`.

## Stack

- **Language / Runtime**: TypeScript (strict), Node 20+
- **Framework**: Expo SDK 57, React Native 0.86, React 19.2, expo-router (groups `(rider)`, `(captain)`), dev client builds
- **Key dependencies**: NativeWind 4 (+ css interop patch), TanStack Query 5, i18next (Arabic first RTL + English), Supabase JS, react-native-maps (Google) when maps land
- **Backend**: NestJS 11 modular monolith in Nouzl_Backend, shared Supabase Postgres (`ride_` tables, RLS), Redis + BullMQ, socket.io `/rides`
- **Package manager**: npm workspaces (`apps/ride`, `packages/*`)
- Full decision and hard rules: [spec 0001](docs/specs/0001-stack-architecture/index.md)

## Build approach

**Tracer Bullet**: prove one real ride end to end through app, backend, database and admin, then thicken one segment at a time.

## Commands

```bash
npm install                 # install (runs patch-package)
npm run ride                # Expo dev server (apps/ride)
npm run typecheck           # tsc in every workspace
npm run sync:mobile         # refresh synced packages from ../nouzl_mobile
npm run check:synced        # fail if a synced package was edited here
npm run lint                # expo lint (set up by /develop tooling)
npm test                    # jest-expo (set up by /test)
```

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md` (or `NNNN-title/index.md`).

## Rules

- Functional style: pure functions by default, immutable data (`const`, `readonly`), side effects (network, storage, location, time) at the edges; no classes where a function works, no shared mutable state.
- Expected failures return typed results (`{ ok: true, data } | { ok: false, error }`); one error pattern for API and network calls; users see an i18n message key, never a raw error.
- TypeScript strict, no `any` (use `unknown` and narrow); exhaustive `switch` on unions such as ride status and app mode.
- Folders by feature: routes only in `apps/ride/src/app/`, feature code in `apps/ride/src/features/<feature>/`, shared ride code in `packages/ride-*`.
- `packages/{theme,ui,i18n,auth,api,config,types}` are read only copies of nouzl_mobile: change them there, then `npm run sync:mobile`. Never edit them here.
- Validate env with zod at startup (app `EXPO_PUBLIC_*` config and backend module env); a missing key fails loudly.
- The app never sends a price, distance or fee; money is integer halalas; every money or state change sends an `Idempotency-Key`.
- Accessibility WCAG AA: label and role on every control, 44pt touch targets (bigger for captain driving buttons), direction based RTL layout (no physical left or right).
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).

## Tooling

To be installed by `/develop tooling`: `expo lint` (eslint-config-expo flat config) + Prettier, synced packages ignored; husky + lint-staged pre-commit running format, lint and typecheck; jest-expo + React Native Testing Library (backend ride code uses Nouzl_Backend's Jest); GitHub Actions on push and PR (check synced, install, lint, typecheck, test), copied from nouzl_mobile's `ci.yml`.

## Git

- integration: on
- branch prefix: feat/
- commit: per-milestone

## Agent skills

- [styling-nativewind-v4-expo](.claude/skills/styling-nativewind-v4-expo/): `tristanmanchester/agent-skills`, NativeWind 4 setup, className interop, theming
- [react-native-maps](.claude/skills/react-native-maps/): `gmi-software/better-skills`, MapView, markers, polylines, Google provider
- [tanstack-query](.claude/skills/tanstack-query/): `tanstack-skills/tanstack-skills`, server state, caching, retries
- [i18next-localization](.claude/skills/i18next-localization/): `i18next/i18next-cli`, i18n keys and translation flow
- [sentry-react-native-sdk](.claude/skills/sentry-react-native-sdk/): `getsentry/sentry-agent-skills`, crash and error monitoring in Expo
- [nestjs-best-practices](.claude/skills/nestjs-best-practices/): `kadajett/agent-nestjs-skills`, backend `src/rides` modules (in Nouzl_Backend)
- [bullmq](.claude/skills/bullmq/): `dobroslavradosavljevic/skills`, offer timers and jobs (backend)
- [redis-connections](.claude/skills/redis-connections/): `redis/agent-skills`, Redis client, GEO and keys (backend)
- [postgis](.claude/skills/postgis/): `postgis/postgis`, service areas and ride trail (database)

Plugin: `expo` (expo-router, EAS build, update and submit skills). MCP servers: Supabase (connected), Expo (needs sign in), Sentry and Redis (recommended once those services exist). Declined: `tivojn/google-maps-api`.

## Context files

- [apps/ride/AGENTS.md](apps/ride/AGENTS.md) (the Expo app: Expo SDK rules, routing, EAS)
- [.claude/skills/verify/SKILL.md](.claude/skills/verify/SKILL.md) (how to run and drive the app and the rides module for verification)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
