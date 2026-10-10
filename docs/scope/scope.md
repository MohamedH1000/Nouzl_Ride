# Scope: Nouzl Ride

One mobile app with two modes for moving people, like Uber. In rider mode anyone in Saudi Arabia requests a ride, sees the price before booking, follows the captain live on the map, and pays by card, Apple Pay, or cash. In captain mode approved drivers go online, take nearby ride requests, and earn income paid out weekly. It runs on Nouzl accounts and on new ride modules in Nouzl_Backend, with a Rides area in nouzl_admin. It is a fully separate product from the parcel delivery app.

**Build approach:** Tracer Bullet (prove one real ride travels app, backend, database and admin end to end, then thicken one segment at a time).
**Workflow:** GA (after `/develop`: `/check verify`, `/test`, a fresh model `/check review`, then `/document`). The project default level of rigor, chosen because the app moves people, handles money, live location and personal data, and carries safety reports. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag to do more or less.

**Where things live:** the app in the new repo `nouzl_ride`; ride logic as new `rides` modules in `Nouzl_Backend`, behind their own feature switch so a fault there never touches Nouzl bookings; operations screens as a Rides area in `nouzl_admin`; shared pure rules (fare, commission, distance) in `nouzl_rules` as hash checked copies, per the shared rules standard. Test against a Supabase branch or separate project, never the production database.

**Launch decisions:** source of truth is the Arabic PRD and plan in `docs/ar/` (`prd.md`, `implementation-plan.md`). Saudi Arabia first, Arabic first plus English, GCC later through settings; promise is a cheaper ride for riders and higher income for captains through a lower platform cut, with visible safety on every ride; about 18 weeks, you plus Claude; staged rollout (internal, closed beta in Riyadh, Riyadh open, then Jeddah and Dammam).

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & architecture | Foundation | done |
| 2 | Coding standards & tooling | Foundation | done |
| 3 | Data model | Foundation | planned |
| 4 | Design system & UI foundation | Foundation | planned |
| 5 | Pricing & commission rules | Foundation | planned |
| 6 | Core ride loop | Slice 1 | planned |
| 7 | Captain onboarding & verification | Slice 2 | planned |
| 8 | Matching | Slice 3 | planned |
| 9 | Live tracking & fare metering | Slice 4 | planned |
| 10 | Chat & masked calling | Slice 5 | planned |
| 11 | Safety | Slice 6 | planned |
| 12 | Ride types | Slice 7 | planned |
| 13 | Online payment | Slice 8 | planned |
| 14 | Cash & captain balance | Slice 9 | planned |
| 15 | Captain earnings & payouts | Slice 10 | planned |
| 16 | Waiting, cancellations & disputes | Slice 11 | planned |
| 17 | Ratings | Slice 12 | planned |
| 18 | Notifications | Slice 13 | planned |
| 19 | Admin rides area | Slice 14 | planned |
| 20 | Service areas & airports | Slice 15 | planned |
| 21 | Compliance & licensing | Slice 16 | planned |
| 22 | Analytics & monitoring | Slice 17 | planned |
| 23 | Store release & launch | Launch | planned |

## Foundations

### 1. Stack & architecture · done
Choose the app framework for `nouzl_ride`, how sign in works and shares Nouzl accounts, the maps and routing provider, how the captain's location travels live, and how the `rides` modules sit inside Nouzl_Backend apart from everything else. Then scaffold an app that runs in both modes.
**Done when:** the decisions are recorded in a spec, the empty app runs on Android and iOS with the rider/captain mode switch, and the backend `rides` module answers a health route.
spec [0001](../specs/0001-stack-architecture/index.md) · code in `apps/ride`, `Nouzl_Backend/src/rides`
- [x] Decide the stack (spec): `/architect stack & architecture`
- [x] Scaffold from the decision: `/develop stack & architecture`

### 2. Coding standards & tooling · done
Capture conventions and tooling from the real scaffolded repo, in line with the other Nouzl repos.
**Done when:** `AGENTS.md` reflects the real stack, and lint, format and type checks run in CI.
code in `apps/ride/eslint.config.js`, `apps/ride/jest.config.js`, `.prettierrc.json`, `.husky/`, `.github/workflows/ci.yml`
- [x] Capture conventions + tooling choices: `/audit`

### 3. Data model · needs a decision
Rides and their status history, routes, captains, vehicles, documents, match offers, payments, cash ledger, earnings, payouts, ratings, safety reports, lost items, and per country settings, with row level security.
**Done when:** every later slice fits without a breaking migration, and a rider sees only their rides and a captain only theirs.
- [ ] Design it (spec): `/architect data model`

### 4. Design system & UI foundation · needs a decision
A visual language built on the Nouzl identity with its own ride character: maps, bottom sheets, captain card, an obvious emergency button, large captain buttons for use while driving, light and dark mode.
**Done when:** `design.md` covers type, colour and components, and components render correctly in Arabic and English.
- [ ] Design it (spec): `/architect design system & UI foundation`

### 5. Pricing & commission rules · needs a decision
One shared rule for the fare (base fare, distance, time, minimum, waiting, ride type multiplier, VAT) and for commission, configured per country and city.
**Done when:** the server is the only authority for the price, the app estimate matches the server, and the commission and VAT split is correct to the halala.
- [ ] Design it (spec): `/architect pricing & commission rules`

## Slice 1: Core ride loop

### 6. Core ride loop · needs a decision
The simplest real ride: the rider signs in, picks a destination, sees the estimate, and books with cash. A preapproved test captain goes online, accepts, arrives, starts and ends the ride, and the rider sees every status change. This slice is the walking skeleton.
**Done when:** one ride passes through every status on two real phones, every change is stored with its time, and the ride shows in admin.
- [ ] Design it (spec): `/architect core ride loop`

## Slice 2: Captain onboarding

### 7. Captain onboarding & verification · needs a decision
National ID, driving licence, vehicle registration, periodic inspection, insurance, car photos, IBAN and a selfie, then admin review and approval.
**Done when:** a captain uploads documents, admin approves or rejects with a reason, expired documents block going online, and documents are stored privately.
- [ ] Design it (spec): `/architect captain onboarding & verification`

## Slice 3: Matching

### 8. Matching · needs a decision
Offer each ride to the nearest suitable captain for 15 seconds, then the next, widening the radius, and handling captains dropping offline and racing offers.
**Done when:** a ride is never assigned to two captains, an ignored offer moves on within the timeout, and the rider is told clearly when nobody is available.
- [ ] Design it (spec): `/architect matching`

## Slice 4: Tracking

### 9. Live tracking & fare metering · needs a decision
The rider follows the captain to pickup and during the ride, with a refreshing arrival time and accurate measured distance and time despite weak signal.
**Done when:** the map updates every few seconds, the final fare matches the real distance in test rides, and battery use stays reasonable.
- [ ] Design it (spec): `/architect live tracking & fare metering`

## Slice 5: Contact

### 10. Chat & masked calling · needs a decision
Chat and calls between rider and captain that never reveal phone numbers and close after the ride.
**Done when:** both sides can reach each other during the ride without seeing numbers, and the chat turns read only after the ride.
- [ ] Design it (spec): `/architect chat & masked calling`

## Slice 6: Safety

### 11. Safety · needs a decision
A 4 digit code to start the ride, an emergency button that calls 911 and alerts operations, a live share link, detection of long stops and route deviation, and a captain selfie before each shift.
**Done when:** no ride starts without the code, an emergency alert reaches operations within seconds with location, the share link works without signing in, and a deviation sends the rider a check and alerts operations.
- [ ] Design it (spec): `/architect safety`

## Slice 7: Ride types

### 12. Ride types · needs a decision
Economy, comfort, family, and a woman captain option for women riders, with vehicle requirements per type.
**Done when:** the rider sees price and arrival time for each type, a request only matches a captain eligible for its type, and the woman captain option shows only to women riders.
- [ ] Design it (spec): `/architect ride types`

## Slice 8: Online payment

### 13. Online payment · needs a decision
Authorize an amount on request, capture the final fare when the ride ends, and release the hold on cancel, through a gateway already in Nouzl_Backend.
**Done when:** the captured amount equals the server's final fare, cancelled holds are released or refunded, and gateway callbacks are verified and never processed twice.
- [ ] Design it (spec): `/architect online payment`

## Slice 9: Cash

### 14. Cash & captain balance · needs a decision
A cash ledger that tracks the platform share of cash rides, offsets it against online earnings, and pauses cash rides above a limit.
**Done when:** every cash ride adds the right amount, the balance offsets correctly, and the ledger always balances.
- [ ] Design it (spec): `/architect cash & captain balance`

## Slice 10: Earnings

### 15. Captain earnings & payouts · needs a decision
Earnings per ride, day and week, and a weekly payout to the IBAN with a statement showing fare, commission, VAT and cash offset.
**Done when:** the payout equals earnings minus cash debt, every payout has a statement, and failed payouts retry and show in admin.
- [ ] Design it (spec): `/architect captain earnings & payouts`

## Slice 11: When things go wrong

### 16. Waiting, cancellations & disputes · needs a decision
Waiting fees after the free minutes, published cancellation fees, rider no show, fare disputes, and lost item reports.
**Done when:** fees follow the rules in every case, the rider can dispute and admin can refund, and a masked contact opens to return lost items.
- [ ] Design it (spec): `/architect waiting, cancellations & disputes`

## Slice 12: Trust

### 17. Ratings
Rider and captain rate each other after every ride, and low averages send the account to review.
**Done when:** each side rates once per ride, and accounts below the threshold appear in a review list.
- [ ] Build it: `/develop ratings`

## Slice 13: Notifications

### 18. Notifications · needs a decision
Push for every ride change and for captain requests, and email receipts with VAT detail.
**Done when:** every change arrives within seconds, requests wake the captain app in the background, and receipts arrive by email.
- [ ] Design it (spec): `/architect notifications`

## Slice 14: Operations

### 19. Admin rides area · needs a decision
A section in nouzl_admin: live map, ride and route search, captain approval, cash balances, disputes, payouts, pricing, and a safety centre where emergency reports come first.
**Done when:** an operator finds any ride with its full route, handles an emergency report from one screen, and every action is logged.
- [ ] Design it (spec): `/architect admin rides area`

## Slice 15: Cities & airports

### 20. Service areas & airports · needs a decision
Cities and zones that can be switched on or off, airport pickups blocked until a permit exists, then dedicated pickup points after.
**Done when:** a location outside service gets a clear message, the airport rule applies automatically, and admin sees supply and demand per city.
- [ ] Design it (spec): `/architect service areas & airports`

## Slice 16: Compliance

### 21. Compliance & licensing · needs a decision
Transport General Authority licence for ride hailing apps, captain and vehicle rules, the Personal Data Protection Law, electronic invoicing, terms and privacy in Arabic and English, and account deletion.
**Done when:** every regulatory requirement maps to built behaviour or an approved document, and the licence is issued or formally filed before launch.
- [ ] Design it (spec): `/architect compliance & licensing`

## Slice 17: Knowing what happens

### 22. Analytics & monitoring · needs a decision
Marketplace numbers (price to request, time to accept, time to arrive, cancel rate, captain online hours), crash monitoring, and alerts for stuck rides.
**Done when:** a daily dashboard shows the core numbers, crashes are reported with context, and operations are alerted when a ride stalls.
- [ ] Design it (spec): `/architect analytics & monitoring`

## Launch

### 23. Store release & launch · needs a decision
App Store and Google Play release, reviewer test accounts, a pilot in Riyadh, then Jeddah and Dammam, then the rest.
**Done when:** both stores approve, and the first week of real rides closes with no money mismatch and no unhandled safety report.
- [ ] Design it (spec): `/architect store release & launch`

## Deferred
After launch, in the suggested order.
- **Scheduled rides**: book a ride ahead of time · needs a decision
- **Peak hour captain incentives**: bonuses when demand is high · needs a decision
- **Business accounts**: company billing for employee rides · needs a decision
- **Intercity rides**: trips between cities · needs a decision
- **Rider monthly subscription**: a paid plan for frequent riders · needs a decision · GA
- **GCC expansion**: UAE first · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack & architecture), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards & tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre workflow) and `dropped` (de scoped, kept for history).
- **Workflow tier tag** beside a heading (e.g. `· Prototype`) sets that one feature's rigor below or above the project default; no tag inherits GA.
- **Workflow** (header line) is the project default, what runs after `/develop`: **GA** = `/check verify`, `/test`, a fresh model `/check review`, then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
