# Território — Dinheiro • Poder 2

Sim de império criminoso por turnos (paper/protótipo). Este repositório contém o
**scaffold Expo + o core loop mínimo jogável** — o primeiro passo do
`game-design-doc.md`.

> ⚠️ Projeto original. Nome, cidades, facções e assets são próprios — inspirado
> na *pegada* do gênero, não é cópia.

## O que já roda

- **Tela inicial** com estética do protótipo (título dourado stencil, pixel fonts
  Bungee + VT323) e **escolha de dificuldade** (Normal / Difícil / O.G.).
- **1 cidade** (Zona Sul) em **grade 4×4 (16 bairros)**: jogador no canto inferior
  esquerdo, IA no superior direito, miolo neutro pra expansão.
- **Economia estilo *Respect 2* (o coração do jogo)**: cada território tem uma
  **demanda por produto** (tier `$`→`$$$$`). Você posiciona **vendedores**; o **Corre
  (hustle)** deles supre a demanda e gera receita. No fim do turno, o **Relatório de
  Grana** divide os ganhos: **~55% pagamento da crew, ~25% custo do produto, ~20%
  lucro**. O **pagamento médio por soldado** decide se o **Respeito** sobe 🟢 ou cai 🔴
  — crew grande demais pra pouco território derruba o respeito (o jogo se auto-regula).
  Indicador ▼ (sub-suprido) · ▬ (perfeito) · ▲ (excesso) direto no card do bairro.
- **Deploy livre** ("Add Soldado"): mande um soldado vender em qualquer território seu,
  ou **ocupe um neutro de fronteira** vendendo lá (expansão pacífica). Território novo
  rende **−60%** e estabiliza com o tempo.
- **Sistema de Jobs por soldado**: cada soldado de pé faz **UM job por turno** —
  💰 Vender · 🛡 Proteger · 🔍 Sondar · ⚔ Invadir · 🚗 Drive-by · deploy pra outro território.
- **Mercado Negro** (renova a cada turno, tudo em cash): **carro** (lugares/vel/blindagem
  pro drive-by), **colete** (reduz dano em combate), armas em lote, **soldado de elite**.
- **Drive-by**: embarca o crew num carro e mete bala num rival vizinho — fere/mata
  defensores mas **não toma o território** (bate e corre). Velocidade turbina o ataque,
  blindagem protege o crew.
- **Personagens com identidade**: Corre, patente (Soldado / Tenente / Capitão),
  ⭐ peças-chave, mortes. **Importantes são blindados** em combate (o escudo leva o tiro
  primeiro).
- **Combate** força + arma vs defesa, com **consolidação** (quem toma um bairro cava
  trincheira e segura o contra-ataque). Território protegido segura o empate; desguarnecido cai.
- **Heat / polícia**: sondar/operações sobem o calor; calor alto arrisca batida
  (soldado preso). **Advogado** esfria.
- **Dificuldade**: Normal (IA oportunista) · Difícil (IA agressiva) · O.G. (IA reforçada).
- **Save/load** automático via AsyncStorage.
- **Vitória**: dominar os 16 bairros **ou eliminar todas as gangues rivais** (sem
  território e sem tropa). **Derrota**: perder todo o território.

## Como jogar (economia + combate)

O motor é a **economia de vendas**: ocupe territórios, ponha vendedores até o Corre
**bater a demanda** (▬ perfeito), e **pague bem a crew** (controle território
suficiente pro pagamento médio ficar alto → respeito sobe). Expanda pra neutros
deployando vendedores; tome território rival na porrada (⚔ Invadir). Cada soldado faz
**um job por turno** — o HUD mostra quantos estão **Livres**. Território novo rende
pouco no começo: segure pra estabilizar.

## Como rodar no celular (Expo Go)

1. Instale o app **Expo Go** (Android / iOS).
2. No computador, dentro desta pasta:

   ```bash
   cd empire-game
   npm install          # só na primeira vez
   npx expo start
   ```

3. Escaneie o QR code do terminal com o Expo Go (Android) ou a câmera (iOS).
   Celular e PC precisam estar na **mesma rede Wi-Fi**. Se a rede bloquear a
   conexão, rode com túnel: `npx expo start --tunnel`.

## Stack

- Expo SDK 54 + TypeScript (strict)
- Zustand (estado global da partida)
- React Navigation (native-stack)
- AsyncStorage (persistência)
- @expo-google-fonts (Bungee + VT323)

## Estrutura

```
src/
  types/game.ts        # Cidade, Bairro, Faccao, Soldado, Arma, Turno, GameState
  data/seed.ts         # partida (mapa 4×4, facções, armas, demandas, dificuldade)
  theme/tokens.ts      # cores e fontes derivadas do protótipo
  engine/
    economia.ts        # demanda × Corre, relatório de grana, respeito (puro)
    mercado.ts         # Mercado Negro — ofertas do turno (carro, colete, armas, elite)
    combat.ts          # combate + drive-by (puro, RNG injetável)
    selectors.ts       # queries derivadas do estado (puro)
    actions.ts         # jobs, deploy, invadir, recrutar (puro, imutável)
    ai.ts              # fase da IA por arquétipo (economia + militar)
    victory.ts         # checagem de vitória/derrota
  store/gameStore.ts   # store Zustand — orquestra o loop de turno + persiste
  storage/persistence.ts  # save/load AsyncStorage
  navigation/          # stack Home → Game
  screens/             # HomeScreen (menu) + GameScreen (loop)
  components/          # BairroCard, SoldadoRow, LojaModal, LogPanel, etc.
```

O motor (`engine/`) é puro e sem dependência de React Native, então é
simulável/testável fora do app (foi validado por ~300 partidas headless).

## Testes

```bash
npm test          # roda a suíte Jest (jest-expo) sobre o engine/
```

Cobertura em `src/engine/__tests__/`: combate, ações (mover/comprar/recrutar/atacar/renda),
IA, seletores e checagem de vitória. RNG determinístico (mulberry32) pra combates
reprodutíveis.

## O que ficou pro próximo loop

Ver `game-design-doc.md`. Destaques: mais bairros e as 3 personalidades de IA de
verdade (paciente/oportunista jogando distinto), lealdade com decisões automáticas
dos soldados, meta-progressão entre partidas (cidades, contatos), e arte/áudio.
