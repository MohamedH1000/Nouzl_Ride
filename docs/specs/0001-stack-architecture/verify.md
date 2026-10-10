# Verify: Stack & architecture · spec 0001 · updated 2026-10-10
_Steps derived from the scope Done when line for feature 1 (a decision spec has no acceptance criteria). `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Build a development client (`npx eas-cli@latest build --profile development`, or `npx expo run:android` locally) and open it on a real Android phone → the app opens in rider mode on "إلى أين؟" with the tabs رحلة and رحلاتي → Done when: runs on Android (passed, confirmed 2026-10-11)
- [x] Same on a real iPhone → same screen, right to left layout, Cairo font → Done when: runs on iOS (passed, confirmed 2026-10-11)
- [x] Tap the كابتن chip → captain mode opens on "ابدأ الاستقبال" with the tabs قيادة and أرباحي → Done when: mode switch (passed, confirmed 2026-10-11)
- [x] Close the app fully and open it again → it reopens in captain mode; tap راكب → back to rider mode → Done when: mode switch (passed, confirmed 2026-10-11)
- [x] Switch the phone language to English and reopen → strings show in English, left to right → Done when: runs in both languages (passed, confirmed 2026-10-11)

## Commands
- [x] `npm run typecheck` (in `nouzl_ride`) → passes (2026-10-10)
- [x] `npm run check:synced` → OK, 68 files from nouzl_mobile@2af85ea (2026-10-10)
- [x] `npx expo-doctor` (in `apps/ride`) → 21/21 checks pass (2026-10-10)
- [x] `npx expo export --platform android --platform ios` (in `apps/ride`) → both bundles build (2026-10-10)
- [x] `npx tsc --noEmit` (in `Nouzl_Backend`) → passes (2026-10-10)
- [x] `npx jest src/rides` (in `Nouzl_Backend`) → 3 pass: 404 while `RIDES_ENABLED` is off, 200 `{status: ok, service: nouzl-ride}` with `no-store` when on with Redis, refuses to boot when on without Redis (2026-10-10) → Done when: health route
- [ ] _skipped 2026-10-11: no staging backend or Redis exists yet; run once Delivery or Ride provisions them_ On the staging backend with `RIDES_ENABLED=true` and the staging Redis, `curl <staging api>/api/rides/v1/health` → 200 with `"redis":"ok"`; with the flag off → 404 → Done when: health route (live)

## Done when coverage
- Spec recorded: spec 0001 accepted 2026-10-10
- Runs on Android and iOS: phone steps above (passed 2026-10-11)
- Rider/captain mode switch: web checked 2026-10-10; phone steps passed 2026-10-11
- Backend health route: unit tests pass; live staging check open (needs the shared staging backend and Redis)
