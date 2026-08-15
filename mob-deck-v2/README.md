# Gravity Deck

Gravity Deck e a base oficial do produto da Mob Studios para desktop, biblioteca de jogos, streaming local e companion Android.

A linha antiga MOB Deck continua preservada na raiz do repositorio como referencia de compatibilidade. Codigo novo deve nascer aqui.

## Componentes

- `apps/desktop`: Gravity Deck Host em Electron.
- `src`: UI desktop React/Vite/TypeScript.
- `apps/mobile`: Gravity Deck Mobile em React/Vite.
- `apps/mobile/android`: shell Android Capacitor.
- `shared/library.seed.json`: seed inicial da biblioteca.
- `apps/desktop/services`: host local, scanner adapter, pareamento, launch, captura, streaming e input.
- `docs`: arquitetura, testes, runbook e relatorios.

## Requisitos

- Node.js com npm.
- Windows para host desktop completo, launch real e input nativo.
- Android SDK/Gradle local para APK debug.
- Celular e PC na mesma rede para QA real do Gravity Deck Mobile.

## Comandos

```bash
npm install
npm run desktop:dev
npm run mobile:dev
npm run test:host
npm run check
npm run mobile:sync
npm run mobile:apk
npm run build:win
npm run build:release
```

## Seguranca LAN

O Gravity Deck Host abre um servidor HTTP local para o mobile. A partir desta consolidacao:

- `/health` e publico para descoberta basica.
- Rotas sensiveis exigem `Authorization: Bearer <token>`.
- O QR gera um token de pareamento curto.
- A primeira chamada autenticada promove o token para sessao mobile com TTL renovavel.
- Query string nao e usada para segredo.
- CORS fica restrito a origens locais/Capacitor necessarias.
- O token do Android e salvo com storage seguro nativo; em preview web, o fallback nao persiste segredo em `localStorage`.

Rotas protegidas incluem biblioteca, refresh, launch, offer/answer, telemetria, input e stop.

## Biblioteca

O desktop carrega a biblioteca nesta ordem:

1. cache persistido em `app.getPath('userData')`;
2. `shared/library.seed.json`;
3. refresh real pelo scanner legado via adaptador.

Se o scanner nao encontrar jogos ou falhar, a UI preserva a biblioteca cache/seed para nao iniciar vazia sem necessidade.

## Builds

Desktop:

```bash
npm run build:win
```

Saida:

```text
release/desktop/Gravity-Deck-Setup-<versao>.exe
```

Android debug:

```bash
npm run mobile:apk
```

Saida:

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## Status Atual

- Dashboard desktop funcional.
- Biblioteca com seed/cache e adapter para scanner legado.
- QR pairing com token e TTL.
- Servidor LAN autenticado.
- Mobile com storage seguro no Android.
- WebRTC signaling e input remoto inicial.
- Testes host com Node test runner.
- APK debug gerado localmente.

## Proximos Passos

1. QA real PC/celular: pairing, launch, WebRTC, input, stop e reconnect.
2. Migrar scanner legado para pacote `packages/core`.
3. Separar workspaces quando a V2 estabilizar.
4. Implementar driver de controle virtual em vez de fallback de teclado.
5. Assinar APK release e validar instalador Windows atual.
