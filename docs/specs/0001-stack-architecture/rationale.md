# 0001. Stack and architecture: rationale

Decision record for [index.md](index.md). Builds do not need this file.

## Context

Nouzl Ride is ride hailing for Saudi Arabia first: riders request and pay, approved captains go online and take nearby requests, and operations run the day from nouzl_admin (`docs/ar/prd.md`). One person plus Claude has about 18 weeks to launch, at GA rigor. The scope already fixed the outline: its own repo `nouzl_ride`, ride logic as `rides` modules in Nouzl_Backend behind their own switch, a Rides area in nouzl_admin, and shared pure rules in `nouzl_rules` (spec 0002 of the Nouzl repos).

Forces that shaped this decision:

- **A near identical decision was made today.** Nouzl Delivery spec 0001 settled an Expo app, a flag gated backend area, Redis plus BullMQ in a worker process, socket.io, PostGIS, Google Maps and WhatsApp OTP for a courier app. Ride has the same shape (two modes, live location, matching with timeouts, money).
- **Ride must stay a separate product** from the parcel app (an explicit requirement), yet one engineer cannot run two sets of infrastructure.
- **The backend is shared with live stays.** A ride bug, cron or migration can hurt a paying product; the local `.env` points at production.
- **Matching needs idle captains' positions.** Unlike Delivery's couriers, captains wait online for a 15 second offer, often with another app in front.
- **Safety is core.** A public trip share page, SOS to 911, route deviation detection, and evidence for disputes all depend on location history.
- **Money and location are regulated.** Server side price authority, PDPL purpose limits, ZATCA invoicing.

Not deciding blocks the tracer bullet slice (feature 6), and each slice would invent its own transport, timer and storage choices.

## Options considered

Full stacks compared, not single tools.

### Option 1: Mirror the Delivery stack on the shared Nouzl platform

Expo SDK 57 app with synced nouzl_mobile packages, `src/rides/` behind `RIDES_ENABLED`, shared Supabase, and the Redis, worker, staging branch and OTP hook Delivery provisions, with Ride's own prefixes, namespace and flag.

**Pros**: almost no new infrastructure; reuses accounts, payments, payouts, push, admin; one language end to end; decisions already reviewed and cross checked once.
**Cons**: depends on Delivery's infrastructure landing first; shared Redis and worker are a shared failure domain; shares a database with stays.

### Option 2: Delivery's design, fully separate infrastructure

Same code layout, but Ride gets its own Redis, its own worker process and its own staging branch.

**Pros**: a Delivery fault cannot stall rides; each product scales and deploys its worker alone.
**Cons**: double the hosting cost and double the things to watch for one engineer; no benefit until either product has real traffic.

### Option 3: Separate ride service and database

A second NestJS app or Supabase project dedicated to rides, calling Nouzl for accounts and payments.

**Pros**: strongest isolation from stays and Delivery.
**Cons**: two deploys, cross project account sync, payments and payouts duplicated or called remotely; weeks of plumbing before the first ride.

### Option 4: Flutter app on the shared backend

Same backend as Option 1 with a Flutter app.

**Pros**: strong map and background performance.
**Cons**: nothing shared with nouzl_mobile or Delivery; a new language; TypeScript rules from `nouzl_rules` cannot be synced, so the estimate could drift from the server price.

## Rationale

Option 1 wins on the force that dominates a solo 18 week build: reuse. Delivery already paid the design cost for every layer Ride needs, and its spec went through a cross check (basis: Nouzl Delivery spec 0001). A modular monolith keeps one deploy while the flag, the one way import rule and the `ride_` prefix fence ride code from stays and Delivery (basis: monolith first; modular monolith for a single team). Option 2's separate infrastructure buys isolation that matters only once either product has real load; it can be split later by pointing Ride at its own Redis URL and starting a second worker, with no code change, because prefixes already keep the data apart.

The ride specific choices follow the product, not taste. Whole shift background location is required because matching must find idle captains who have Waze open; foreground only would silently drop them from offers. Navigation hands off to Google Maps or Waze because captains already use them and the in app Navigation SDK adds per trip cost and native risk. The 10 second trail during a ride, and none while idle, is the smallest record that still rebuilds a route for a fare dispute or a deviation report, while honoring PDPL purpose limits (basis: data minimisation). The share page lives on Nouzl_Platform because it must open without signing in and the website is already hosted; polling a narrow public endpoint avoids exposing the socket to anonymous viewers.

Promoting phone auth into nouzl_mobile follows spec 0002's rule against new hand mirrors (basis: Nouzl spec 0002, shared rules standard). Map and location code stays in Ride until both apps have a working version, because extracting a shared package from a single example tends to produce the wrong abstraction (basis: rule of three).

## Landscape check (reused, 2026-10-10)

No new web fetch was run. Delivery's check from the same day covers every tool this stack uses (cache: `nouzl_delivery/docs/.agent-cache/research/stack-architecture.md`). Points that matter for Ride:

- expo-location SDK 57: background updates through TaskManager; Android 14 needs `FOREGROUND_SERVICE_LOCATION`; iOS "Allow once" silently denies background updates; Play reviews these permissions. A terminated Android app does not restart on location events.
- `expo-maps` is alpha in SDK 57; react-native-maps is the stable choice.
- Google Routes: Compute Routes billed per request with Essentials, Pro and Enterprise tiers; exact per thousand prices not verified.
- Supabase Send SMS hook replaces built in SMS sending and signs its requests with a hook secret.
- Transistor background geolocation: one time licence from $399.
- Not researched: Google Navigation SDK pricing, masked calling providers (feature 10).

## Cross check (2026-10-10)

An independent model read the spec and raised 12 points. All were applied with the recommended fix: dual channel offers (socket plus short lived push), shift battery test pass criteria and permission loss handling, a live kill switch plus Redis alerts and a split trigger, concrete presence and expiry defaults with a GEO sweeper, a socket.io Redis adapter and ping rate limit, a revocable rate limited share token, a PDPL gate before the first production build and Sentry scrubbing, mode switch blocking and server side self match rejection, defined idempotency semantics, the socket write path and version column, a fallback if Delivery's infrastructure slips, and the 911 note. No simpler overall option was found.

## References

**Project sources**:
- Nouzl Delivery spec 0001 (`nouzl_delivery/docs/specs/0001-stack-architecture/`): the baseline stack and its cross check
- Nouzl spec 0002, shared rules standard: synced read only copies, no new hand mirrors
- `docs/scope/scope.md` and `docs/ar/prd.md`, `docs/ar/implementation-plan.md`: scope, launch decisions, Tracer Bullet and GA
- Installed skills in `.claude/skills/` (same set as Delivery)

**Practices & standards**:
- Monolith first; modular monolith for a single team
- Database as the source of truth; queues and caches only trigger
- Idempotency keys for money and state operations
- Data minimisation (PDPL purpose limits)
- Rule of three before extracting shared code

**Links** (web verified in Delivery's check, 2026-10-10):
- Expo Location SDK 57: https://docs.expo.dev/versions/v57.0.0/sdk/location/
- Expo Maps SDK 57: https://docs.expo.dev/versions/v57.0.0/sdk/maps.md
- Google Routes API usage and billing: https://developers.google.com/maps/documentation/routes/usage-and-billing
- Supabase Send SMS hook: https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook.md
- WhatsApp pricing: https://developers.facebook.com/docs/whatsapp/pricing
- Transistor background geolocation pricing: https://docs.transistorsoft.com/purchase
- BullMQ docs: https://docs.bullmq.io/
