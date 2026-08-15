# Gravity Deck Prototype Runbook

## Desktop

```bash
npm run desktop:dev
```

For a packaged Windows build:

```bash
npm run build:win
```

The installer is generated at:

```text
release/desktop/Gravity-Deck-Setup-<version>.exe
```

## Android

```bash
npm run build:apk
```

The debug APK is generated at:

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## Prototype Flow

1. Open Gravity Deck on the PC.
2. Open Gravity Mobile on Android.
3. Create a QR in Gravity Deck and scan it in Gravity Deck Mobile.
4. In Gravity Mobile, use the Jogos tab to sync and select a game.
5. The app enters fullscreen game mode and negotiates Gravity Stream.
6. Use Bluetooth controller input when Android exposes Gamepad API, or use touch buttons as fallback.

The QR token expires quickly. If the mobile app shows a secure-session warning, generate a new QR instead of typing the host URL manually.

## Input Notes

Windows input is active by default for mapped buttons:

- A: Space
- B: Escape
- X: Enter
- Y: Tab

Use this environment variable to simulate input without sending native keys:

```bash
MOB_DECK_V2_INPUT_DRY_RUN=1
```

## Stream Notes

Gravity Stream tries desktop video plus audio first. If desktop audio is not available in Electron/Windows, it falls back to video-only automatically.

## Security Notes

- Use the QR flow for mobile sessions; manual URLs only prove that the host is reachable.
- Sensitive host routes require bearer auth.
- Do not paste or log QR payloads in public channels because they include a session token.
