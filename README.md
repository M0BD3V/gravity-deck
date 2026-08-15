# Gravity Deck

Gravity Deck e o produto oficial da Mob Studios para biblioteca de jogos, host desktop, streaming local e companion mobile.

Este repositorio ainda preserva o legado MOB Deck na raiz para referencia e compatibilidade temporaria, mas a base ativa do produto e `mob-deck-v2`.

## Produto Oficial

- Empresa: Mob Studios
- Produto principal: Gravity Deck
- Host desktop: Gravity Deck Host
- App mobile: Gravity Deck Mobile
- Base ativa: `mob-deck-v2`
- Legado: arquivos Electron/JS da raiz, `mobile-app` e builds antigos

## Estrutura

```text
.
|-- mob-deck-v2/              # Gravity Deck oficial: React, Vite, TypeScript, Electron e Capacitor
|-- src/, main.js, preload.js # Legado MOB Deck mantido como referencia do scanner/companion
|-- mobile-app/               # Companion mobile legado
|-- release*/ dist*/ build*/  # Artefatos historicos; ver docs/archive-artifacts.md
```

## Comandos Principais

Entre na V2 antes de rodar os comandos novos:

```bash
cd mob-deck-v2
npm install
npm run desktop:dev
npm run mobile:dev
npm run check
npm run mobile:apk
npm run build:win
```

Comandos do legado continuam na raiz apenas para manutencao:

```bash
npm run test:scanner
npm start
```

## Status

A V2 ja tem:

- dashboard desktop;
- biblioteca com seed/cache e scanner legado por adaptador;
- pareamento QR;
- servidor LAN autenticado;
- cliente Gravity Deck Mobile;
- WebRTC signaling;
- input remoto com fallback HTTP;
- build Windows e APK debug.

## Decisoes

- O legado nao deve receber funcionalidades novas, salvo correcao de compatibilidade.
- O scanner legado pode ser reaproveitado por adaptador ate virar pacote proprio.
- Artefatos antigos nao devem ser apagados sem confirmacao; primeiro documentar, depois arquivar/remover em lote controlado.
- Tokens de sessao mobile nao devem ser passados por query string nem salvos em `localStorage`.

## Documentacao

- `mob-deck-v2/README.md`: comandos e estado da V2.
- `mob-deck-v2/docs/architecture.md`: arquitetura tecnica.
- `mob-deck-v2/docs/testing.md`: verificacoes e gaps.
- `mob-deck-v2/docs/consolidation-report.md`: relatorio desta consolidacao.
- `docs/archive-artifacts.md`: mapa dos builds e releases historicos.
