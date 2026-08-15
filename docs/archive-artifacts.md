# Artefatos Legados E Builds Historicos

Este repositorio preserva builds antigos porque eles podem ser uteis para comparacao visual, recuperacao de arquivos e entrega a terceiros. Eles nao sao a base ativa do produto.

## Regra

- Nao apagar instaladores, APKs ou `app.asar` historicos sem confirmacao explicita.
- Novas releases oficiais devem sair de `mob-deck-v2`.
- Pastas geradas por build devem permanecer ignoradas quando nao forem artefatos historicos rastreados.

## Base Ativa

- `mob-deck-v2/release/desktop`: instaladores do Gravity Deck.
- `mob-deck-v2/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`: APK debug do Gravity Deck Mobile.

## Legado Preservado

- `dist/`: build antigo rastreado do MOB Deck. Mantido por historico; contem `MOB Deck.exe` e `resources/app.asar`.
- `release-drive/`: pacote antigo entregue/compartilhavel com EXE/APK da linha MOB Deck.
- `release-redesign/`, `dist-new/`, `extracted-dist-new/`: fontes historicas de recuperacao visual e ASAR.
- `build-fin/`, `build-final/`, `0.1.1.1/`: artefatos nao rastreados encontrados na consolidacao; manter fora do commit ate decisao de limpeza.
- `mobile-app/`: companion Android legado.

## Proxima Limpeza Segura

1. Gerar um inventario com tamanho, data e hash dos instaladores importantes.
2. Copiar instaladores finais para uma pasta `archive/releases/` ou storage externo.
3. Remover do Git os builds rastreados gerados, mantendo tags/commits historicos.
4. Confirmar que `mob-deck-v2` gera os artefatos atuais antes de apagar qualquer pasta antiga.
