# Gravity Deck Architecture

## Current Repository Shape

`mob-deck-v2` e a base oficial do Gravity Deck. A raiz do repositorio preserva MOB Deck como legado, referencia de scanner e fonte temporaria de compatibilidade.

Diretorios atuais:

- `src/components`: reusable UI primitives for the shell.
- `src/features`: product areas such as dashboard, library, streaming and pairing.
- `src/domain`: shared product types and temporary mock data.
- `src/contracts`: API contracts for desktop host, mobile companion and streaming session.
- `apps/desktop`: Gravity Deck Host em Electron, carregando o dashboard Vite e expondo IPC seguro para a UI.
- `src/hooks/useStreamOfferBridge.ts`: renderer-side WebRTC offer bridge that captures the selected desktop source and responds to Gravity Sync offer requests.
- `apps/desktop/services/captureService.cjs`: lists screen/window capture sources through Electron before WebRTC offer creation.
- `apps/desktop/services/libraryService.cjs`: biblioteca desktop com cache persistido, seed fallback e adapter do scanner legado.
- `apps/desktop/services/launchService.cjs`: launch adapter for Steam/Epic/GOG/protocol URIs and executable targets.
- `apps/desktop/services/pairingService.cjs`: cria payloads Gravity Sync de vida curta e promove o token para sessao mobile autenticada.
- `apps/desktop/services/inputInjectionService.cjs`: guarded Windows input adapter that maps prototype face buttons to keyboard taps.
- `apps/desktop/services/streamingService.cjs`: first Gravity Stream session coordinator with preset, join code, LAN address, telemetry and remote input counters.
- `apps/desktop/services/signalingServer.cjs`: bridge HTTP local autenticado para Gravity Deck Mobile ler sessao, enviar answer, refresh de biblioteca, launch, telemetria e input fallback.
- `apps/mobile`: shell Vite do Gravity Deck Mobile que conecta ao Gravity Deck Host.
- `apps/mobile/android`: shell Capacitor Android para APKs do Gravity Deck Mobile.
- `@capacitor/barcode-scanner`: scanner nativo de camera usado pelo Gravity Deck Mobile para QR Gravity Sync.
- `capacitor-secure-storage-plugin`: storage seguro Android para token de sessao mobile.
- `src/hooks`: browser-safe adapters for desktop host status and desktop actions.
- `shared/library.seed.json`: seed compartilhado para bootstrap da biblioteca quando nao ha cache real.
- `docs`: product, design and architecture notes.

## Next Structural Step

After the shell stabilizes, split into workspaces:

- `apps/desktop`: Electron launcher and streaming host.
- `apps/mobile`: Capacitor Android companion and streaming client.
- `packages/ui`: shared React UI components and tokens.
- `packages/core`: scanners, catalog, pairing, Wake-on-LAN and diagnostics.
- `packages/streaming`: WebRTC signaling, capture contracts and input events.

## Gravity Stream MVP Contract

The first streaming MVP should prove this sequence:

1. Dashboard asks the desktop host for the current library.
2. User can ask the host to refresh the library through the legacy scanner adapter.
3. Desktop generates a Gravity Sync QR/code pairing payload with signaling URL and token.
4. Gravity Mobile stores the token through secure native storage on Android and reaches the desktop signaling server over LAN with `Authorization: Bearer <token>`.
5. Dashboard sends a launch request to the desktop host.
6. Desktop opens the selected game or prepares a mobile-stream session.
7. Desktop creates a Gravity Stream session with preset, join code, signaling URL and telemetry.
8. Desktop lists available screen/window capture sources and selects a default screen.
9. Gravity Mobile asks desktop for a stream offer.
10. Desktop renderer captures the selected display/window and creates a WebRTC offer.
11. Gravity Mobile creates an answer and renders the remote video track.
12. Gravity Mobile sends gamepad events through the `gravity-input` data channel, with HTTP fallback before WebRTC is ready.
13. Desktop receives input events, acknowledges them to mobile and routes face buttons through a guarded native Windows keyboard fallback.

Audio, encoder presets, analog sticks, virtual gamepad drivers and reconnect behavior come after video and first input are stable.

## LAN Security Contract

- `GET /health` stays public for basic discovery.
- Every operational route requires bearer auth: `/session`, `/telemetry`, `/capture-sources`, `/games`, `/games/status`, `/games/refresh`, `/launch`, `/offer`, `/answer`, `/input` and `/stop`.
- QR pairing tokens expire quickly. A valid first authenticated call promotes the token into a mobile session with a renewable TTL.
- Query-string tokens are intentionally unsupported.
- Compatibility headers `X-Gravity-Deck-Token` and `X-MobDeck-Token` are accepted only as header fallback, not through URL parameters.
- CORS is limited to local/Capacitor origins and optional `MOB_DECK_V2_ALLOWED_ORIGINS`.

## Library Bootstrap Contract

- `libraryService` is configured with Electron `app.getPath('userData')`.
- `listGames()` loads persisted cache first.
- If no cache exists, it loads `shared/library.seed.json`.
- `refreshLibrary()` updates progress status per scanned root and persists detected games.
- If refresh finds no games or the scanner fails, the current cache/seed remains visible.
