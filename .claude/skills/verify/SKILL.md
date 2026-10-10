---
name: verify
description: How to run and drive Nouzl Ride for verification. The Expo app on the Android emulator (Expo Go) or web, and the Nouzl_Backend rides module over HTTP without touching production.
---

# Verify Nouzl Ride

## App on Android (preferred; native layout differs from web)

1. Emulator: `"$LOCALAPPDATA/Android/Sdk/emulator/emulator.exe" -avd Medium_Phone_API_36.1 -no-snapshot-save -no-boot-anim` (background). Expo Go 57 is installed. Ready when `adb shell getprop sys.boot_completed` prints 1.
2. Metro for Expo Go (the app has expo-dev-client, so pass `--go`), from `apps/ride`, in the background: `CI=1 npx expo start --go --port 8084`. Wait for `Waiting on http://localhost:8084`.
3. `adb reverse tcp:8084 tcp:8084`, then `adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8084" host.exp.exponent` (use 127.0.0.1, not 10.0.2.2). First bundle takes about 20 s.
4. Read the screen: `export MSYS_NO_PATHCONV=1` FIRST (Git Bash rewrites `/sdcard/...` into a Windows path and `uiautomator` reads silently fail), then `adb shell uiautomator dump /sdcard/ui.xml; adb shell cat /sdcard/ui.xml | grep -oE 'text="[^"]+"'`. Screenshot: `adb exec-out screencap -p > shot.png`.
5. Taps on the 1080x2400 screen: mode chips captain (806,152), rider (965,152); bottom tabs left (268,2310), right (806,2310). Cold start: `adb shell am force-stop host.exp.exponent`, then open the URL again.

## App on web

`preview_start` with `nouzl-ride-web` (`.claude/launch.json`, port 8084). Use `get_page_text` / `find`; screenshots often time out when the pane is hidden.

## Backend rides module (never boot the full backend: its .env is production with crons on)

- Harness: a CommonJS script that `process.chdir('C:/projects/Nouzl_Backend')`, registers `ts-node` (`transpileOnly`), and boots `ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })` + `src/cache/cache.module` (exports `AppModule`, the real ioredis client) + `src/rides/rides.module` (+ `src/delivery/delivery.module`), global prefix `api`, listen on 127.0.0.1:3999.
- Redis stand in: no local Redis or Docker. A 10 line `net` server answering `+PONG` to PING and a bulk `loading:0` to INFO satisfies ioredis.
- Cases: flag off → 404; flag on + no REDIS_URL → boot refuses (`unconfigured`); flag on + dead port → refuses (`down`); flag on + stand in → `GET /api/rides/v1/health` 200 `no-store`; kill the stand in → 503 `degraded` within about 2 s.

## Gotchas

- Do NOT wrap node in `env -u VAR ...` in this Git Bash: the process exits 0 with no output. Unset in a subshell: `(unset REDIS_URL; export RIDES_ENABLED=true; node harness.js)`.
- Foreground `sleep` is blocked; wait with a background `until ...; do sleep 1; done` loop.
- Stop processes by PID from `netstat -ano | grep ":<port> .*LISTENING"`, never a blanket `taskkill //IM node.exe`.
