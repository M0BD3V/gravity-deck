# Testing Notes

## Automated Checks

Run:

```bash
npm run test:host
npm run check
npm run mobile:sync
npm run mobile:apk
```

`npm run check` runs Oxlint, host tests and the production TypeScript/Vite builds. `npm run mobile:apk` builds the Gravity Deck Mobile debug APK at `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

## Visual Smoke Checks

Validated manually in the local browser at:

```text
http://127.0.0.1:5173
```

Checked:

- Desktop viewport loads the dashboard without console warnings or errors.
- Gravity Mobile viewport around 390px wide has no horizontal overflow.
- Main actions stay visible: re-scan, pair phone, play on PC, play on phone.
- Library, devices and streaming pipeline render from shared mock data.
- Desktop host exposes `listGames` through IPC and validates launch requests against the seed library.
- Desktop host exposes `refreshLibrary`; scanner fallback was smoke-tested with an empty root.
- Desktop host loads persisted cache first, then `shared/library.seed.json`, so the UI does not start empty without need.
- Desktop host exposes capture-source discovery through IPC and Gravity Sync HTTP.
- Gravity Sync exposes `/offer`; the desktop renderer owns WebRTC offer creation.
- Gravity Sync rejects sensitive HTTP routes without `Authorization: Bearer <token>`.
- Gravity Sync promotes a valid QR token into a renewable mobile session and rejects expired/invalid tokens.
- Gravity Stream marks the session as `streaming` from WebRTC state and records input events.
- Gravity Mobile uses the `gravity-input` data channel for control messages when open, with `/input` HTTP fallback.
- Gravity Deck Mobile stores the session token in native secure storage on Android; browser preview uses session-only fallback.
- Native input adapter dry-run maps A/B/X/Y to Space/Escape/Enter/Tab; real Windows SendKeys mode requires `MOB_DECK_V2_INPUT_NATIVE=1`.
- Capacitor Android debug APK builds successfully for Gravity Mobile.
- Gravity Mobile QR button opens the native camera scanner, connects immediately and saves the host for next launch.
- Gravity Mobile normalizes LAN hosts to `http://IP:47321` because the local signaling server is HTTP.
- Gravity Sync sends restricted CORS and Private Network Access headers for Android WebView LAN requests.
- `Jogar no PC` shows a browser fallback message when Electron APIs are unavailable.
- `Reescanear biblioteca` shows a browser fallback message when Electron APIs are unavailable.
- Electron smoke test opens the production build and exits with `MOB_DECK_V2_SMOKE=1`.
- Launch service supports `MOB_DECK_V2_LAUNCH_DRY_RUN=1` so tests can validate targets without opening games.
- Input injection supports dry-run by default so automated checks do not send real keypresses.

## Current Known Gaps

- Buttons are connected to the desktop bridge and the desktop host can open URI/executable targets.
- Real scanner refresh is available on the desktop host, but broad drive scans can take time.
- Gravity Stream offer/answer and input data channel are wired, but reconnect QA, audio, analog sticks and production ICE handling are still pending.
- Capture-source discovery is wired, but full stream QA still needs a real desktop-to-phone pass.
- Gravity Mobile and Electron host are not split into workspaces yet.
- Signed Android release APK is still pending; current validation uses debug APK.
