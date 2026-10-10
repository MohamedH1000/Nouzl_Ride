# 0002. Ride data model

**Date**: 2026-10-11
**Status**: In Progress

## Summary

This spec designs every database table Nouzl Ride will need, for all 23 features, so that no later slice has to break or rename what an earlier slice built. Each table is created by the feature that first uses it (the core ride tables land now, money tables with payments, safety tables with safety), so production never carries empty tables. All tables live in the shared Supabase database with a `ride_` prefix. Only the backend can write to them, and a rider or a captain can read only their own rows. Money is stored as whole halalas in one double entry ledger (every movement written as balanced debits and credits), so the books always add up.

## Requirements

**User stories**:
- As a rider, I want my rides, quotes, payments and messages to be visible to me and to nobody else, so that my trips and locations stay private.
- As a captain, I want to see the rides I took (including ones I gave back), my offers, shifts, vehicles, documents and payouts, and nothing about other captains.
- As an operator, I want every ride change, money movement, account decision and admin action recorded with who and when, so that I can answer any dispute or audit.
- As the builder, I want each later slice to add its tables without changing the ones before it, so that a slice never needs a breaking migration.

**Acceptance criteria** (feature 3 is done when these hold; all except AC-11 are checked on the staging branch after the core migration, AC-11 is checked on every later ride migration):
- **AC-1**: Signed in as a rider (`authenticated` role with that user's JWT), a select on every core `ride_` table returns only rows that belong to that rider; another rider's rides, quotes, quote options, events and charges return zero rows.
- **AC-2**: Signed in as a captain, a select returns only rides where they are the current `captain_id`, only their own assignments, offers, shifts, vehicles and vehicle ride types, and nothing belonging to another captain; after the captain gives a ride back and the ride returns to `searching`, a select on that ride returns zero rows (a captain whose give back ends the ride as `cancelled_by_captain` stays its `captain_id` and still sees it).
- **AC-3**: As `anon` and as `authenticated`, every `insert`, `update` and `delete` on every `ride_` table fails with a permission error, and `anon` cannot select any `ride_` table at all.
- **AC-4**: As `authenticated`, selecting `ride_rides.start_code_hash` or `start_code_enc`, any geography column (`pickup_point`, `dropoff_point`), or any `*_enc` or `*_hash` column fails with a permission error, even on the user's own row.
- **AC-5**: Two concurrent calls to `ride_assign_captain` for the same `searching` ride with different captains: exactly one returns the assigned ride, the other returns "not assignable", and the ride has exactly one open `ride_assignments` row.
- **AC-6**: Creating a second ride for a rider who already has a ride in an open status (`requested`, `searching`, `accepted`, `arrived`, `in_progress`) fails on the database's unique index; the same holds for a captain holding two rides in `accepted`, `arrived` or `in_progress`.
- **AC-7**: `ride_transition` applies only the edges in the state machine below. An edge not listed is rejected, a stale `expected_version` is rejected, and each accepted transition raises `ride_rides.version` by exactly one, sets the timestamp column the transition table names for that edge (if any), and writes exactly one `ride_ride_events` row, all in one transaction.
- **AC-8**: Deleting a `profiles` row that any `ride_` table references fails with a foreign key violation; no ride, event or charge row is ever removed by a profile delete.
- **AC-9**: A captain profile cannot be saved with a `national_id_hash` already used by another captain (unique violation), and the stored `national_id_enc` value is not the plain number.
- **AC-10**: Every `ride_` table has RLS enabled, appears in no `supabase_realtime` publication, every ride function has a pinned `search_path` and is executable only by `service_role`, and the Supabase advisor reports no new security warnings for ride objects.
- **AC-11**: Every ride migration after the core one is additive only: it creates tables, adds nullable or defaulted columns, adds indexes or functions, or widens a check constraint; it never drops, renames or changes the type of an existing ride column or table. A rider and a captain still see only their own rows in each new table (the AC-1 and AC-2 probe is extended per table).
- **AC-12**: A ride inherits `is_test = true` when its rider or its captain profile has `is_test = true`, and `ride_assign_captain` returns null (raising `ride_test_mismatch`) when a test captain meets a real rider's ride or the other way round.
- **AC-13**: `ride_transition` and `ride_assign_captain` reject an actor who is not the ride's rider or current captain (`ride_actor_not_allowed`); `ride_assign_captain` returns null for a vehicle not approved for the ride type or a male captain on a `woman_captain_only` ride; `ride_create_ride` fails while `requests_paused` is on and for a quote that belongs to another rider or was already used.
- **AC-14**: `ride_complete` writes the charges and the ride totals in one transaction; the totals equal the sum of the charges, and a total above `fare_cap_halalas` is refused with the ride still `in_progress`.
- **AC-15**: `ride_start_ride` with the correct start code hash moves the ride from `arrived` to `in_progress`. A wrong hash leaves the ride `arrived` and raises `start_code_attempts` by exactly one, and that count is still there after the call returns; it returns `wrong_code`, except the wrong attempt that brings the count to `max_start_code_attempts` (the 5th at launch), which returns `locked`. Once locked, every later call returns `locked` without comparing. A call refused for a stale version, wrong status or wrong actor does not count as an attempt. The database never receives the plain 4 digit code.
- **AC-16**: Moving from `requested` to `searching` sets `search_expires_at` to that moment plus the country's `search_window_seconds` (120 at launch). A captain give back is one request; the database decides the outcome. While `give_back_count` is below the country's `max_give_backs` (2 at launch), the ride returns to `searching`, `give_back_count` rises by one and `search_expires_at` restarts at now plus `search_window_seconds`; otherwise the ride ends as `cancelled_by_captain`. `searching` to `no_captain_found` is refused before `search_expires_at`, and `ride_assign_captain` returns null at or after it.
- **AC-17**: The database's own clock decides whether a fee applies. A rider cancel from `accepted` or `arrived` at or after `accepted_at` plus the fare rule's `cancel_after_minutes` charges the cancel fee; `rider_no_show` (refused before `arrived_at` plus `no_show_after_minutes`) charges the no show fee. When a fee applies and is above 0, `p_fee_lines` must be present, valid (see *Cancel and no show fees*) and sum, net plus VAT, to `cancel_fee_halalas` or `no_show_fee_halalas`, else `ride_fee_mismatch`; the lines are written in the same transaction as the status change. When no fee applies, or the fee is 0, any `p_fee_lines` is ignored and nothing is charged. Once the start code is locked, `rider_no_show` is refused and a rider cancel charges no fee.

## Decision

**Chosen option**: Option 1: Full target model, created per slice, backend only writes, transactional Postgres functions (details in [rationale.md](rationale.md)).

Design the whole ride schema now as the target below, create each table in the migration of the feature that first uses it, let only the backend write through `security definer` functions that each run one transaction, and give apps read access to their own rows only.

**Implementation skills**: `postgis` (`postgis/postgis`, `.claude/skills/postgis/`) for geography columns, GiST and BRIN indexes and `ST_Covers` · `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.claude/skills/nestjs-best-practices/`) for the repositories that call the functions · Supabase MCP (connected) for applying migrations to the staging branch and regenerating types.

## Feature design

### Conventions (every ride table)

- **Name and place.** Table names start with `ride_`, live in `public`, migrations in `Nouzl_Backend/supabase/migrations/<timestamp>_ride_<topic>.sql`, each with a matching probe in `supabase/probes/` and a rollback in `supabase/rollbacks/` (the repo's existing pattern).
- **Keys.** `id uuid primary key default gen_random_uuid()`, except settings keyed by code (`ride_countries.code`), join tables (composite key), `ride_trail_points.id bigint generated always as identity`, and `ride_idempotency_keys` (composite key).
- **Time.** `timestamptz`, UTC, defaulting to `now()`. Every mutable table has `created_at` and `updated_at`, with `updated_at` kept by one shared trigger function `ride_touch_updated_at()`. Append only tables have `created_at` only.
- **Money.** `bigint` halalas in columns ending `_halalas`, with a `currency char(3)` on every row that holds money. Rates are integer basis points in columns ending `_bps` (1500 = 15%).
- **Status values.** `text not null` with a `check (... in (...))` constraint. Adding a value later means dropping and recreating the check with a wider list (allowed by AC-11).
- **Places.** `geography(Point, 4326)` for points and `geography(MultiPolygon, 4326)` for zones, with a GiST index wherever a query filters by place.
- **People.** User columns reference `public.profiles(id) on delete restrict`. No ride table copies a name, phone or email; the backend reads those from `profiles` and `auth.users` when it needs them.
- **Sensitive values.** Encrypted by the backend with AES 256 GCM before insert into a `*_enc bytea` column, with a keyed HMAC SHA 256 of the normalized value in `*_hash bytea` (unique where one per person is required), the last four characters in `*_last4 text`, and `pii_key_version smallint` so keys can rotate.
- **Files.** `storage_bucket text` plus `object_key text`, never a public URL. The private storage provider is chosen in feature 7.
- **Grants.** Every migration runs `alter table ... enable row level security`, `revoke all on <table> from anon`, `revoke insert, update, delete, truncate on <table> from authenticated`, then grants `select` on the listed safe columns only for tables apps may read. No table is added to `supabase_realtime` (spec 0001: socket.io carries live events).
- **Functions.** `security definer`, `set search_path = public, pg_temp`, `revoke execute ... from public, anon, authenticated`, `grant execute ... to service_role`.

### Data model sketch

Column lists name the load bearing columns; `id`, `created_at`, `updated_at` follow the conventions above and are not repeated. **F** is the feature whose migration creates the table.

#### Settings and geography

| Table | Columns (type, null) | Keys, links, constraints | F |
|---|---|---|---|
| `ride_countries` | `code char(2)` PK; `name_ar`, `name_en text`; `currency char(3)`; `vat_rate_bps int`; `timezone text`; `default_cash_limit_halalas bigint`; `rating_review_threshold numeric(3,2)`; `rating_review_min_count int`; `trail_retention_days int` (90); `chat_retention_days int` (90); `selfie_retention_days int` (90); `document_retention_days int` (730, counted from the day the captain leaves); `dispute_window_hours int` (72); `min_payout_halalas bigint`; `max_start_code_attempts int` (5); `request_stuck_seconds int` (30); `search_window_seconds int` (120, above 0; how long one search lasts, restarted on each give back); `max_give_backs int` (2; give backs per ride that return it to search); `seller_legal_name_ar`, `seller_legal_name_en`, `seller_vat_number`, `seller_cr_number text` (invoice seller details, null until feature 18); `active boolean` | seeded `SA` | 3 |
| `ride_cities` | `country_code char(2)`; `name_ar`, `name_en text`; `timezone text`; `active boolean` | FK country | 3 |
| `ride_ride_types` | `country_code`; `code text`; `name_ar`, `name_en`; `seats int`; `min_vehicle_seats int`; `max_vehicle_age_years int`; `allowed_vehicle_classes text[]`; `woman_captain_only boolean`; `sort int`; `active boolean` | FK country; unique `(country_code, code)` | 3 (economy seeded) |
| `ride_fare_rules` | `city_id`; `ride_type_id`; `effective_from timestamptz`; `base_halalas`, `per_km_halalas`, `per_minute_halalas`, `minimum_halalas bigint`; `free_wait_minutes int`; `wait_per_minute_halalas bigint`; `no_show_after_minutes int` (5 at launch; counted from `arrived_at`; check `no_show_after_minutes >= free_wait_minutes`); `cancel_after_minutes int` (counted from `accepted_at`); `cancel_fee_halalas bigint` (VAT included); `no_show_fee_halalas bigint` (VAT included, one flat amount that also covers the captain's wait); `fee_captain_share_bps int` (the captain's part of a cancel or no show fee); `commission_bps int`; `min_commission_halalas bigint`; `fare_cap_bps int` (final fare may exceed the estimate by at most this); `currency`; `created_by uuid` | FK city, ride type, profile; unique `(city_id, ride_type_id, effective_from)`; no update or delete (trigger raises) | 3 (table), 5 (values and rule) |
| `ride_runtime_config` | `key text` PK; `value jsonb`; `updated_by uuid` | rows: `requests_paused`, `offers_paused` (spec 0001 kill switch) | 3 |
| `ride_zones` | `city_id`; `kind` (`service_area`, `airport`, `no_pickup`); `name_ar`, `name_en`; `geom geography(MultiPolygon)`; `airport_permit_status` (`none`, `pending`, `granted`, null when not airport); `active` | FK city; GiST on `geom` | 20 |
| `ride_pickup_points` | `zone_id`; `name_ar`, `name_en`; `point geography(Point)`; `active` | FK zone | 20 |

#### People and vehicles

| Table | Columns (type, null) | Keys, links, constraints | F |
|---|---|---|---|
| `ride_rider_profiles` | `user_id uuid` PK; `gender` (`female`, `male`, null; declared by the rider in settings at launch); `gender_verified_at timestamptz null` (stays null until feature 12 decides whether riders verify it); `status` (`active`, `under_review`, `suspended`, `banned`); `rating_avg numeric(3,2) null`; `rating_count int` (0); `is_test boolean` (false); `anonymized_at null` | FK profiles; created on first ride action | 3 |
| `ride_captain_profiles` | `user_id uuid` PK; `country_code`; `status` (`onboarding`, `pending_review`, `approved`, `rejected`, `under_review`, `suspended`, `banned`); `gender` (null until ID verified); `national_id_enc bytea null`, `national_id_hash bytea null`, `national_id_last4 text null`; `date_of_birth_enc bytea null`; `pii_key_version smallint null`; `cash_limit_override_halalas bigint null`; `rating_avg`, `rating_count`; `is_test`; `approved_at`, `approved_by` null; `left_at null` (the captain stopped working with Nouzl; starts the document retention clock); `anonymized_at null` | FK profiles, country; unique `national_id_hash` where not null | 3 (core), 7 (sensitive columns filled) |
| `ride_account_status_changes` | `user_id`; `role` (`rider`, `captain`); `from_status`, `to_status`; `reason text`; `actor_type` (`admin`, `system`); `actor_id null`; `incident_id null`; `case_id null` | FK profiles; append only | 3 |
| `ride_vehicles` | `captain_id`; `make`, `model text`; `year int`; `color_ar`, `color_en`; `plate_number text`; `plate_country char(2)`; `seats int`; `vehicle_class text`; `status` (`pending`, `approved`, `rejected`, `retired`); `is_active boolean` | FK captain profile; unique `(plate_country, plate_number)` where status <> `retired`; unique `(captain_id)` where `is_active` | 3 |
| `ride_vehicle_ride_types` | `vehicle_id`, `ride_type_id`; `approved_by`; `approved_at` | PK both; FK vehicle, ride type | 3 |
| `ride_document_types` | `country_code`; `code text`; `applies_to` (`captain`, `vehicle`); `required boolean`; `has_expiry boolean`; `name_ar`, `name_en`; `sort int` | unique `(country_code, code)` | 7 |
| `ride_documents` | `document_type_id`; `captain_id`; `vehicle_id null`; `storage_bucket`, `object_key`, `content_type`; `expires_at null`; `status` (`pending`, `approved`, `rejected`, `expired`, `superseded`); `reviewed_by`, `reviewed_at`, `rejection_reason` null; `superseded_by uuid null` | FK type, captain, vehicle, self; index `(captain_id, status, expires_at)` | 7 |
| `ride_captain_bank_accounts` | `captain_id`; `iban_enc`, `iban_hash`, `iban_last4`; `pii_key_version`; `holder_name text`; `verified_at null`; `is_default boolean`; `archived_at null` | FK captain; unique `(captain_id)` where `is_default and archived_at is null`; unique `iban_hash` where `archived_at is null` | 7 |
| `ride_captain_shifts` | `captain_id`; `vehicle_id`; `online_at`; `offline_at null`; `end_reason` (`manual`, `location_off`, `ping_lost`, `signed_out`, `mode_switch`, `admin`) null; `selfie_bucket`, `selfie_object_key` null; `selfie_check_status` (`pending`, `matched`, `mismatch`, `manual_review`) null; `selfie_reference_document_id null` (the approved `profile_selfie` document it was compared with) | FK captain, vehicle, document; unique `(captain_id)` where `offline_at is null` | 3 (selfie columns used in 11) |

#### Rides

| Table | Columns (type, null) | Keys, links, constraints | F |
|---|---|---|---|
| `ride_quotes` | `rider_id`; `city_id`; `pickup_point`, `dropoff_point geography(Point)`; `pickup_address`, `dropoff_address text`; `dropoff_area_label text`; `distance_m int`; `duration_s int`; `route_polyline text`; `expires_at` | FK rider profile, city | 3 |
| `ride_quote_options` | `quote_id`; `ride_type_id`; `fare_rule_id`; `estimate_halalas`, `estimate_net_halalas`, `estimate_vat_halalas`, `estimate_commission_halalas bigint`; `currency`; `pickup_eta_s int null` | FK quote, ride type, fare rule; unique `(quote_id, ride_type_id)` | 3 |
| `ride_rides` | `ride_number bigint` (sequence `ride_number_seq`); `rider_id`; `captain_id null`; `vehicle_id null`; `city_id`; `ride_type_id`; `quote_option_id`; `fare_rule_id`; `status`; `version int` (1); `payment_method` (`cash`, `card`, `apple_pay`); `pickup_point`, `dropoff_point`; `pickup_address`, `dropoff_address`, `dropoff_area_label`; `estimate_halalas`; `fare_cap_halalas`; `final_fare_halalas`, `vat_halalas`, `commission_halalas`, `captain_earning_halalas` null until end; `currency`; `actual_distance_m`, `actual_duration_s` null; `route_polyline text null`; `woman_captain_only boolean` (copied from the ride type at creation); `start_code_hash bytea null` (HMAC SHA 256 of the 4 digit code, computed by the backend with `RIDE_START_CODE_HMAC_KEY` and compared byte for byte inside `ride_start_ride`); `start_code_enc bytea null` (the same code encrypted with `RIDE_START_CODE_ENC_KEY`, so the backend can show it to the rider again after an app restart); both set at assignment; `start_code_attempts int` (0, reset to 0 at each assignment); `search_expires_at null` (set when search starts, restarted on each give back that returns the ride to search); `give_back_count int` (0); `legal_hold_until timestamptz null` (purge skips the ride while set); `requested_at`, `accepted_at`, `arrived_at`, `started_at`, `ended_at`, `cancelled_at` null; `cancel_reason text null`; `is_test boolean`; `anonymized_at null` | FK all links; unique `ride_number`; unique `quote_option_id` (one ride per quote option); status check lists open plus terminal values (`completed`, `no_captain_found`, `cancelled_by_rider`, `cancelled_by_captain`, `rider_no_show`, `cancelled_by_admin`); partial unique `(rider_id)` where status in open; partial unique `(captain_id)` where status in (`accepted`, `arrived`, `in_progress`); index `(captain_id, requested_at desc)`, `(rider_id, requested_at desc)`, `(status)` where open | 3 |
| `ride_ride_events` | `ride_id`; `from_status null`, `to_status`; `version int`; `actor_type` (`rider`, `captain`, `system`, `admin`); `actor_id null`; `reason text null`; `point geography(Point) null` | FK ride; unique `(ride_id, version)`; append only | 3 |
| `ride_assignments` | `ride_id`; `captain_id`; `vehicle_id`; `offer_id null`; `assigned_at`; `released_at null`; `release_reason` (`completed`, `captain_cancelled`, `rider_cancelled`, `no_show`, `admin`) null | FK ride, captain, vehicle, offer; unique `(ride_id)` where `released_at is null` | 3 |
| `ride_offers` | `ride_id`; `captain_id`; `round int`; `distance_m int`; `eta_s int`; `dropoff_area_label`; `estimated_earning_halalas`; `currency`; `sent_at`; `expires_at`; `responded_at null`; `outcome` (`pending`, `accepted`, `declined`, `timed_out`, `withdrawn`) | FK ride, captain; unique `(ride_id, captain_id, round)`; `round` keeps counting across the whole ride, including after a captain gives it back; index `(captain_id, sent_at desc)` | 3 |
| `ride_destination_changes` | `ride_id`; `old_point`, `new_point`; `old_address`, `new_address`; `new_estimate_halalas`; `new_fare_cap_halalas`; `currency`; `requested_by` | FK ride; append only | 9 |
| `ride_trail_points` | `id bigint identity`; `ride_id`; `captain_id`; `point geography(Point)`; `recorded_at`; `speed_mps real null`; `heading real null`; `accuracy_m real null`; `kind` (`sample`, `milestone`) | FK ride, captain; btree `(ride_id, recorded_at)`; BRIN `(recorded_at)`; append only, deleted only by the retention job | 9 |
| `ride_idempotency_keys` | `user_id`; `endpoint text`; `key text`; `request_hash bytea`; `status` (`in_progress`, `done`); `response_status int null`; `response_body jsonb null`; `created_at` | PK `(user_id, endpoint, key)`; inserted as the first statement of the request (a conflicting `in_progress` row returns 409, a `done` row replays the stored response); rows older than 24 h deleted by `ride_purge_expired` | 3 |

#### Money

| Table | Columns (type, null) | Keys, links, constraints | F |
|---|---|---|---|
| `ride_charges` | `ride_id`; `kind` (`base`, `distance`, `time`, `minimum_topup`, `waiting`, `cancel_fee`, `no_show_fee`, `destination_change`, `adjustment`); `net_halalas`, `vat_halalas bigint` (negative only for `adjustment` and `refund`); `payer` (`rider`, `captain`); `beneficiary` (`captain`, `platform`); `captain_share_halalas bigint` (the part of the line the captain earns; from `fee_captain_share_bps` for cancel and no show fees, the line minus its commission share for fare lines); `currency`; `case_id null` | FK ride, case; kinds also include `refund`; append only (a correction is a new `adjustment` or `refund` line) | 3 |
| `ride_ledger_accounts` | `kind` (`captain_earnings`, `captain_cash_due`, `platform_revenue`, `vat_payable`, `gateway_clearing`, `payout_clearing`, `rider_refunds`); `captain_id null`; `currency`; `balance_halalas bigint` (0; cache of the sum of its lines) | unique `(kind, captain_id, currency)` nulls not distinct; `balance_halalas` written only by `ride_post_journal_entry` under `select ... for update` on the account rows | 14 |
| `ride_journal_entries` | `kind` (`ride_cash`, `ride_card`, `fee`, `refund`, `cash_offset`, `payout`, `payout_failed`, `adjustment`); `source_type` (`ride`, `payment`, `payout`, `case`); `source_id uuid`; `attempt int` (1; raised for a second refund on the same case or a payout retry); `captain_id null` (the captain the entry concerns, for RLS); `ride_id`, `payout_id`, `case_id` null; `memo text null` (no personal data); `posted_at`; `is_test` | unique `(source_type, source_id, kind, attempt)`; append only | 14 |
| `ride_journal_lines` | `entry_id`; `account_id`; `amount_halalas bigint` (debit positive, credit negative, never 0); `currency`; `charge_id null` (the `ride_charges` line it settles) | FK entry, account, charge; deferred constraint trigger: each entry has at least two lines and its lines sum to 0 per currency; append only; index `(account_id, created_at)` | 14 |
| `ride_payments` | `ride_id`; `method` (`card`, `apple_pay`); `provider text`; `provider_ref text null`; `authorized_halalas`, `captured_halalas`, `refunded_halalas bigint` (0); `currency`; `status` (`pending`, `authorized`, `captured`, `released`, `partially_refunded`, `refunded`, `failed`) | unique `(ride_id)`; unique `(provider, provider_ref)` | 13 |
| `ride_payment_events` | `payment_id`; `kind` (`authorize`, `capture`, `release`, `refund`, `callback`); `provider_event_id text`; `amount_halalas null`; `payload jsonb` (scrubbed of card data); `received_at` | unique `(payment_id, kind, provider_event_id)`; append only | 13 |
| `ride_payout_runs` | `country_code`; `period_start`, `period_end date`; `status` (`open`, `processing`, `done`, `failed`) | unique `(country_code, period_start)` | 15 |
| `ride_payouts` | `run_id`; `captain_id`; `bank_account_id`; `amount_halalas`; `currency`; `status` (`pending`, `sent`, `paid`, `failed`, `held`); `attempts int`; `provider_ref null`; `failure_reason null`; `paid_at null`; `statement_bucket`, `statement_object_key` null | unique `(run_id, captain_id)`; `amount_halalas > 0` (a captain whose earnings minus cash due is below `min_payout_halalas` or negative gets no payout row; the balance carries to the next week); `attempts` capped at 5, then status `held` and an admin alert | 15 |
| `ride_payout_items` | `payout_id`; `journal_entry_id`; `ride_id null`; `amount_halalas` | FK payout, entry, ride; unique `(journal_entry_id)` (an entry is paid out once); the payout amount equals the sum of its items, and the statement lists them | 15 |
| `ride_invoice_counters` | `country_code` PK; `invoice_type`; `last_number bigint` | locked with `select ... for update` per issue, so numbers have no gaps (ZATCA) | 18 |
| `ride_invoices` | `invoice_number text`; `type` (`rider_simplified`, `captain_commission`, `credit_note`); `ride_id null`; `payout_id null`; `case_id null` (a credit note from a dispute); `credited_invoice_id null`; `seller_name`, `seller_vat_number` (copied from `ride_countries` at issue); `buyer_user_id null`; `total_halalas`, `vat_halalas`; `currency`; `zatca_uuid uuid null`; `invoice_hash`, `previous_invoice_hash`, `qr_tlv text` null; `xml_bucket`, `xml_object_key` null; `status` (`issued`, `reported`, `rejected`); `issued_at` | unique `invoice_number` (from `ride_invoice_counters`); immutable once `issued` | 18 (ZATCA columns filled in 21) |

#### Contact, safety, support, admin

| Table | Columns (type, null) | Keys, links, constraints | F |
|---|---|---|---|
| `ride_messages` | `ride_id`; `sender_role` (`rider`, `captain`, `system`); `sender_id null`; `body text` (max 1000); `read_at null` | FK ride; index `(ride_id, created_at)`; append only except `read_at` | 10 |
| `ride_call_sessions` | `ride_id`; `case_id null`; `provider`; `provider_session_id`; `started_at`, `ended_at`, `duration_s` null | FK ride, case | 10 |
| `ride_share_tokens` | `ride_id`; `token_hash bytea`; `expires_at`; `revoked_at null` | unique `token_hash` | 11 |
| `ride_safety_incidents` | `ride_id null`; `kind` (`sos`, `route_deviation`, `long_stop`, `serious_report`, `selfie_mismatch`); `severity` (`critical`, `high`, `normal`); `reporter_role`, `reporter_id` null; `point geography(Point) null`; `status` (`open`, `acknowledged`, `resolved`, `false_alarm`); `assignee_id null`; `acknowledged_at`, `resolved_at` null | FK ride; index `(status, severity, created_at)`; partial unique `(ride_id, kind)` where status in (`open`, `acknowledged`), so a repeated alert updates the open incident instead of adding a second | 11 |
| `ride_incident_events` | `incident_id`; `action` (`alerted`, `acknowledged`, `called_rider`, `called_captain`, `called_authorities`, `suspended_account`, `note`, `resolved`); `actor_id null`; `note null` | append only | 11 |
| `ride_cases` | `ride_id`; `kind` (`fare_dispute`, `lost_item`, `behaviour`, `other`); `opened_by`; `opened_by_role`; `status` (`open`, `in_progress`, `resolved`, `rejected`); `resolution text null`; `refund_entry_id null`; `incident_id null`; for lost items: `item_description text null`, `item_status` (`reported`, `captain_contacted`, `found`, `returned`, `not_found`) null, `contact_expires_at timestamptz null` (when the masked contact closes) | FK ride, journal entry, incident; a check requires the item columns when `kind = 'lost_item'`; an open case sets the ride's `legal_hold_until` | 16 |
| `ride_case_events` | `case_id`; `action`; `actor_id null`; `note null` | append only | 16 |
| `ride_ratings` | `ride_id`; `rater_id`; `rater_role` (`rider`, `captain`); `ratee_id`; `stars smallint` (1 to 5); `tags text[]`; `comment text null` | unique `(ride_id, rater_role)`; append only | 17 |
| `ride_admin_actions` | `admin_id`; `capability text`; `action text`; `target_type`, `target_id`; `before`, `after jsonb null`; `reason text null` | append only; index `(target_type, target_id)` | 7 |

**Shared table change (feature 8):** widen `device_tokens.app` check from `('customer', 'business')` to include `'ride'`, so ride pushes reach only the Ride app. This is the only change to a non ride table.

### State transitions

`ride_rides.status` (PRD section 8). Open statuses: `requested`, `searching`, `accepted`, `arrived`, `in_progress`.

```
requested ──▶ searching ──▶ accepted ──▶ arrived ──▶ in_progress ──▶ completed
                 │             │            │             │
                 ▼             │            ├──▶ rider_no_show
          no_captain_found     │            │
                               └─(captain cancels, search window open)──▶ searching
                               └─(captain cancels, window closed)───────▶ cancelled_by_captain
 requested | searching | accepted | arrived ──▶ cancelled_by_rider
 any open status ──▶ cancelled_by_admin
```

| From | To | Actor | Side effects in the same transaction |
|---|---|---|---|
| `requested` | `searching` | system, reason `search_started` | sets `search_expires_at` to now plus the country's `search_window_seconds` |
| `requested` | `no_captain_found` | system, when the ride sat in `requested` longer than `request_stuck_seconds` | reason `request_stuck`; `ended_at`; nothing is charged |
| `searching` | `accepted` | captain via `ride_assign_captain` | sets `captain_id`, `vehicle_id`, `accepted_at`, `start_code_hash`, `start_code_enc`; resets `start_code_attempts` to 0; inserts assignment; offer `accepted`, other pending offers `withdrawn` |
| `searching` | `no_captain_found` | system, reason `search_window_elapsed`, refused before `search_expires_at` (PRD M11) | `ended_at`; pending offers `withdrawn`; nothing is charged |
| `accepted` | `arrived` | captain | `arrived_at` |
| `arrived` | `in_progress` | captain via `ride_start_ride` only, with the start code hash | the hash must equal `start_code_hash`; `started_at`. A wrong hash is not an error: it raises `start_code_attempts` by one and returns `wrong_code` (no status change, no version change, no event), so the count is kept. At `max_start_code_attempts` it returns `locked` (feature 11 extends this to open a `normal` safety incident) |
| `in_progress` | `completed` | captain via `ride_complete` only | `ended_at`; charges written and totals computed in the same call; assignment released `completed` |
| `accepted`, `arrived` | `searching` | captain give back, while `give_back_count < max_give_backs` | clears `captain_id`, `vehicle_id`, `accepted_at`, `arrived_at`, `start_code_hash`, `start_code_enc`; `give_back_count` plus one; `search_expires_at` restarts at now plus `search_window_seconds`; assignment released `captain_cancelled` |
| `accepted`, `arrived` | `cancelled_by_captain` | captain give back, once `give_back_count` has reached `max_give_backs` | `cancelled_at`; `captain_id` kept (the captain still sees the ride they ended); assignment released `captain_cancelled`; nothing charged to the rider |
| `requested`, `searching`, `accepted`, `arrived` | `cancelled_by_rider` | rider | `cancelled_at`, `cancel_reason`; any assignment released `rider_cancelled`; `cancel_fee` lines when the fee applies (below) |
| `arrived` | `rider_no_show` | captain, at or after `arrived_at` plus `no_show_after_minutes`, and only while the start code is not locked | `cancelled_at`; assignment released `no_show`; `no_show_fee` lines (below) |
| any open | `cancelled_by_admin` | admin | `cancelled_at`, `cancel_reason`; assignment released `admin` |

A rider cannot cancel an `in_progress` ride; a rider in trouble uses SOS (feature 11), and the captain or an admin ends the ride.

**Captain give back.** The captain sends one give back request (`p_to_status` `searching` or `cancelled_by_captain`, treated the same); the database picks the edge from `give_back_count`, so a request is never refused for arriving a moment too late. The repository reads the outcome from the returned ride's `status`.

**Cancel and no show fees.** Fee amounts in the fare rule (`cancel_fee_halalas`, `no_show_fee_halalas`) are what the rider sees, VAT included, like fares (PRD section 9). The no show fee is one flat amount that also covers the captain's wait (no metered waiting line). The backend builds the fee lines with the fee rule in `nouzl_rules` (feature 5), which splits each fee into `net_halalas`, `vat_halalas` and `captain_share_halalas` by the VAT basis feature 5 confirms (whole fare or commission only) and `fee_captain_share_bps`, with `payer = rider` and `beneficiary = captain`. Whenever a rider cancels from `accepted` or `arrived`, or a captain marks a no show, it passes them to `ride_transition` as `p_fee_lines` (same JSON keys as `ride_complete`: `kind`, `net_halalas`, `vat_halalas`, `payer`, `beneficiary`, `captain_share_halalas`; currency comes from the ride). `ride_transition` does not compute VAT, and its own `now()` is the only clock. It checks:

- **When a fee applies.** `cancelled_by_rider` from `accepted` or `arrived` at or after `accepted_at` plus `cancel_after_minutes` (the clock starts at the current captain's acceptance, so a give back starts it again), unless the start code is locked; `rider_no_show` always (it is only allowed after `no_show_after_minutes`, and never while the start code is locked). Cancels from `requested` or `searching`, rider cancels before the clock runs out, and any cancel after a start code lock never charge a fee.
- **That the lines match.** When a fee applies and the fare rule's fee is above 0, `p_fee_lines` must be a non empty array; every line must have the matching kind (`cancel_fee` or `no_show_fee`), `payer = rider`, `beneficiary = captain`, `net_halalas` and `vat_halalas` of 0 or more, and `captain_share_halalas` between 0 and the line's net plus VAT; and the lines' net plus VAT must equal the fee amount. Anything else raises `ride_fee_mismatch`. When no fee applies or the fee is 0, `p_fee_lines` is ignored (null, empty or present all mean no charge), so the backend never has to guess the database's clock.
- **Card rides** capture the fee from the hold in feature 13; cash fees join the captain's cash balance in feature 14. Neither changes these lines.

Captain profile: `onboarding → pending_review → approved | rejected`; `rejected → pending_review` (resubmit); `approved ⇄ under_review`; `approved | under_review → suspended → approved | banned`. Rider profile: `active ⇄ under_review`; `active | under_review → suspended → active | banned`. Every change writes `ride_account_status_changes`.

### Database functions (the write surface)

The backend's ride repositories call these through `supabase.rpc`. Each runs as one transaction, checks its preconditions, and raises a named error (`ride_not_assignable`, `ride_stale_version`, `ride_invalid_transition`, `ride_open_ride_exists`, `ride_test_mismatch`, `ride_actor_not_allowed`, `ride_requests_paused`, `ride_fee_mismatch`) that the repository maps to a typed result. The one exception is a wrong start code: `ride_start_ride` returns it as an outcome instead of raising, because a raised error would roll back the attempt count.

**Actor check.** Every ride function verifies the actor itself, per edge: a `rider` actor must equal `rider_id`; a `captain` actor must equal the current `captain_id` (for `ride_assign_captain`, the offer's captain, with the offer `pending` and not expired); `admin` and `system` actors are accepted only with a non null `p_reason`. This holds even though only the service role can call the functions, so one repository bug cannot let a user move someone else's ride.

| Function | Inputs | Output | Key errors | F |
|---|---|---|---|---|
| `ride_create_ride` | `p_rider_id`, `p_quote_option_id`, `p_payment_method` | ride row (status `requested`, version 1) plus its first event. Checks: `requests_paused` is off; the quote belongs to `p_rider_id` and has not expired; copies `woman_captain_only` from the ride type and refuses it unless the rider's gender is `female`; sets `is_test` from the rider profile | `ride_requests_paused`, `ride_quote_expired`, `ride_open_ride_exists` (also from the unique `quote_option_id`), `ride_type_not_allowed` | 3 |
| `ride_transition` | `p_ride_id`, `p_to_status`, `p_expected_version`, `p_actor_type`, `p_actor_id`, `p_reason`, `p_point`, `p_fee_lines jsonb null` (only on `cancelled_by_rider` and `rider_no_show`, see *Cancel and no show fees*) | updated ride row. Takes no free form fields: each edge sets only the columns listed in the transition table. `accepted`, `in_progress` and `completed` are refused here (use `ride_assign_captain`, `ride_start_ride`, `ride_complete`). A captain give back picks its edge itself (see *Captain give back*) | `ride_invalid_transition` (also an edge used too early: a stuck request before `request_stuck_seconds`, `no_captain_found` before `search_expires_at`, a no show before `no_show_after_minutes` or after a start code lock), `ride_stale_version`, `ride_actor_not_allowed`, `ride_fee_mismatch` | 3 |
| `ride_start_ride` | `p_ride_id`, `p_expected_version`, `p_captain_id`, `p_start_code_hash bytea` (HMAC computed by the backend), `p_point` | `(outcome, ride)` where `outcome` is `started` (ride moved to `in_progress`, version plus one, one event), `wrong_code` (attempt counted, ride otherwise unchanged) or `locked` (the attempt that reached the country's `max_start_code_attempts`, or any call after it; nothing compared once locked). The returned ride is the row after the call. Locks the ride row (`select ... for update`), then checks in order: actor, status `arrived`, version, lock, compare. A failed actor, status or version check raises and counts nothing. Never raises for a wrong code, so the attempt count commits | `ride_invalid_transition` (not `arrived`), `ride_stale_version`, `ride_actor_not_allowed` | 3 (feature 11 adds the safety incident on `locked`) |
| `ride_assign_captain` | `p_ride_id`, `p_captain_id`, `p_vehicle_id`, `p_offer_id`, `p_start_code_hash`, `p_start_code_enc` | ride row, or null when not assignable (already taken, captain already busy, ineligible, the captain's own offer no longer `pending` or expired, or now at or after the ride's `search_expires_at`; the offer is then set `withdrawn`). An offer that belongs to another ride or captain raises `ride_actor_not_allowed`. Checks status only, not version, and raises the version by one. Resets `start_code_attempts` to 0. Checks: `offers_paused` is off; the vehicle is the captain's active approved vehicle with a `ride_vehicle_ride_types` row for the ride type; the captain is `approved`; if `woman_captain_only`, the captain's gender is `female`; test flags match | `ride_test_mismatch`, `ride_requests_paused`, `ride_actor_not_allowed` | 3 |
| `ride_complete` | `p_ride_id`, `p_expected_version`, `p_captain_id`, `p_actual_distance_m`, `p_actual_duration_s`, `p_route_polyline`, `p_lines jsonb` (the charge lines computed by the fare rule in `nouzl_rules`) | completed ride row. Inserts the charges, then computes `final_fare_halalas`, `vat_halalas`, `commission_halalas` and `captain_earning_halalas` from those lines itself, refuses a total above `fare_cap_halalas`, and moves the ride to `completed`, all in one transaction | `ride_over_fare_cap`, `ride_stale_version`, `ride_actor_not_allowed` | 3 |
| `ride_set_account_status` | `p_user_id`, `p_role`, `p_to_status`, `p_reason`, `p_actor`, `p_incident_id`, `p_case_id` | profile row | `ride_invalid_transition` | 3 |
| `ride_post_journal_entry` | `p_kind`, `p_source_type`, `p_source_id`, `p_attempt`, `p_captain_id`, links | entry id (existing id when the same source, kind and attempt was already posted). Builds the lines itself from the posting recipe for `p_kind` (below) and the source's charges or payment, locks the touched accounts, updates their `balance_halalas` | `ride_unbalanced_entry`, `ride_unknown_kind` | 14 |
| `ride_create_payout_run` | `p_country_code`, `p_period_start`, `p_period_end` | run id; one payout per captain whose earnings minus cash due is at least `min_payout_halalas`, with `ride_payout_items` for every unpaid earning entry, posted as a `payout` entry | `ride_run_exists` | 15 |
| `ride_record_rating` | `p_ride_id`, `p_rater_id`, `p_rater_role`, `p_stars`, `p_tags`, `p_comment` | rating id; updates the ratee's `rating_avg` and `rating_count` | `ride_already_rated`, `ride_not_rateable` | 17 |
| `ride_anonymize_user` | `p_user_id` | counts of rows changed. Sets the session flag `ride.anonymizing = on` (the append only triggers allow an update only while it is on, and only on the columns listed under *Personal columns*), then clears those columns for the user | none | 21 |
| `ride_purge_expired` | none (reads retention days per country) | counts deleted. Skips any ride whose `legal_hold_until` is in the future, or that has an open case or open incident | none | 3 (idempotency keys), 9 (trail), 10 (chat), 11 (selfies) |

`ride_assign_captain` is the spec 0001 single conditional update: `update ride_rides set ... where id = p_ride_id and status = 'searching' and captain_id is null returning *`, followed by the assignment, offer and event writes only if a row came back. A unique violation on the captain's open ride index is caught inside the function and returned as null, never raised.

**Money order for a ride.** `ride_complete` (charges) → card rides: capture the final fare from the hold (feature 13), and cancel or no show fees on card rides are captured from the same hold → `ride_post_journal_entry` for the ride. A cash ride posts at completion. A failed capture leaves the ride `completed` with `ride_payments.status = 'failed'`, and the journal posts only on a successful capture.

**Posting recipes** (feature 14; debit positive, credit negative; `F` = final fare, `K` = commission, `T` = all VAT the platform remits on the ride, `E` = captain earning, so `F = E + K + T`):

| Kind | Lines |
|---|---|
| `ride_cash` | `captain_cash_due` +(K + T) · `platform_revenue` −K · `vat_payable` −T (the captain collected F in cash and owes the platform its share) |
| `ride_card` | `gateway_clearing` +F · `captain_earnings` −E · `platform_revenue` −commission · `vat_payable` −VAT |
| `fee` | as `ride_cash` or `ride_card` by payment method, split by each charge's `captain_share_halalas` |
| `refund` | `platform_revenue` and `captain_earnings` +their shares of the refunded lines · `vat_payable` +VAT · `rider_refunds` −total |
| `cash_offset` | `captain_earnings` +X · `captain_cash_due` −X, where X is the smaller of the two balances, run before each payout |
| `payout` | `captain_earnings` +amount · `payout_clearing` −amount |
| `payout_failed` | `payout_clearing` +amount · `captain_earnings` −amount |
| `adjustment` | admin entered balanced lines with a reason, logged in `ride_admin_actions` |

Feature 5 confirms whether VAT applies to the whole fare or to the commission only; only the VAT amounts in these recipes change, not the accounts.

**Personal columns** (what `ride_anonymize_user` clears, keeping amounts, statuses and timestamps): `ride_rides` addresses, points, `dropoff_area_label`, `route_polyline`; `ride_quotes` the same; `ride_ride_events.point`; `ride_destination_changes` points and addresses; `ride_trail_points` (deleted); `ride_messages.body`; `ride_share_tokens` (deleted); `ride_safety_incidents.point`; `ride_cases` `resolution` and `item_description`; `ride_ratings.comment`; `ride_admin_actions` `before` and `after` (replaced by the list of changed keys); `ride_captain_profiles` `*_enc`, `*_last4`; `ride_captain_bank_accounts` `iban_enc`, `iban_last4`, `holder_name`; documents and selfies (objects deleted, rows kept with keys nulled). Hashes are kept so a banned person cannot sign up again.

### Read surface (RLS)

Admin screens read through the backend's service role, behind `@RequireAdminCapability` (spec 0001), so no policy exists for admins. The app reads only what is listed here; everything else is reached through REST.

| Table | Who may select (as `authenticated`) | Columns granted |
|---|---|---|
| `ride_countries`, `ride_cities`, `ride_ride_types` | anyone signed in, `active = true` | all |
| `ride_rider_profiles` | `user_id = auth.uid()` | all except `anonymized_at` |
| `ride_captain_profiles` | `user_id = auth.uid()` | all except `*_enc`, `*_hash`, `pii_key_version` |
| `ride_vehicles`, `ride_vehicle_ride_types` | the owning captain | all |
| `ride_captain_shifts` | the owning captain | all except selfie bucket and key |
| `ride_quotes`, `ride_quote_options` | the quote's rider | all except geography columns |
| `ride_rides` | `rider_id = auth.uid()` or `captain_id = auth.uid()` (the current captain only) | all except `start_code_hash`, `start_code_enc`, `pickup_point`, `dropoff_point`, `legal_hold_until` |
| `ride_ride_events` | same rule as its ride | all except `point` |
| `ride_assignments` | the ride's rider, and the captain of that assignment row (`captain_id = auth.uid()`), so a captain sees their own past assignments but not the ride behind them | all |
| `ride_offers` | `captain_id = auth.uid()` | all |
| `ride_charges` | same rule as its ride | all |
| `ride_documents` | the owning captain | all except bucket and key (files served by signed URL from the backend) |
| `ride_captain_bank_accounts` | the owning captain | `id`, `iban_last4`, `holder_name`, `verified_at`, `is_default` |
| `ride_payments` | `exists (select 1 from ride_rides r where r.id = ride_id and r.rider_id = auth.uid())` | all except `payload` |
| `ride_invoices` | `buyer_user_id = auth.uid()` for rider invoices; for `captain_commission`, `exists` a payout of that invoice with `captain_id = auth.uid()` | all except file keys |
| `ride_payouts`, `ride_payout_items` | `captain_id = auth.uid()` (items through their payout) | all except file keys |
| `ride_ledger_accounts` | `captain_id = auth.uid()` | all |
| `ride_journal_lines` | `exists (select 1 from ride_ledger_accounts a where a.id = account_id and a.captain_id = auth.uid())`, so a captain sees only the lines on their own accounts, never the platform side | all |
| `ride_journal_entries` | nobody (captains see entries through their lines and the payout statement from REST) | none |
| `ride_messages`, `ride_call_sessions` | the ride's rider and its current captain (same rule as `ride_rides`); after the ride ends the rows stay readable, writes stop (the backend refuses new messages once the ride is terminal) | all |
| `ride_ratings` | the rater (their own given ratings) | all |
| `ride_cases` | the case opener | all |
| every other ride table | nobody | none |

Policies that check a ride go through one `stable security definer` helper, `ride_user_can_read_ride(p_ride_id uuid)` (`rider_id = auth.uid() or captain_id = auth.uid()`), so the rule exists once.

**Captain history of rides they gave back** comes from REST (`GET /rides/v1/captain/history`), which returns a limited view (ride number, times, release reason, any fee they owe), because column grants apply to every row and cannot hide the next captain or the final fare from a former captain.

### Value sourcing

| Action | Value produced or displayed | Source |
|---|---|---|
| Create quote | city | slice 1: the single active `ride_cities` row (Riyadh, seeded); feature 20: the city whose `service_area` zone `ST_Covers` the pickup point |
| Create quote | distance, duration, polyline | Google Routes, called by the backend (spec 0001) |
| Create quote | `dropoff_area_label` | backend reverse geocode of the drop off point to its district (Google Geocoding `sublocality`), stored on the quote, copied to ride and offer |
| Create quote option | `fare_rule_id` | latest `ride_fare_rules` row for the city and ride type with `effective_from <= now()` |
| Create quote option | estimate, net, VAT, commission | fare rule in `nouzl_rules` (feature 5) applied to the rule row, the Routes distance and duration, and `ride_countries.vat_rate_bps` |
| Create quote option | currency | `ride_countries.currency` through the city |
| Create ride | `ride_number` | `nextval('ride_number_seq')` |
| Create ride | `fare_cap_halalas` | estimate plus `fare_rule.fare_cap_bps` |
| Create ride | `is_test` | `rider_profile.is_test` (captain checked again at assignment) |
| Create ride | payment method | request input |
| Any transition | `version` | previous `version` plus one, in `ride_transition` |
| Any transition | actor | the user id from the verified JWT, or `system` for jobs |
| Offer | `estimated_earning_halalas` | quote option estimate minus estimate commission |
| Ride type visibility | rider is a woman | `ride_rider_profiles.gender`, declared by the rider at launch; feature 12 decides whether to verify it |
| Matching | captain is a woman | `ride_captain_profiles.gender`, set from the verified national ID in feature 7 |
| Matching | captain eligible for the type | `ride_vehicle_ride_types` row for the active vehicle |
| Matching (feature 14) | cash limit | `cash_limit_override_halalas`, else `ride_countries.default_cash_limit_halalas` |
| Matching (feature 14) | cash due | `ride_ledger_accounts.balance_halalas` of the captain's `captain_cash_due` account (cache; the sum of its lines is the truth and a probe compares them) |
| Accept ride | start code | four random digits generated by the backend before `ride_assign_captain`, stored as `start_code_hash` (HMAC SHA 256 with `RIDE_START_CODE_HMAC_KEY`) and `start_code_enc` (AES 256 GCM with `RIDE_START_CODE_ENC_KEY`); shown to the rider only through REST |
| Start ride | code hash to compare | the backend's HMAC SHA 256 of the digits the captain typed, with `RIDE_START_CODE_HMAC_KEY`; the database compares bytes and never sees the digits |
| Start ride | attempts left, lock | `ride_rides.start_code_attempts` against the country's `max_start_code_attempts` |
| Start search | `search_expires_at` | first `requested` to `searching` time plus `ride_countries.search_window_seconds` (through the ride's city) |
| Captain gives ride back | back to search or end | `ride_rides.give_back_count` compared with `ride_countries.max_give_backs` |
| Captain gives ride back | new search end | now plus `ride_countries.search_window_seconds` |
| Search ends | earliest `no_captain_found` | `search_expires_at` compared with the database's now |
| Rider cancel | whether a fee applies | `accepted_at` plus `ride_fare_rules.cancel_after_minutes` (the ride's `fare_rule_id`) compared with the database's now; no fee once `start_code_attempts` has reached `max_start_code_attempts` |
| No show | earliest allowed time | `arrived_at` plus `ride_fare_rules.no_show_after_minutes` |
| Cancel or no show | fee total | `ride_fare_rules.cancel_fee_halalas` or `no_show_fee_halalas`, VAT included |
| Cancel or no show | net, VAT, captain share per fee line | the fee rule in `nouzl_rules` (feature 5): VAT basis confirmed by the accountant, `ride_countries.vat_rate_bps`, `ride_fare_rules.fee_captain_share_bps` |
| Payout | amount | sum of its `ride_payout_items`, after the `cash_offset` entry |
| Invoice | seller name and VAT number | `ride_countries.seller_*`, copied at issue |
| Invoice | number | next value of `ride_invoice_counters` for the country and type |
| Retention job | days to keep | `ride_countries.*_retention_days` |
| Receipt and statement | fare lines | `ride_charges` rows of the ride |
| Display times | local time | `ride_cities.timezone` (stored values are UTC) |

### Key invariants

- A ride has at most one captain at a time: `ride_assign_captain` assigns only from `searching` with `captain_id is null`, and `ride_assignments` has at most one unreleased row per ride.
- A rider has at most one open ride; a captain has at most one ride in `accepted`, `arrived` or `in_progress`; a captain has at most one open shift and one active vehicle.
- `ride_rides.version` equals the count of its `ride_ride_events` rows, and every status change has exactly one event.
- For a `completed` ride, `final_fare_halalas` equals the sum of the ride's `ride_charges` net plus VAT, written only by `ride_complete`; a cancelled or no show ride keeps `final_fare_halalas` null and its fee is read from its `cancel_fee` or `no_show_fee` lines (adjustments and refunds after completion are later charge lines, so the invariant holds on the lines written at completion); `final_fare_halalas <= fare_cap_halalas` unless a `ride_destination_changes` row raised the cap.
- Every `ride_journal_entries` row's lines sum to zero per currency; ledger, event, charge, rating and admin action rows are never updated or deleted (a trigger raises).
- The same money source posts at most once (`unique (source_type, source_id, kind)` on entries, `unique (payment_id, kind, provider_event_id)` on payment events).
- Fare rules are never edited; a ride always points to the rule that priced it.
- A test profile is never matched with a real one, and test rides skip payment capture, payouts and ZATCA reporting.
- No app role can read precise points, start codes, encrypted values or file keys.
- Every amount is an integer of halalas with a currency on its row.

### Security model

Compliance scope: the Saudi Personal Data Protection Law (location, national ID, IBAN, selfies), ZATCA electronic invoicing (feature 21), and Transport General Authority record keeping. Audit logs are mandatory: ride events, account status changes, incident and case events, journal entries and admin actions are append only.

- **Writes.** Only the backend's service role, through the functions above and plain inserts for single table writes. `anon` has no access; `authenticated` has `select` only, per the read surface table.
- **Reads.** Own rows only. A captain sees a ride, its events, charges and chat only while they are its current captain; rides they gave back appear in their history through REST with a limited view. The other party's name, photo, rating, car and plate reach the app only from REST while the ride is open.
- **Sensitive data.** National ID, date of birth and IBAN are encrypted by the backend; the keys exist only in backend env. Documents, selfies, statements and invoice XML sit in a private bucket, served by short lived signed URLs from the backend.
- **Deletion.** Profile deletes are restricted. `ride_anonymize_user` (feature 21) clears addresses, points, polylines, messages and encrypted values for the user's rides and profiles and sets `anonymized_at`, keeping amounts, charges, invoices and ledger rows that tax law requires.
- **Retention.** `ride_purge_expired` runs daily as a BullMQ repeat job and deletes trail points, messages and shift selfies older than the country's retention days, idempotency keys older than 24 h, and documents of captains whose `left_at` is older than `document_retention_days`. It skips anything tied to a ride under legal hold or with an open case or incident.

### Configuration required

- `RIDE_START_CODE_HMAC_KEY`: 32 byte key (base64) for the start code HMAC; backend only, validated by zod in the rides module env. Feature 3 (needed before the first ride in feature 6). Separate from the PII keys so it can rotate freely: start codes live only for one ride, so rotating it only means open rides in `accepted` or `arrived` need a new code (the backend reissues one), with no rehash job.
- `RIDE_START_CODE_ENC_KEY`: 32 byte key (base64) for AES 256 GCM on `start_code_enc`; backend only. Feature 3. Same rotation note.
- `RIDE_PII_ENCRYPTION_KEY`: 32 byte key (base64) for AES 256 GCM on `*_enc` columns; backend only. Feature 7.
- `RIDE_PII_HASH_KEY`: HMAC key for `*_hash` columns; backend only; never rotated without a rehash job. Feature 7.
- `RIDE_PII_KEY_VERSION`: the current key version written to `pii_key_version`. Feature 7.
- A private storage bucket for ride documents (provider chosen in feature 7).

### Critical test scenarios

- Happy path: a seeded rider and test captain run one ride through `ride_create_ride`, `ride_transition`, `ride_assign_captain` and `ride_complete` to `completed`; the ride has version 6, six events, one released assignment and charges summing to the final fare, verifies **AC-7**.
- Failure case: two sessions call `ride_assign_captain` on the same ride at the same moment; one wins and one gets null, verifies **AC-5**.
- Failure case: a second `ride_create_ride` for a rider with an open ride raises `ride_open_ride_exists`, verifies **AC-6**.
- Auth and permission: the probe signs in as rider A, rider B, captain C (assigned), captain D (never assigned) and captain E (gave the ride back) and checks every row count and every hidden column, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**.
- Failure case: `delete from profiles` for a rider with rides fails, verifies **AC-8**.
- Failure case: a second captain with the same national ID hash is rejected, verifies **AC-9**.
- Failure case: a test captain cannot be assigned a real rider's ride, verifies **AC-12**.
- Failure case: captain D calls `ride_transition` on captain C's ride, a male captain is offered a `woman_captain_only` ride, verifies **AC-13**.
- Failure case: `ride_complete` with lines above the fare cap leaves the ride `in_progress` and writes no charges, verifies **AC-14**.
- Failure case: four wrong start code hashes each return `wrong_code` and leave `start_code_attempts` at 1, 2, 3, 4 after each call commits; the fifth wrong hash returns `locked` (count 5); the correct hash after that still returns `locked`; a stale version call counts nothing; on a fresh ride the correct hash returns `started`, verifies **AC-15**.
- Edge case: the first and second give backs return the ride to `searching` with a fresh `search_expires_at` and `give_back_count` 1, then 2; the third ends it as `cancelled_by_captain` and that captain still sees it; `no_captain_found` before `search_expires_at` is refused and after it is accepted; an assignment after `search_expires_at` returns null, verifies **AC-16**.
- Edge case: a rider cancels 1 minute after acceptance with fee lines (ignored, nothing charged), 3 minutes after (no lines or a wrong total refused with `ride_fee_mismatch`, a captain share above the line total refused, right lines written); a no show at 4 minutes is refused and at 5 minutes is accepted with its fee; after a start code lock a no show is refused and a rider cancel at 3 minutes charges nothing, verifies **AC-17**.

## Build plan

Tracer Bullet: this feature builds only the core tables the walking skeleton (feature 6) needs, so one real ride can travel app, backend, database and admin. Every other table is created by the feature named in its **F** column, as its own additive migration with its own probe, checked against this spec (AC-11).

1. Write migration `<timestamp>_ride_core.sql` with the helper trigger `ride_touch_updated_at`, the sequence `ride_number_seq`, and the settings tables (`ride_countries`, `ride_cities`, `ride_ride_types`, `ride_fare_rules`, `ride_runtime_config`) with RLS, grants and seed rows (`SA`, Riyadh, economy, both kill switch keys off), satisfies **AC-3**, **AC-10**
2. Add the people tables (`ride_rider_profiles`, `ride_captain_profiles`, `ride_account_status_changes`, `ride_vehicles`, `ride_vehicle_ride_types`, `ride_captain_shifts`) with their partial unique indexes, `on delete restrict` FKs and column grants, satisfies **AC-2**, **AC-4**, **AC-8**, **AC-9**
3. Add the ride tables (`ride_quotes`, `ride_quote_options`, `ride_rides`, `ride_ride_events`, `ride_assignments`, `ride_offers`, `ride_charges`, `ride_idempotency_keys`) with partial unique indexes and column grants, satisfies **AC-1**, **AC-4**, **AC-6**
4. Add the read helper `ride_user_can_read_ride` and every select policy from the read surface table for the tables in steps 1 to 3, satisfies **AC-1**, **AC-2**
5. Add the append only guard trigger (raise on update or delete) to `ride_ride_events`, `ride_account_status_changes`, `ride_charges` and `ride_fare_rules`, satisfies **AC-7**
6. Add the functions `ride_create_ride`, `ride_transition` (edge list from the state machine table, search window, fee timing and fee line checks), `ride_start_ride` (hash compare, attempt count, lock), `ride_assign_captain` (eligibility, kill switch and actor checks, start code hash, attempt reset), `ride_complete`, `ride_set_account_status`, and `ride_purge_expired` for idempotency keys, with pinned `search_path` and service role only execute, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-12**, **AC-13**, **AC-14**, **AC-15**, **AC-16**, **AC-17**
7. Write `supabase/probes/<timestamp>_ride_core_probe.sql` (never commits) covering rider A, rider B, captain C, captain D, captain E (gave a ride back), anon, concurrent assignment (two sessions), stale version, invalid edge, wrong actor, ineligible vehicle, woman only ride, start code count and lockout, search window give back, cancel and no show fee timing and totals, fare cap refusal, reused quote, profile delete and duplicate national ID hash (the probe inserts its own fare rule with the launch timings, and backdates `accepted_at`, `arrived_at`, `requested_at` and `search_expires_at` because `now()` is fixed inside one transaction); and `supabase/rollbacks/<timestamp>_ride_core_rollback.sql`, satisfies **AC-1** to **AC-9**, **AC-12** to **AC-17**
8. Apply to the shared staging branch through the Supabase MCP, run the probe and the Supabase security advisor, regenerate Supabase types into Nouzl_Backend, satisfies **AC-10**
9. Add the status unions (ride, offer, assignment release, captain and rider standing) and the transition edge list to `nouzl_rules` as typed constants (the `arrived` to `in_progress` edge applied by `ride_start_ride`), plus a test that the SQL edge list in `ride_transition` matches them, satisfies **AC-7**
10. Add a CI check in Nouzl_Backend that fails when a migration file named `*_ride_*` (other than `ride_core`) contains `drop table`, `drop column`, `rename`, or `alter column ... type` on a `ride_` object, satisfies **AC-11**
11. Add `RIDE_START_CODE_HMAC_KEY` and `RIDE_START_CODE_ENC_KEY` to the rides module env schema (zod, fails loudly when missing while `RIDES_ENABLED` is on), satisfies **AC-15**

## Consequences

**Positive**:
- Every later slice already knows its tables, keys and policies, so no slice needs a breaking migration and features can be designed in any order.
- Assignment races, double rides, duplicate callbacks and double postings are stopped by the database itself, not only by code.
- One double entry ledger makes cash offset, earnings and payouts plain balance queries, and "the books always balance" is a database check.
- Riders and captains are isolated by RLS on every table, and sensitive values are unreadable even to a wrongly granted query.
- Settings per country make GCC expansion a matter of data rows.

**Negative / tradeoffs**:
- About 40 tables is a lot of schema for a one person team; each later feature must still write its migration, policies and probe.
- Business checks now live in two places, TypeScript (`nouzl_rules`) and the SQL guards in the functions; the edge list test (build step 9) keeps them in step, and drift is a real risk.
- `security definer` functions run with full rights, so a bug in one bypasses RLS; each needs the pinned search path, service role only execute, and a probe.
- Encrypting national ID and IBAN in the backend means no SQL search on them, a key that must never be lost, and a rehash job if the hash key ever changes.
- Cached rating averages are a stored derived value; `ride_record_rating` is the only writer, and an admin rating removal must recompute them.
- The rides schema shares one database with stays; a bad ride migration can still lock or slow shared tables, so every ride migration runs on the staging branch first.
- Fee lines are built in TypeScript and checked in SQL, so a fee rule change in `nouzl_rules` that changes the total without a matching fare rule change is refused at cancel time (`ride_fee_mismatch`); the probe and feature 5's fixtures must cover it.
- Two more backend secrets to create, store and back up before the first ride; losing the start code keys only breaks open rides (new codes are issued), but they must exist in every environment where rides are on.
- A ride that hits the start code lock cannot start; until feature 11 opens an incident, the rider or captain must cancel and rebook (or an admin cancels it).

**Neutral**:
- `device_tokens.app` gains a `ride` value in feature 8, the only change to a non ride table.
- Supabase types must be regenerated after every ride migration (spec 0001).
- The trail table stays unpartitioned; partition by month if volume grows about tenfold.

## Follow-up

- [ ] Feature 7: choose the private storage provider and bucket for documents, selfies, statements and invoice XML (the current R2 bucket serves objects publicly, see the `user_id_documents` migration note).
- [ ] Feature 7: generate and store `RIDE_PII_ENCRYPTION_KEY`, `RIDE_PII_HASH_KEY` and `RIDE_PII_KEY_VERSION` in the backend env for staging and production, with a recorded backup.
- [ ] Feature 21: confirm the legal retention periods (trail, chat, selfies, documents, invoices) with counsel and update the `ride_countries` defaults; agree with the Nouzl account deletion flow that profiles of users with rides are anonymized, never hard deleted.
- [ ] Feature 5: confirm with the accountant whether VAT applies to the whole fare or only the commission (PRD section 9); the charge lines and ledger support both. Feature 5 also owns the fee rule in `nouzl_rules` that splits a VAT inclusive fee into net, VAT and captain share, and sets the launch values (`cancel_after_minutes` 2, cancel fee 8 SAR, `free_wait_minutes` 3, `no_show_after_minutes` 5, `no_show_fee_halalas`).
- [ ] Feature 6: generate and store `RIDE_START_CODE_HMAC_KEY` and `RIDE_START_CODE_ENC_KEY` in the backend env for staging and production, with a recorded backup.
- [ ] Feature 11: extend `ride_start_ride` so a `locked` outcome opens a `normal` safety incident, and decide whether an admin may unlock the start code.
- [ ] Feature 8: confirm the 120 second `search_window_seconds` and `max_give_backs` 2 against real offer acceptance once matching runs (the PRD target is acceptance in under a minute), and keep every offer's `expires_at` at or before the ride's `search_expires_at`.
- [ ] Each feature spec that creates a table here should link this spec and extend the core probe for its tables (AC-11).

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
