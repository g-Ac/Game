# Território — Dinheiro • Poder 2

Sim de império criminoso por turnos (paper/protótipo). Este repositório contém o
**scaffold Expo + o core loop mínimo jogável** — o primeiro passo do
`game-design-doc.md`.

> ⚠️ Projeto original. Nome, cidades, facções e assets são próprios — inspirado
> na *pegada* do gênero, não é cópia.

## O que já roda

- **Tela inicial** replicando a estética do protótipo (título dourado stencil,
  grid de cidades, pixel fonts Bungee + VT323).
- **1 cidade** (Zona Sul, 2020s) em **grade 3×3 (9 bairros)**: a rua de baixo
  `Beco do Sol (você) — Vila Torta (neutro) — Morro Alto (IA)` é a disputa clássica;
  as duas fileiras de cima são território neutro de expansão (economia e manobra).
- **2 facções**: Os Corvos (jogador) vs Sindicato Rubro (IA agressiva).
- **Sistema de Jobs por soldado** (estilo *Respect 2*): cada soldado de pé faz **UM
  job por turno** — **💰 Vender** (faturar na esquina), **🛡 Proteger** (postura
  defensiva), **🔍 Sondar** (intel de vizinho inimigo), **⚔ Invadir** (liderar o crew
  num assalto) ou **Mover**. Gestão (armar / recrutar / boca / advogado) depende só
  de caixa, não gasta job.
- **Personagens com identidade**: patente (Soldado / Tenente / Capitão), ⭐ peças-chave,
  contagem de mortes. **Importantes são blindados** em combate — o rank-and-file leva o
  tiro primeiro; a peça-chave só cai depois que o escudo é dizimado.
- **Combate** com força dos soldados + dano da arma vs defesa, fator aleatório,
  traços de personalidade, e baixas (ferido / morto / preso por batida policial).
- **Consolidação**: quem toma um bairro cava trincheira (proteção) e aguenta o
  contra-ataque imediato do inimigo.
- **Economia** por turno (renda dos territórios) + venda ativa dos soldados.
- **Recrutamento** de soldados — snowball via território.
- **Produção**: bocas/pontos de venda (níveis 1-3) rendem por turno, são tomadas junto
  com o bairro e atraem polícia. Trade-off risco × renda.
- **Sondagem / Heat / polícia**: sondar dá intel (bônus no próximo assalto); calor alto
  arrisca batida (soldado preso, boca estourada). **Advogado** esfria o calor.
- **Save/load** automático via AsyncStorage (a partida persiste ao fechar o app).
- **Vitória**: dominar os 9 bairros. **Derrota**: perder todo o território.

## Como jogar (jobs + combate)

Cada soldado de pé faz **um job por turno** — o HUD mostra quantos ainda estão
**Livres**. A tática que vence: **proteja a fronteira, faça economia (vender/boca) na
retaguarda, concentre um crew forte num bairro e assalte quando tiver vantagem**. O
atacante tem bônus de iniciativa (1.2), mas **território protegido segura o
contra-ataque no empate** — pra tomar terreno defendido você precisa de vantagem de
força. Território desguarnecido cai fácil.

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
  data/seed.ts         # partida de teste (mapa, facções, catálogo de armas) + balanceamento
  theme/tokens.ts      # cores e fontes derivadas do protótipo
  engine/
    combat.ts          # resolução de combate (puro, RNG injetável)
    selectors.ts       # queries derivadas do estado (puro)
    actions.ts         # mover / comprar / atacar / renda (puro, imutável)
    ai.ts              # fase da IA por arquétipo
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
