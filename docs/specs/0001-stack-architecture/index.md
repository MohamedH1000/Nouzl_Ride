# 0001. Stack and architecture for Nouzl Ride

**Date**: 2026-10-10
**Status**: Accepted

## Summary

Nouzl Ride is one Expo app (the same React Native toolkit as nouzl_mobile and Nouzl Delivery) with a rider mode and a captain mode. All ride logic runs as a new, switchable `rides` area inside the existing Nouzl_Backend, on the same Supabase database and Nouzl accounts, and it shares the infrastructure Nouzl Delivery is setting up (one Redis, one worker process, one staging database, one WhatsApp sign in hook) while keeping its own code, tables and switch. Captains send their location in the background for the whole online shift so matching always knows who is nearby, navigate with Google Maps or Waze, and riders can share a live trip page hosted on the Nouzl website. Building follows the same proven pieces as Delivery, so most of the work is ride rules, not plumbing.

## Decision

**Chosen option**: Option 1: Mirror the Delivery stack on the shared Nouzl platform (details in [rationale.md](rationale.md)).

Build Nouzl Ride as an Expo SDK 57 app in its own repo that shares nouzl_mobile code as synced read only copies, and run all ride logic as one flag gated `src/rides/` area inside Nouzl_Backend, on the shared Supabase database, reusing the Redis, worker process, staging branch and OTP hook defined by Nouzl Delivery spec 0001.

**Implementation skills**: `expo-overview`, `expo-router`, `expo-dev-client`, `eas-app-stores`, `eas-workflows`, `eas-update` (the `expo` plugin) · `styling-nativewind-v4-expo` (`tristanmanchester/agent-skills`, `.claude/skills/styling-nativewind-v4-expo/`) · `react-native-maps` (`gmi-software/better-skills`, `.claude/skills/react-native-maps/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `i18next-localization` (`i18next/i18next-cli`, `.claude/skills/i18next-localization/`) · `sentry-react-native-sdk` (`getsentry/sentry-agent-skills`, `.claude/skills/sentry-react-native-sdk/`) · `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.claude/skills/nestjs-best-practices/`) · `bullmq` (`dobroslavradosavljevic/skills`, `.claude/skills/bullmq/`) · `redis-connections` (`redis/agent-skills`, `.claude/skills/redis-connections/`) · `postgis` (`postgis/postgis`, `.claude/skills/postgis/`) · Supabase MCP (connected) for migrations on the staging branch.

## Proposed stack

Ride copies Nouzl Delivery spec 0001 (`nouzl_delivery/docs/specs/0001-stack-architecture/index.md`) layer for layer. The tables below restate every layer so a build needs only this file; rows marked **Ride** differ from Delivery.

### Mobile app (`nouzl_ride`)

| Layer | Choice | Reason |
|---|---|---|
| Framework | Expo SDK 57, React Native 0.86, React 19.2, TypeScript, dev client builds | Same versions as nouzl_mobile and Delivery, so patches and EAS setup carry over; background location and maps need a dev client, not Expo Go. |
| Repo shape | npm workspaces at the repo root (next to `docs/`): `apps/ride` + `packages/*` | Mirrors nouzl_mobile, so synced packages keep their `@nouzl/*` import names. |
| Code sharing | Synced read only copies of nouzl_mobile `theme`, `ui`, `i18n`, `auth`, `api`, `config`, `types`, **and the new `phone-auth`**; `nouzl_rules` through its own sync | Same hash checked model as spec 0002 (shared rules standard). See *Sync contract*. |
| Ride specific code (**Ride**) | Lives in `apps/ride` or new `packages/ride-*` (for example `ride-location`, `ride-map`). Map, location and socket code is built here first and extracted into a shared nouzl_mobile package only after Delivery and Ride both have working versions | Avoids designing a shared abstraction from one example. |
| Navigation | expo-router, route groups `(auth)`, `(rider)`, `(captain)` | Each mode gets its own stack; `(captain)` is locked until onboarding is approved (feature 7). |
| Mode switch | Opens in rider mode the first time; last used mode stored on the device; switch in profile plus a header toggle for approved captains. The switch is blocked while the captain is online, has an open offer, or is on a ride (go offline first). "Captain approved" is enforced by the backend and RLS, never only by the app | One account, both roles, and no half state where tracking stops mid ride. |
| Styling | NativeWind 4 with the synced Nouzl theme tokens; the `patch-package` css interop patch and the `react-native-css-interop` 0.2.6 override carried over | Reuses the `ui` package with its known quirks already fixed. |
| Server state | TanStack Query 5 | Same as nouzl_mobile; caching and retry. |
| Device storage | Chunked SecureStore adapter (from `@nouzl/api`) for the session; AsyncStorage for active ride id, last mode, online state and settings | Tokens stay encrypted; the app restores an active ride after a restart. |
| i18n | i18next, Arabic first RTL plus English (synced `@nouzl/i18n`) | Same RTL rules as nouzl_mobile (direction based text, no physical alignment). |
| Maps | react-native-maps with the Google provider on iOS and Android | Stable, identical tiles on both platforms, matches Google routing; `expo-maps` is still alpha. |
| Background location (**Ride**) | expo-location `startLocationUpdatesAsync` plus expo-task-manager with an Android foreground service (`FOREGROUND_SERVICE_LOCATION`) and iOS "Always" permission, running **from "go online" to "go offline"**, not only during a ride. Defaults: idle online every 10 s (or 50 m), on a ride every 4 s; features 8 and 9 may tune them. If the permission drops below "Always" (iOS) or the OS restricts background use (Android), the app shows a blocking "location off" screen and the captain goes offline. **Shift test pass criteria** (run during the scaffold on a mid range Samsung or Xiaomi and an iPhone): 8 hours online uses under 25% battery and fewer than 2% of the shift falls in ping gaps over 60 s. On failure, switch to the Transistor library before slice 1 ships | Matching needs the position of idle captains even when the captain has Waze in front; the criteria make the fallback decision testable. |
| Captain navigation (**Ride**) | One tap hand off to Google Maps or Waze through deep links (Google Maps navigation intent or `comgooglemaps://`, `waze://`, with the `https` universal link as fallback); Ride keeps tracking in the background | No extra cost; captains already trust these apps. |
| Emergency call (**Ride**) | `Linking.openURL('tel:911')` (the unified Saudi emergency number) from the SOS button, sent together with an SOS call to the backend; feature 11 confirms 999 (police) and 997 (ambulance) as fallbacks | The native dialer always works; the backend alert is feature 11. |
| Push | expo-notifications through the existing Nouzl push pipeline (`expo-server-sdk`). Before the first device build: FCM project, APNs key in EAS credentials, an Android channel `ride-offers` with max importance, and iOS time sensitive notifications for ride offers and arrival. **Every offer goes out on two channels**: the socket and a high priority push with a 15 s TTL (time to live); both carry the offer id so the app shows it once. A missed or late offer counts as a timeout and moves on; a captain whose pings stop drops out of matching (see *Captain presence*) | Reuses device token storage; a killed or backgrounded app still gets the offer, and a lost push can never stall a ride. |
| Crash and error monitoring | `@sentry/react-native` with its Expo config plugin, source maps uploaded on EAS builds | Matches the backend's `@sentry/node`, so a crash traces to its API call. |
| Builds and updates | EAS Build and EAS Update in a new EAS project under the `nazl7ksa` account; profiles `development`, `preview`, `production`, each with its own channel; runtime version policy `fingerprint` | Store builds plus over the air JavaScript fixes that never reach a build with mismatched native code. |
| App identity (**Ride**) | Name "Nouzl Ride" / "نزل رايد", bundle and package id `sa.nouzl.ride` | Own store listing; the id is permanent after the first release. |

### Backend (`Nouzl_Backend`)

| Layer | Choice | Reason |
|---|---|---|
| Architecture pattern | Modular monolith: a `src/rides/` folder of NestJS 11 modules inside the existing API | One person team, one deploy, reuses auth, payments, payouts, push and email. |
| Isolation (**Ride**) | `RIDES_ENABLED` env flag decides whether ride code boots at all; a live kill switch (a config row read every 30 s) pauses new ride requests and offers without a deploy. When the flag is off, ride controllers return 404 and no ride cron, queue worker or socket namespace starts. Import rule: rides may import shared services; stays code and delivery code never import rides, and rides never imports delivery | A ride fault cannot reach stays or Delivery, and the two new products stay separate. |
| Processes (shared with Delivery) | Same codebase, two process roles. `PROCESS_ROLE=api` serves REST. `PROCESS_ROLE=worker` hosts the `/rides` socket namespace, the ride BullMQ workers and the ride location pipeline, alongside Delivery's | The REST API runs as a serverless function (`vercel.json`) that cannot hold sockets or workers. One worker for both products halves the hosting. |
| Write path | Every state change (estimate, request, accept, arrive, start, end, cancel) goes through REST under `/rides/v1/*`; location pings go over the authenticated socket | Price and status rules live in one place; the app never sends a price. |
| Read path | History and lists read from Supabase under row level security; live screens use REST plus socket events; nouzl_admin reads ride data only through the backend, behind `@RequireAdminCapability` | Same pattern as nouzl_mobile; no service role reads from a browser. |
| API contract | Versioned paths `/rides/v1/*`; request and response shapes as zod schemas in `nouzl_rules` (synced to backend and app); an `Idempotency-Key` header on every money or state change, scoped per user and endpoint, stored in `ride_idempotency_keys` with the response for 24 h; a replay with the same body returns the stored response, a replay with a different body returns 422 | One shape on both sides; a retry never books two rides or two accepts. |
| Money | Integer halalas end to end with a currency code per row; ledgers (cash balance, earnings) are append only and written inside a database transaction or function | No rounding drift; ledgers always balance (features 14, 15). The payment gateway is feature 13. |
| Time | Server is the time authority and stores UTC; display and business hours use `Asia/Riyadh` (per country later) | Offer timeouts and estimate expiry never depend on a phone clock. |
| Primary database | The shared Supabase Postgres, `public` schema, every table prefixed `ride_`; RLS on every table | Shared accounts, PostgREST reads and type generation; the prefix keeps rides apart from stays and Delivery. |
| Live location | Pings go over the socket into the shared Redis under a `ride:` key prefix: a GEO set of online captains (nearest captain search with `GEOSEARCH`) and a latest position key per captain that expires after 90 s; a GEO set has no per member expiry, so a BullMQ repeat job every 30 s removes captains whose latest position key is gone; the worker fans each ping out to the ride room | Pings every few seconds never write to the shared production database. |
| Location history (**Ride**) | PostGIS. During a ride, one sample about every 10 s plus every status milestone is written to Postgres; nothing is stored for idle online captains. Kept 90 days for disputes and safety reports, then aggregated | Dense enough to rebuild the route for fare disputes and deviation checks; PDPL purpose limit for idle positions. |
| Geo in Postgres | PostGIS for service area and airport polygons (feature 20) and the ride trail above | Zones and dispute evidence need SQL. |
| Captain presence | A captain with no ping for 60 s is skipped by matching and a live offer to them moves on; the sweeper above removes them from the GEO set. Feature 8 may tune the numbers | Detects an app killed mid shift. |
| Realtime | The existing socket.io server with a new `/rides` namespace with its own middleware: it verifies the Supabase token on connect, and the server alone decides room membership (`ride:<id>` for that ride's rider, assigned captain and admins; `captain:<id>` for that captain). Reconnect with a fresh token on session refresh. Location pings are the only thing the app writes over the socket; they are accepted only from an online captain and limited to 1 per second per captain. Server events are hints: `ride_rides.version` goes up by one on every status change, events carry it, and the app reloads the ride over REST after a reconnect or a version gap. One worker instance for now, with the socket.io Redis adapter from day one so a second instance needs no code change; a deploy drops sockets and clients reconnect with backoff | The default namespace's `join` trusts a client sent user id; live location must never leak. |
| Timers and jobs | BullMQ through `@nestjs/bullmq` on the shared Redis with a `rides` queue prefix: 15 s offer timeouts, search window expiry, estimate expiry, waiting fee start, stuck ride alerts | Delayed jobs survive restarts; needed for "never assigned to two captains". |
| Redis (shared with Delivery) | The managed Redis that Delivery spec 0001 provisions: `maxmemory-policy noeviction`, same region as the backend, one per environment, one shared ioredis connection factory. Ride uses its own key and queue prefixes. The rides module fails to boot when `RIDES_ENABLED` is on and Redis is unreachable; `/rides/v1/health` reports Redis and queue lag. Alerts: Redis memory over 60% and ride queue lag over 5 s. **Split trigger**: Ride moves to its own Redis (a URL change, no code change) at Riyadh open launch, or earlier if memory passes 60% | One Redis to pay for and watch; prefixes keep data apart, and the alerts and split trigger cap the shared failure risk. |
| Routing, distance and ETA | Google Routes API, called only by the backend: Compute Routes per estimate (cached for the estimate life); ETA to pickup and to destination refreshed by the backend about every 30 to 60 s, never per ping; a Google Cloud budget alert at $200 a month to start | Accurate Saudi roads; the key stays server side; refresh cadence caps per request cost. |
| Address search | Backend proxies Google Places Autocomplete and Details with session tokens | Keys stay server side. |
| Shared rules | Fare, commission, VAT split and distance helpers in `nouzl_rules`, synced into the backend and the app (feature 5) | Spec 0002; app estimate and server price use the same code. |
| Public trip share (**Ride**) | A `/ride/share/:token` page on Nouzl_Platform (the website). Sharing is opt in per trip. The backend issues a token signed with `RIDE_SHARE_SECRET` and records it in a token table, so the rider can switch sharing off at any time; it also expires 30 minutes after the ride ends. A public endpoint `GET /rides/v1/share/:token` returns only what the in app captain card shows (first name, car, plate) plus status and latest position, limited to 1 request every 3 s per token, `Cache-Control: no-store`; the page polls it about every 5 s. The page is `noindex`, sends no referrer, and leaves the SEO prerender alone | Opens without sign in on a domain people already know, with no new hosting. Details belong to feature 11. |
| Error monitoring | Existing `@sentry/node` with a `rides` tag on every event from `src/rides/`; a request id carried from REST into every job and socket event; failed jobs visible on the bull-board dashboard behind admin auth. Sentry (app and backend) never captures coordinates, phone numbers or tokens: scrub them in `beforeSend` and breadcrumbs | Filter ride issues apart from stays and Delivery, and follow one ride across processes. |

### Accounts and sign in

| Layer | Choice | Reason |
|---|---|---|
| Identity | The existing Supabase Auth users and Nouzl `profiles`; a captain profile is an extra row on the same user | One account in both modes. |
| Sign in method (shared with Delivery) | Phone OTP through Supabase phone auth with `auth.users.phone` (E.164) as the source of truth, delivered by the same **Send SMS hook** Delivery defines: WhatsApp authentication template first, SMS fallback before public launch, reviewers on Supabase test numbers | No new auth work for Ride; changing the channel is a backend change only. |
| Phone auth code (**Ride**) | Promote Delivery's `packages/delivery-auth` into nouzl_mobile as `packages/phone-auth` and sync it into both Delivery and Ride | One source of truth; spec 0002 forbids new hand mirrors. |
| Account linking | Same as Delivery: a new phone creates a new account; linking a Nouzl email and merging is one shared follow up decision for both products | Stays users end up with one account across all Nouzl apps. |

### Environments

| Environment | Database | Backend | App |
|---|---|---|---|
| Development and staging | The persistent Supabase staging branch Delivery creates (shared); ride migrations land there first | The staging api + worker pointed at the branch, stays crons off, `RIDES_ENABLED=true`, shared staging Redis | EAS `development` and `preview` builds |
| Production | Main Supabase project; ride migrations applied only after passing on staging | The live api and worker with `RIDES_ENABLED` off until the internal release | EAS `production` builds |

Migrations live in `Nouzl_Backend/supabase/migrations`; regenerate Supabase types after each one. Ride and Delivery migrations land on the shared staging branch in timestamp order; whoever applies one runs the other product's checks too.

**If Delivery's infrastructure is not ready** when slice 1 starts, Ride provisions the Redis, worker, staging branch and OTP hook itself, exactly as described here and in Delivery spec 0001, and Delivery adopts them later. Until the OTP hook works, sign in uses Supabase test phone numbers on staging only. Never run the local backend with the production `.env` for ride work; it hits production Supabase with crons on.

### How the pieces fit

```
 nouzl_ride app (Expo)                    Nouzl_Backend (one codebase, two process roles)
 ┌──────────────────────────┐ REST /rides/v1 ┌──────────────────────────────────────┐
 │ (rider)      (captain)   │ ─────────────▶ │ api: src/rides/* controllers          │
 │ react-native-maps        │                │   estimate ── Google Routes, Places   │
 │ expo-location (bg, shift)│                │   request, accept, status (DB decides)│
 │ deep link → Maps / Waze  │                └───────┬──────────────────────┬───────┘
 └───┬──────────────▲───────┘                        │ enqueue              │ SQL
     │ pings        │ hints (ride room)      ┌───────▼──────────────┐       │
     └──── socket.io /rides ────────────────▶│ worker (shared with  │◀─▶ Redis (shared:
                                             │ Delivery): /rides ns,│     ride: GEO, latest
     RLS reads (history) ──────┐             │ BullMQ, fan out      │     position, queues)
                               ▼             └───────┬──────────────┘       │
 ┌───────────────────────────────────────────────┐   │ 10 s trail on a ride │
 │ Supabase Postgres: ride_* tables, PostGIS     │◀──┴──────────────────────┘
 │ Supabase Auth: phone OTP → shared Send SMS hook ─▶ WhatsApp, then SMS     │
 └───────────────────────────────────────────────┘
 Nouzl_Platform: /ride/share/:token (public, polls GET /rides/v1/share/:token)
 nouzl_admin: Rides area (through the backend only, capability guarded)
```

### Sync contract (synced packages)

- `scripts/sync-mobile-packages.mjs` (copied from Delivery) copies the listed `nouzl_mobile/packages/*` folders into `packages/*` and writes a hash manifest (`packages/SYNCED.json`) that records the source commit; `check:synced` fails CI when a synced file was edited here. Change shared code in nouzl_mobile, then sync.
- Synced: `theme`, `ui`, `i18n`, `auth`, `api`, `config`, `types`, `phone-auth`. Not synced: `breaknouzl`, `partner-setup` (stays only), `rules` (comes from `nouzl_rules` directly).
- Dependency versions for every shared native module match nouzl_mobile. New native modules here (react-native-maps, expo-task-manager, `@sentry/react-native`) match Delivery's versions.
- `nouzl_rules` keeps its own sync and `check:rules` script (spec 0002).

### Hard rules the build must honor

- The app never sends a price, distance or fee. The backend computes the estimate with the shared rule and Google distance, stores it with an expiry, and a ride request references the estimate id; the final fare is computed on the server.
- A ride is assigned with a single conditional update in Postgres (`where status = 'searching' and captain_id is null`); BullMQ and Redis only trigger, the database decides.
- Every `ride_` table has RLS enabled in the migration that creates it; no `select("*")` on tables with column grants.
- Background location runs only while the captain is online; going offline, signing out, or switching to rider mode stops the task.
- Idle captain positions live only in Redis; Postgres stores the trail only for an active ride.
- Google and OTP provider keys exist only on the backend.
- Money is integer halalas; every money or state change carries an `Idempotency-Key`.
- REST is the source of truth for ride state; socket events are hints.
- The share endpoint never returns rider identity, phone numbers, or the trail before the current position.
- Rides code never imports delivery code, and stays or delivery code never imports rides.
- The server rejects a captain being matched to their own ride request.
- Every offer goes out on socket and push; a missed offer is a timeout, never a stall.
- Sentry events never contain coordinates, phone numbers or tokens.

### Configuration required

- `RIDES_ENABLED`: boots ride controllers, workers and the `/rides` namespace.
- `RIDE_SHARE_SECRET`: signs public trip share tokens.
- Shared with Delivery: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `PROCESS_ROLE`, the Send SMS hook secret, the Google server key.
- App: `EXPO_PUBLIC_API_URL`, the Google Maps SDK keys for iOS and Android (restricted to the bundle id), the Sentry DSN.

## Consequences

**Positive**:
- Almost nothing new to operate: Redis, the worker, the staging branch and the OTP hook are already planned for Delivery.
- Payments, payouts, push, email, admin capabilities and sockets are reused.
- Shared mobile fixes reach Ride with one sync; phone sign in has one source for both apps.
- Switching WhatsApp to SMS, or the OTP vendor, is a backend change only.

**Negative / tradeoffs**:
- Ride depends on Delivery's infrastructure work landing first (Redis, worker host, staging branch, OTP hook). If Delivery slips, Ride's tracer bullet slips with it.
- Shared Redis and worker mean a Delivery fault (memory leak, runaway queue) can stall rides, and the other way round. Prefixes and flags separate data, not failure.
- Background location for the whole shift costs captain battery and draws closer App Store and Play review; the permission copy and the review video must justify it.
- Rides share a deploy and database with stays; a bad migration can still hurt stays. The flag, the `ride_` prefix and the staging branch reduce this but do not remove it.
- Google Routes and Places cost money per request; estimate caching, Places session tokens and the 30 to 60 s ETA cadence are required, not optional.
- Map and location code is duplicated between Delivery and Ride until it is extracted.
- Promoting `phone-auth` touches nouzl_mobile and Delivery, not only this repo.
- WhatsApp templates need Meta approval; until then only test numbers can sign in on staging.

**Neutral**:
- `expo-maps` is alpha in SDK 57; revisit when stable.
- If shift length battery tests fail, the Transistor background geolocation library ($399 one time) is the planned fallback.
- Masked calling and in ride chat transport are left to feature 10; the payment gateway to feature 13.

## Follow-up

- [ ] Initialise git in `nouzl_ride` and connect a GitHub remote; before pulling any Nouzl repo, check its refs for the injected `global.i=` code from the 2026-09-16 force push.
- [ ] Promote `nouzl_delivery/packages/delivery-auth` to `nouzl_mobile/packages/phone-auth`, sync it into Delivery and Ride, and update Delivery spec 0001's *Phone auth code* row (an update to that spec, run from `nouzl_delivery`).
- [ ] Record in Delivery spec 0001 that its Redis, worker, staging branch (consider renaming `delivery-staging` to a neutral name) and OTP hook are shared with Ride, so neither product changes them alone.
- [ ] Add `RIDES_ENABLED` and `rides` to the backend import boundary check alongside `DELIVERY_ENABLED`.
- [ ] Run the shift battery test (pass criteria in *Background location*) and an app killed test on a real Android and iPhone during the scaffold, not at launch; switch to Transistor if it fails.
- [ ] Write the App Store and Play background location justification (copy plus review video) before the first TestFlight or internal track build.
- [ ] Confirm the bundle id `sa.nouzl.ride` and create the EAS project before the first build; create the `ride-offers` Android channel and enable iOS time sensitive notifications.
- [ ] Add the `/ride/share/:token` route to Nouzl_Platform with `noindex` (designed in feature 11); confirm it does not touch the PHP prerender.
- [ ] Data model (feature 3): `ride_` tables, `ride_captain_profiles` rather than a role value, and the trail table with its 90 day retention job.
- [ ] Masked calling provider and chat transport: decide in feature 10.
- [ ] PDPL data residency (**gate: before the first production build**): record the regions of Supabase, Redis, the worker host and Google processing, and the consent text for captain location (shared with Delivery's follow up; deletion path owned by feature 21).
- [ ] Choose the worker host (shared with Delivery's follow up).
- [ ] `/audit` (feature 2) should record this stack, the sync contract and the hard rules in root `AGENTS.md`, plus an `## Agent skills` section for the nine skills in `.claude/skills/` (installed 2026-10-10 from Delivery's `skills-lock.json`; the four backend skills apply when working in Nouzl_Backend from this repo), `MCP servers:` Sentry and Redis (to connect, shared with Delivery), and `Declined:` `tivojn/google-maps-api`.
- [ ] Sign in to the Expo MCP, which is configured but needs authorization.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
