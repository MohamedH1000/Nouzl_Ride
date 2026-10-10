# Verify: Data model · spec 0002 · updated 2026-10-11
_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones. Everything database side runs on the staging branch, never on production._

## Commands
- [ ] Apply `Nouzl_Backend/supabase/migrations/20261011120000_ride_core.sql` to the staging branch → succeeds; 19 `ride_` tables, PostGIS in `extensions` → AC-10
- [ ] Run `Nouzl_Backend/supabase/probes/20261011120000_ride_core_probe.sql` on staging → `PROBE >> failures=0` (it already passes on PGlite, Postgres 17 with PostGIS) → AC-1 to AC-4, AC-6 to AC-10, AC-12 to AC-14
- [ ] Two session race: session 1 `begin; select ride_assign_captain(<ride>, <captain C>, …)`, session 2 the same for captain D (it waits), commit session 1 → session 2 returns null; one open `ride_assignments` row → AC-5
- [ ] Supabase security advisor on staging → no new warnings for `ride_` objects → AC-10
- [ ] Regenerate Supabase types into Nouzl_Backend → `ride_` tables and functions present, `npx tsc --noEmit` clean → AC-10
- [ ] Rollback on staging: `set nouzl.confirm_rollback = 'yes';` then the rollback file → no `ride_` objects left; apply the migration again → succeeds
- [ ] `cd Nouzl_Backend && npx jest src/rides` → edge list test passes (SQL edges equal `RIDE_STATUS_EDGES`) → AC-7
- [ ] `cd Nouzl_Backend && node scripts/check-ride-migrations.mjs` → passes; a sample later migration with `drop column` on a `ride_` table fails it → AC-11
- [ ] `cd nouzl_rules && npm run typecheck && npm run lint:pure && npm test` → all green → AC-7

## Value sourcing (one step per row the core migration owns)
- [ ] `ride_number` → two rides created back to back get consecutive numbers from `ride_number_seq` (starts 1000001)
- [ ] `fare_cap_halalas` → estimate 2000 with `fare_cap_bps` 2000 gives 2400; with 0 gives 2000
- [ ] `is_test` → a test rider's ride is `is_test = true`; a real rider's is false; a test captain on a real ride raises `ride_test_mismatch` → AC-12
- [ ] payment method → only `cash`, `card`, `apple_pay` are accepted (anything else fails the check)
- [ ] `version` → each accepted transition raises it by exactly one and writes one event with that version → AC-7
- [ ] actor → a rider id on a captain edge, another captain's id, or an admin or system call with no reason raises `ride_actor_not_allowed` → AC-13
- [ ] rider is a woman → a `woman_captain_only` type is refused for a rider whose gender is null or `male` → AC-13
- [ ] captain is a woman → a male captain on a `woman_captain_only` ride gets null and his offer is withdrawn → AC-13
- [ ] captain eligible for the type → a vehicle without a `ride_vehicle_ride_types` row for the ride type gets null → AC-13
- [ ] totals at completion → final fare equals the sum of the charge lines (net plus VAT), and commission equals fare minus earning minus VAT → AC-14
- [ ] display time → stored times are UTC; `ride_cities.timezone` for Riyadh is `Asia/Riyadh`

## Waiting on spec 0002 (not buildable yet)
- [ ] `arrived` to `in_progress` with the right start code passes, a wrong code raises `ride_wrong_start_code` and counts the attempt, the fifth wrong code locks with `ride_start_code_locked` → AC-13 (needs the HMAC key source, and how a failed attempt is counted when the call fails)
- [ ] `search_expires_at` is set once on the first search; a give back inside the window searches again, after it ends the ride → AC-7 (needs the search window length)
- [ ] Cancel and no show fee charges on `cancelled_by_rider` and `rider_no_show` (needs when the cancel clock starts and whether fee amounts include VAT)

## Acceptance-criteria coverage
- AC-1, AC-2, AC-3, AC-4: probe (rider A, rider B, captains C, D, E, anon, privilege sweep)
- AC-5: probe (sequential) plus the two session race step
- AC-6: probe (second open ride, captain with two active rides)
- AC-7: probe plus the jest edge list test; the start code edge is waiting on the spec
- AC-8, AC-9: probe
- AC-10: probe plus the advisor step
- AC-11: `check-ride-migrations.mjs` in CI
- AC-12, AC-13, AC-14: probe; the start code part of AC-13 is waiting on the spec
