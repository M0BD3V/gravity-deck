# Gravity Deck Product Direction

## Objetivo

Gravity Deck e a linha oficial da Mob Studios para biblioteca gamer, Gravity Deck Host, Gravity Deck Mobile e Gravity Stream em rede local. O app antigo MOB Deck fica como referencia de logica; `mob-deck-v2` e a base ativa.

## Principios de design

- A primeira tela e uma area de trabalho, nao uma landing page.
- Acoes principais devem responder a intencao do usuario: jogar no PC, jogar no celular, parear celular, ligar PC, reescanear biblioteca.
- Estados importam tanto quanto botoes: PC online/offline, celular pareado, controle conectado, rede, latencia, video e audio.
- Gravity Deck Mobile e Gravity Deck compartilham linguagem visual, mas cada um precisa de layout proprio.
- O produto deve funcionar bem com mouse, toque e controle.
- Menos texto explicativo dentro da interface; nomes claros nos comandos.

## Referencias

- Material Design: padroes de componentes, navegacao e estados para Android.
- Apple Human Interface Guidelines: clareza visual, hierarquia e foco na tarefa.
- Fluent 2: densidade e comandos para desktop.
- Nielsen Norman Group: usabilidade mobile, navegacao e reducao de carga cognitiva.

## Arquitetura desejada

- `apps/desktop`: Gravity Deck para Windows e host do Gravity Stream.
- `apps/mobile`: Gravity Mobile para Android e cliente do Gravity Stream.
- `packages/ui`: componentes compartilhados.
- `packages/core`: modelos, biblioteca, pareamento, diagnosticos e contratos de API.
- `packages/streaming`: Gravity Stream com sinalizacao WebRTC, captura, input remoto e telemetria.

## MVP Atual

1. Criar shell visual desktop/mobile.
2. Migrar scanner, catalogo, Wake-on-LAN e Gravity Sync do projeto legado por adapters seguros.
3. Implementar Gravity Stream de video em rede local.
4. Adicionar audio.
5. Enviar controle Bluetooth do Android para o PC.
6. Empacotar instalador Windows e APK Android.

## Decisao De Baseline

`mob-deck-v2` e a base oficial. A raiz do repositorio, `mobile-app` e builds MOB Deck continuam preservados como legado/deprecated ate a migracao completa do scanner, companion e referencias de release.

## Decisao sobre Moonlight

Nao incorporar codigo GPL do Moonlight no produto principal. Podemos estudar o comportamento e as ideias do projeto, mas a implementacao da V2 deve ser propria ou baseada em bibliotecas com licencas compativeis com distribuicao comercial fechada.
