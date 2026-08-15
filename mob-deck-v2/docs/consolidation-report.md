# Relatorio De Consolidacao - Gravity Deck

Data: 2026-07-14

## Decisao

`mob-deck-v2` passa a ser a base oficial do produto Gravity Deck. A raiz do repositorio permanece como legado MOB Deck para referencia, compatibilidade e recuperacao historica.

Naming oficial:

- Empresa: Mob Studios
- Produto: Gravity Deck
- Host desktop: Gravity Deck Host
- Mobile: Gravity Deck Mobile

## Mudancas Implementadas

- Servidor LAN da V2 passou a exigir sessao autenticada em rotas sensiveis.
- QR gera token curto de pareamento e promove para sessao mobile com TTL renovavel.
- Mobile envia `Authorization: Bearer <token>` nas chamadas ao host.
- Token mobile nao e salvo em `localStorage`; Android usa `capacitor-secure-storage-plugin`.
- CORS do host foi restringido a origens locais/Capacitor.
- Biblioteca V2 agora carrega cache persistido, depois seed, e so entao refresh real.
- Refresh da biblioteca preserva cache/seed quando scanner falha ou nao encontra jogos.
- Testes host cobrem auth LAN e bootstrap de biblioteca.
- README raiz oficializa Gravity Deck e marca MOB Deck como legado.
- CLINE foi corrigido para UTF-8 e atualizado com baseline oficial.
- Artefatos historicos foram documentados em `docs/archive-artifacts.md`.

## Validacoes Executadas

```bash
npm run test:host
npm run lint
npm run build
npm run mobile:build
npm run mobile:sync
npm run mobile:apk
npm audit --omit=dev
npm --prefix .. audit --omit=dev
npm --prefix .. run test:scanner
node --check apps/desktop/main.cjs
node --check apps/desktop/services/signalingServer.cjs
node --check apps/desktop/services/pairingService.cjs
node --check apps/desktop/services/libraryService.cjs
```

Resultados:

- Host tests: 5 passaram.
- Lint: passou.
- Desktop production build: passou.
- Mobile production build: passou.
- Android sync: passou e detectou `capacitor-secure-storage-plugin`.
- APK debug: gerado com sucesso.
- npm audit V2: 0 vulnerabilidades.
- npm audit legado: 0 vulnerabilidades.
- scanner legado: passou.

Artefato confirmado:

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## Riscos Restantes

- QA real PC/celular ainda precisa validar pairing, launch, WebRTC, audio, input, stop e reconnect numa rede local real.
- APK release assinado ainda nao foi gerado.
- Instalador Windows atual nao foi regenerado nesta etapa.
- O scanner legado ainda vive fora de um pacote proprio.
- Builds antigos rastreados no Git continuam preservados; remocao exige inventario/confirmacao.
- WebRTC ainda precisa de tratamento de ICE/reconnect mais robusto para redes reais.

## Proximos Passos Recomendados

1. Rodar QA com celular real usando o APK debug gerado.
2. Gerar novo `build:win` da V2 e validar instalacao limpa.
3. Inventariar artefatos antigos com hashes antes de remover ou mover.
4. Migrar `src/scanner` para pacote compartilhado da V2.
5. Adicionar testes automatizados para refresh com fixture de scanner e fluxo offer/answer mockado.
6. Planejar driver de controle virtual em vez de fallback de teclado.
