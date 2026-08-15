# Gravity Deck

## Baseline Oficial

Gravity Deck e o produto ativo da Mob Studios. A implementacao oficial fica em `mob-deck-v2`.

A raiz do repositorio ainda contem o legado MOB Deck para referencia, scanner, comparacao de comportamento e compatibilidade temporaria. Nao remover o legado inteiro sem uma migracao validada.

## Regras De Trabalho

- Nunca quebrar funcionalidades existentes sem plano de rollback.
- Nunca remover codigo ou artefatos uteis sem justificar e preservar historico.
- Preferir refatoracao incremental em vez de reescrita ampla.
- Validar comportamento real com testes, lint, build ou smoke test apropriado.
- Evitar duplicacao de codigo novo.
- Manter comentarios somente quando agregarem contexto.
- Preservar o design existente salvo pedido explicito de mudanca visual.

## Naming

- Empresa: Mob Studios
- Produto principal: Gravity Deck
- Host desktop: Gravity Deck Host
- App mobile: Gravity Deck Mobile
- Legado/historico: MOB Deck, Mob Launcher

## Arquitetura Atual

- `mob-deck-v2/apps/desktop`: Electron host oficial.
- `mob-deck-v2/apps/mobile`: Gravity Deck Mobile em Capacitor.
- `mob-deck-v2/src`: UI React/TypeScript do desktop.
- `mob-deck-v2/shared`: dados compartilhados, incluindo seed de biblioteca.
- `src/scanner`: scanner legado reaproveitado por adaptador.

## Antes De Editar

1. Verificar `git status`.
2. Identificar se a mudanca afeta V2, legado ou ambos.
3. Rodar a menor validacao confiavel.
4. Atualizar docs quando a decisao mudar arquitetura, seguranca ou comando de release.
