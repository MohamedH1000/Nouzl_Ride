# 0002. Ride data model: rationale

## Context

Nouzl Ride needs a schema for rides and their status history, routes, captains, vehicles, documents, match offers, payments, a cash ledger, earnings, payouts, ratings, safety reports, lost items and per country settings (scope feature 3). The scope sets two bars: every later slice must fit without a breaking migration, and a rider must see only their rides and a captain only theirs. The PRD adds that the server is the only price authority (R4), a ride is never assigned to two captains (R9), every money movement sits in a ledger that always balances (R21), every status change records who and when (section 8), and every price, tax, commission, ride type and document is stored per country from day one (section 14).

Spec 0001 already fixed the frame: the shared Supabase Postgres in `public`, every table prefixed `ride_` with RLS, REST as the only write path, integer halalas with a currency per row, append only ledgers, `ride_idempotency_keys`, `ride_rides.version` on every status change, a PostGIS trail sampled about every 10 s and kept 90 days, a `ride_captain_profiles` row rather than a role value, and assignment by a single conditional update in Postgres. The data lives beside stays tables, so a bad migration can still hurt the live Nouzl product.

The existing backend shapes the choices. `profiles` is readable by the anon key in full (see the `user_id_documents` migration), so nothing sensitive can go there. Existing money tables store decimals and `financial_ledger_entries` requires a `booking_id`. supabase-js has no transactions. The repo already uses text check constraints for statuses, a booking number sequence, per migration probes and rollbacks, and pinned `search_path` on functions.

The data is regulated: location, national ID, IBAN and selfies fall under the Personal Data Protection Law; receipts and commission invoices fall under ZATCA electronic invoicing; and the Transport General Authority expects ride records. The work is done by one person plus Claude over about 18 weeks, so the schema must be simple to operate as well as correct. Deciding late means slice by slice table design, which is how breaking migrations and missing audit trails happen.

## Options considered

### Option 1: Full target model, created per slice, backend only writes, transactional functions

Design all tables now; each feature's migration creates only its own tables and only adds to earlier ones. Apps read their own rows through RLS with column grants; the backend writes through `security definer` functions, one transaction each. Money flows through one double entry ledger; fare rules are immutable versions; status values are text with checks.

**Pros**:
- Every slice knows its shape in advance, so the "no breaking migration" bar is designed in and checkable (AC-11).
- Races and double writes are stopped by unique indexes and conditional updates in the database.
- No empty tables in production; each migration ships and is probed with the code that uses it.

**Cons**:
- A large up front design that may need small revisions when later features are specced.
- Guard logic in SQL functions duplicates some TypeScript rules and must be kept in step.

### Option 2: Full target model, one migration up front

Same design, but every table is created now.

**Pros**:
- The whole schema exists from day one; types for every table are generated at once.

**Cons**:
- About 25 tables sit unused for months with RLS that no code exercises, so policy mistakes stay hidden until the feature lands.
- A change to a not yet built table becomes a migration on a live schema instead of a free edit to this spec.

### Option 3: Design per slice, no target

Design only the core ride loop now; each later feature designs its own tables.

**Pros**:
- Fastest start; no speculative design.

**Cons**:
- Money, safety and settings features each reach back into `ride_rides` and profiles, which is where renames and type changes come from; it fails the scope's "no breaking migration" bar.
- Cross cutting rules (per country settings, deletion, test flag, audit trails) get decided several times, differently.

### Option 4: Extend existing Nouzl tables

Put ride money into `financial_ledger_entries`, invoices into `invoices`, payouts into `partner_withdrawals`, chat into `support_conversations`.

**Pros**:
- Fewer tables; admin screens and reports for those tables exist already.

**Cons**:
- Those tables are keyed by bookings and partners and store decimals; adapting them means changing stays tables, which spec 0001 forbids in spirit (rides isolated behind its flag).
- A ride fault or migration could then corrupt stays money.

## Rationale

Option 1 is the only one that meets both scope bars at once. A full target removes the main source of breaking migrations, which is a later feature discovering it needs a different key or a split column on a core table. Creating tables per slice keeps the Tracer Bullet honest: the core migration carries exactly what the walking skeleton exercises, and each later table arrives with the code and the probe that prove its policies. Option 2's empty tables would carry unexercised RLS for months on a database shared with live stays data, which is the worst place to hide a policy bug.

Backend only writes follow from spec 0001's REST write path and the existing `user_id_documents` posture, and they shrink the RLS problem to reads. Because supabase-js cannot run transactions and spec 0001 requires assignment by one conditional update, multi table writes go through `security definer` functions; a separate `pg` pool was the runner up, rejected because it adds a second database client on a serverless API. Keeping rules in `nouzl_rules` and only guards in SQL keeps one source for business logic, with a test tying the two edge lists together.

The single double entry ledger was chosen over two simple ledgers because the cash offset (PRD R19) moves money between a captain's cash due and earnings; with two ledgers that move is two writes that can disagree, while in one ledger it is one balanced entry the database refuses to accept unbalanced. Immutable fare rule versions make any old fare recomputable for a dispute. Charge lines make new fees data, not migrations. Encrypting national ID and IBAN with a keyed hash beside them keeps the fraud check (one account per ID and IBAN) while making a leaked backup useless. Anonymizing instead of deleting satisfies both the PDPL deletion right and the tax and transport record keeping that requires the money and trip records to survive.

### Smaller calls made in the spec

- **Status types**: text with check constraints over Postgres enums, matching every existing migration; enums are awkward to change inside a migration transaction.
- **Ride identifier**: UUID plus `ride_number` from a sequence, mirroring `booking_number_seq`; UUID only was the runner up.
- **Captain cancel**: back to `searching` on the same ride while the search window is open, else terminal `cancelled_by_captain`; cloning a new ride was rejected because it splits one trip into two receipts and share links.
- **Offers in Postgres**: needed for time to accept, acceptance rate and "why no captain"; Redis only was the runner up.
- **Trail table**: plain with btree and BRIN indexes; about 8M rows at the 90 day target is small; monthly partitions are the next step if volume grows tenfold.
- **Cached ratings** on profiles: a stored derived value, accepted because the captain card and every offer show it; one function is the only writer.
- **City for slice 1 quotes**: the single active seeded city, replaced by a zone lookup in feature 20, so slice 1 needs no polygons.
- **Drop off label for offers**: a reverse geocoded district stored on the quote, so the captain sees an approximate destination before accepting (PRD section 10) without a second lookup.
- **Shift selfies** on the shift row, not in `ride_documents`, because they belong to one shift and expire with it.
- **Admin action log** created in feature 7, the first feature where an admin writes ride data.
- **Database tests** as never committing probe scripts in `supabase/probes/`, the repo's existing pattern, rather than adding pgTAP.
- **Changed after the cross check**: a captain who gives a ride back loses RLS access to it and sees it in history through REST, because column grants apply to every row and cannot hide the next captain or the fare per row (the earlier answer was RLS access through any past assignment). Rider gender is declared by the rider at launch, because nothing in the PRD verifies a rider's ID; feature 12 decides whether to verify it, and `gender_verified_at` is ready for that.
- **Cross check fixes**: completion is one function (`ride_complete`) so charges and totals cannot drift; every function checks its actor; the start code is stored hashed plus encrypted with an attempt limit; journal lines are built from fixed posting recipes with a cached balance per account; payouts link to the entries they settle; invoice numbers come from a locked counter so they have no gaps; a legal hold stops retention purges for rides under dispute or investigation.
- **Kept separate on purpose**: the ride, incident and case event tables were not merged into one generic event table; each queue stays simple to query and to secure.

### Update 2026-10-11: start code key, search window, fees

The first `/develop` run stopped on four values the spec used without naming a source. Settled with the engineer:

- **Start code key: the backend sends the HMAC.** The backend hashes the 4 digit code with `RIDE_START_CODE_HMAC_KEY` (backend env only) and the database compares bytes. Runner up: the key in Supabase Vault with the database hashing the plain code. Rejected because it puts a secret in the shared database, and with only 10,000 possible codes anyone who reads the key can recover a code in seconds. This matches the national ID and IBAN pattern (keys live in the backend). Own keys, not the PII keys, because start codes live for one ride and their keys can rotate without a rehash job, and the first ride (feature 6) needs them before feature 7 creates the PII keys.
- **Counting a failed attempt: a separate `ride_start_ride` that returns an outcome.** A raised error rolls back the whole transaction, including the attempt count, so "fail with an error and count the attempt" cannot both happen in one call. Runner up: the backend increments the count in a second call. Rejected because two calls can race and the limit would live in the backend instead of the database. The attempt count resets at each assignment because each captain gets a new code.
- **Search window: 120 seconds, per country** (`ride_countries.search_window_seconds`). About eight 15 second offers (PRD M8), in line with the PRD target of acceptance in under a minute on average. 3 and 5 minutes were weighed; longer suits a thin captain supply but leaves the rider waiting. Feature 8 confirms it against real acceptance data.
- **No show timing: a separate `no_show_after_minutes` (5 at launch) from arrival.** Runner up: reuse `free_wait_minutes` (3). Rejected because a rider who is a minute past the free wait would lose the ride and pay a fee; waiting charges cover minutes 3 to 5.
- **Cancel fee timing: from the current captain's `accepted_at`**, as the PRD states (fee after 2 minutes from acceptance). A give back starts the clock again, so a rider is never charged for time a captain who left caused.
- **Fee VAT: amounts are VAT inclusive, split in `nouzl_rules`.** The rider sees 8 SAR, as with fares (PRD section 9: VAT included in the shown price). The split into net, VAT and captain share uses the same rule feature 5 settles (whole fare or commission only, pending the accountant), and arrives as lines like `ride_complete`'s. The database checks only timing and the total. Runner up: net amounts with the database adding 15 percent. Rejected because it puts a VAT rule in SQL that feature 5 may contradict, and shows the rider 9.20 SAR for an 8 SAR fee.

**After the cross check (same day).** An independent model reviewed the update. The engineer chose:

- **Give back: a fresh 120 second window each time, at most 2 per ride** (`max_give_backs`, `give_back_count`). One window measured from the first search would make "give back and search again" (PRD section 8) almost never happen, since a captain driving to pickup passes 2 minutes quickly. The cap still stops a ride searching forever. The database picks the outcome, so a give back is never refused for arriving a moment late.
- **A start code lock blocks fees.** Once locked, no show is refused and a rider cancel is free, so a captain cannot type wrong codes to force a fee on a rider who is present.
- **The no show fee is flat** and covers the wait; no metered waiting line on a no show.
- Engineering fixes applied: the database clock is the only clock (fee lines are ignored when no fee applies), fee lines are validated, `cancel_fee_captain_share_bps` became `fee_captain_share_bps`, the final fare invariant covers completed rides only, `no_captain_found` waits for the window and sets `ended_at`, the 5th wrong code returns `locked`, and the probe backdates timestamps.
