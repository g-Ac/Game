import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores, espaco, fontes } from '../theme/tokens';
import { CALOR_LIMIAR_BATIDA, CUSTO_ADVOGADO, CUSTO_RECRUTA } from '../data/seed';
import { cifraoDoBairro, suprimentoDoBairro } from '../engine/economia';
import { useGameStore } from '../store/gameStore';
import {
  alvosDeDeploy,
  alvosDeSoldado,
  alvosPossiveis,
  armaDe,
  ataqueDoBairroEstimado,
  bairroDe,
  defesaEstimada,
  faccaoDe,
  jogador as jogadorSel,
  podeAgir,
  soldadosNoBairro,
  temIntel,
} from '../engine/selectors';
import { BairroCard } from '../components/BairroCard';
import { Botao } from '../components/Botao';
import { FlashOverlay } from '../components/FlashOverlay';
import { GameOverOverlay } from '../components/GameOverOverlay';
import { LogPanel } from '../components/LogPanel';
import { LojaModal } from '../components/LojaModal';
import { MercadoModal } from '../components/MercadoModal';
import { RelatorioModal } from '../components/RelatorioModal';
import { SoldadoRow } from '../components/SoldadoRow';
import { StatPill } from '../components/StatPill';
import { TurnoBanner } from '../components/TurnoBanner';
import type { GameProps } from '../navigation/types';
import type { Patente, Soldado, SoldadoJob } from '../types/game';

function dePe(s: Soldado): boolean {
  return s.status === 'ativo' || s.status === 'ferido';
}

const PATENTE_LABEL: Record<Patente, string> = {
  soldado: 'Soldado',
  tenente: 'Tenente',
  capitao: 'Capitão',
};

const JOB_LABEL: Record<Exclude<SoldadoJob, null>, string> = {
  vender: 'vendendo',
  sondar: 'sondando',
  proteger: 'protegendo',
  invadir: 'invadindo',
  driveby: 'no drive-by',
  mover: 'em deslocamento',
};

function jobLabel(j: SoldadoJob): string {
  return j ? JOB_LABEL[j] : 'parado';
}

/** Quebra a lista de bairros (row-major) em fileiras de 4 pra desenhar a grade. */
function linhasDoMapa<T>(bairros: T[]): T[][] {
  const linhas: T[][] = [];
  for (let i = 0; i < bairros.length; i += 4) linhas.push(bairros.slice(i, i + 4));
  return linhas;
}

export function GameScreen({ navigation }: GameProps) {
  const insets = useSafeAreaInsets();
  const game = useGameStore((s) => s.game);
  const feedback = useGameStore((s) => s.feedback);
  const limparFeedback = useGameStore((s) => s.limparFeedback);
  const limparRelatorio = useGameStore((s) => s.limparRelatorio);
  const venderNoBairro = useGameStore((s) => s.venderNoBairro);
  const deployarVendedor = useGameStore((s) => s.deployarVendedor);
  const protegerBairro = useGameStore((s) => s.protegerBairro);
  const sondarBairro = useGameStore((s) => s.sondarBairro);
  const invadirBairro = useGameStore((s) => s.invadirBairro);
  const driveBy = useGameStore((s) => s.driveBy);
  const comprarArma = useGameStore((s) => s.comprarArma);
  const comprarMercado = useGameStore((s) => s.comprarMercado);
  const recrutarSoldado = useGameStore((s) => s.recrutarSoldado);
  const contratarAdvogado = useGameStore((s) => s.contratarAdvogado);
  const passarTurno = useGameStore((s) => s.passarTurno);
  const novoJogo = useGameStore((s) => s.novoJogo);
  const sairParaMenu = useGameStore((s) => s.sairParaMenu);
  const flash = useGameStore((s) => s.flash);

  const [selBairroId, setSelBairroId] = useState<string | null>(null);
  const [selSoldadoId, setSelSoldadoId] = useState<string | null>(null);
  const [lojaAberta, setLojaAberta] = useState(false);
  const [mercadoAberto, setMercadoAberto] = useState(false);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => limparFeedback(), 2600);
    return () => clearTimeout(t);
  }, [feedback, limparFeedback]);

  // Shake da tela a cada combate.
  const shakeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (flash.seq === 0) return;
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  }, [flash.seq, shakeAnim]);

  const fbOp = useRef(new Animated.Value(0)).current;
  const fbY = useRef(new Animated.Value(6)).current;
  useEffect(() => {
    if (!feedback) return;
    fbOp.setValue(0);
    fbY.setValue(6);
    Animated.parallel([
      Animated.timing(fbOp, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(fbY, { toValue: 0, friction: 6, useNativeDriver: true }),
    ]).start();
  }, [feedback, fbOp, fbY]);

  const alvos = useMemo(
    () => (game ? new Set(alvosPossiveis(game, game.jogadorId).map((b) => b.id)) : new Set<string>()),
    [game],
  );

  if (!game) {
    return (
      <View style={styles.vazio}>
        <Text style={styles.vazioTxt}>Nenhuma partida ativa.</Text>
        <Botao titulo="Voltar ao menu" variante="neutro" onPress={() => navigation.navigate('Home')} />
      </View>
    );
  }

  const jog = jogadorSel(game);
  const selBairro = selBairroId ? bairroDe(game, selBairroId) : undefined;
  const selSoldado = selSoldadoId ? jog.soldados.find((s) => s.id === selSoldadoId) ?? null : null;

  const bairroEhDoJogador = selBairro?.dono === game.jogadorId;

  const alvosSoldado = selSoldado ? alvosDeSoldado(game, selSoldado) : [];
  const soldadoLivre = selSoldado ? podeAgir(selSoldado) : false;
  // Alvos de deploy (vender) que NÃO são o bairro atual do soldado.
  const deployTargets =
    selSoldado && soldadoLivre
      ? alvosDeDeploy(game, game.jogadorId).filter((b) => b.id !== selSoldado.bairroId)
      : [];

  function selecionarBairro(id: string) {
    setSelBairroId(id);
    setSelSoldadoId(null);
  }

  function abrirArsenal() {
    setLojaAberta(true);
  }

  const soldadosDoBairro = selBairro
    ? soldadosNoBairro(game, selBairro.dono ?? '', selBairro.id)
    : [];

  const shakeX = shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.screen, { paddingTop: insets.top, transform: [{ translateX: shakeX }] }]}>
        <ScrollView contentContainerStyle={[styles.conteudo, { paddingBottom: insets.bottom + 96 }]}>
          {/* Cabeçalho */}
          <View style={styles.topbar}>
            <View>
              <Text style={styles.turnoTxt}>TURNO {game.turno.numero}</Text>
              <Text style={styles.cidadeTxt}>
                {game.cidade.nome} · {game.dificuldade.toUpperCase()}
              </Text>
            </View>
            <StatPill label="Livres" valor={game.turno.acoesRestantes} cor={cores.gold1} />
          </View>

          {/* Stats */}
          <View style={styles.stats}>
            <StatPill label="Caixa" valor={jog.caixa} prefixo="$" cor={cores.moneyLight} />
            <StatPill label="Respeito" valor={jog.respeito} cor={cores.gold1} />
            <StatPill
              label="Calor"
              valor={jog.calor}
              cor={jog.calor >= CALOR_LIMIAR_BATIDA ? cores.danger : cores.bloodLight}
            />
          </View>

          <Botao
            titulo="🛒 Mercado Negro"
            variante="neutro"
            onPress={() => setMercadoAberto(true)}
          />

          {jog.calor > 0 ? (
            <View style={styles.advogadoRow}>
              {jog.calor >= CALOR_LIMIAR_BATIDA ? (
                <Text style={styles.alerta}>⚠ Calor alto — risco de batida policial!</Text>
              ) : (
                <Text style={styles.advogadoDica}>Calor atrai a polícia.</Text>
              )}
              <Botao
                titulo={`Advogado ($${CUSTO_ADVOGADO})`}
                variante="neutro"
                disabled={jog.caixa < CUSTO_ADVOGADO}
                onPress={contratarAdvogado}
                style={styles.advogadoBtn}
              />
            </View>
          ) : null}

          {/* Mapa 4×4 */}
          <Text style={styles.secao}>TERRITÓRIOS</Text>
          <View style={styles.mapaGrid}>
            {linhasDoMapa(game.cidade.bairros).map((linha, i) => (
              <View key={i} style={styles.mapaRow}>
                {linha.map((b) => {
                  const dono = b.dono ? faccaoDe(game, b.dono) : undefined;
                  const num = b.dono ? soldadosNoBairro(game, b.dono, b.id).filter(dePe).length : 0;
                  return (
                    <BairroCard
                      key={b.id}
                      bairro={b}
                      donoNome={dono?.nome ?? null}
                      donoCor={dono?.cor ?? cores.neutral}
                      numSoldados={num}
                      suprido={b.dono === game.jogadorId ? suprimentoDoBairro(game, b) : 0}
                      ehDoJogador={b.dono === game.jogadorId}
                      selecionado={selBairroId === b.id}
                      atacavel={alvos.has(b.id)}
                      onPress={() => selecionarBairro(b.id)}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          {/* Painel do bairro */}
          {selBairro ? (
            <View style={styles.painel}>
              <View style={styles.painelHeader}>
                <Text style={styles.painelNome}>
                  {selBairro.nome} <Text style={styles.painelTier}>{cifraoDoBairro(selBairro)}</Text>
                </Text>
                <Text style={styles.painelDono}>
                  {selBairro.dono ? faccaoDe(game, selBairro.dono)?.nome : 'Neutro'}
                </Text>
              </View>

              {bairroEhDoJogador ? (
                <View style={styles.economiaBox}>
                  <Text style={styles.economiaTxt}>
                    Vendas: <Text style={styles.previewNum}>{suprimentoDoBairro(game, selBairro)}</Text> /{' '}
                    {selBairro.demanda} corre
                    {selBairro.estabilidade < 1 ? (
                      <Text style={styles.novoTag}>  · território novo −{Math.round((1 - selBairro.estabilidade) * 100)}%</Text>
                    ) : null}
                  </Text>
                  <Botao
                    titulo={`+ Recrutar ($${CUSTO_RECRUTA})`}
                    variante="primario"
                    disabled={jog.caixa < CUSTO_RECRUTA}
                    onPress={() => recrutarSoldado(selBairro.id)}
                  />
                </View>
              ) : (
                <View style={styles.ataqueBox}>
                  <Text style={styles.previewTxt}>
                    Demanda {selBairro.demanda} · Defesa{' '}
                    <Text style={styles.previewNum}>{defesaEstimada(game, selBairro.id)}</Text>
                  </Text>
                  <Text style={styles.dicaMini}>
                    {selBairro.dono
                      ? 'Território rival — selecione um soldado vizinho e ⚔ Invadir.'
                      : 'Neutro — selecione um soldado seu e mande vender aqui pra ocupar.'}
                  </Text>
                </View>
              )}

              {/* Soldados no bairro */}
              {soldadosDoBairro.length > 0 ? (
                <View style={styles.tropasBox}>
                  <Text style={styles.subsecao}>TROPAS AQUI</Text>
                  {soldadosDoBairro.map((s) => (
                    <SoldadoRow
                      key={s.id}
                      soldado={s}
                      arma={armaDe(game, s.armaId)}
                      selecionado={selSoldadoId === s.id}
                      selecionavel={bairroEhDoJogador && dePe(s)}
                      onPress={() => setSelSoldadoId((cur) => (cur === s.id ? null : s.id))}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.vazioBairro}>Sem tropas neste bairro.</Text>
              )}

              {/* Painel do soldado: ESCOLHA O JOB */}
              {selSoldado ? (
                <View style={styles.acoesSoldado}>
                  <View style={styles.soldadoHead}>
                    <Text style={styles.soldadoNome}>
                      {selSoldado.importante ? '⭐ ' : ''}
                      {selSoldado.nome}
                    </Text>
                    <Text style={styles.soldadoMeta}>
                      {PATENTE_LABEL[selSoldado.patente]} · corre {selSoldado.corre} · fç {selSoldado.forca}
                    </Text>
                  </View>

                  {soldadoLivre ? (
                    <>
                      <Text style={styles.jobLabel}>ESCOLHA O JOB</Text>
                      <View style={styles.jobGrid}>
                        <Botao
                          titulo="💰 Vender aqui"
                          variante="primario"
                          onPress={() => venderNoBairro(selSoldado.id)}
                          style={styles.jobBtn}
                        />
                        <Botao
                          titulo="🛡 Proteger"
                          variante="neutro"
                          onPress={() => protegerBairro(selSoldado.id)}
                          style={styles.jobBtn}
                        />
                      </View>

                      {/* Invadir / Sondar por alvo vizinho rival */}
                      {alvosSoldado.map((alvo) => {
                        const atk = ataqueDoBairroEstimado(game, game.jogadorId, selSoldado.bairroId, alvo.id);
                        const def = defesaEstimada(game, alvo.id);
                        const intel = temIntel(game, game.jogadorId, alvo.id);
                        const rival = alvo.dono !== null;
                        return (
                          <View key={alvo.id} style={styles.alvoBox}>
                            <Text style={styles.previewTxt}>
                              {alvo.nome}{' '}
                              {rival ? (
                                <>
                                  : ataque <Text style={styles.previewNum}>{atk}</Text> vs def{' '}
                                  <Text style={styles.previewNum}>{def}</Text>
                                </>
                              ) : (
                                <Text style={styles.dicaMini}>(neutro)</Text>
                              )}
                            </Text>
                            {intel ? <Text style={styles.intelTag}>🎯 Intel ativo</Text> : null}
                            {rival ? (
                              <>
                                <View style={styles.jobGrid}>
                                  <Botao
                                    titulo="⚔ Invadir"
                                    variante="ataque"
                                    disabled={atk <= 0}
                                    onPress={() => invadirBairro(selSoldado.id, alvo.id)}
                                    style={styles.jobBtn}
                                  />
                                  <Botao
                                    titulo="🔍 Sondar"
                                    variante="neutro"
                                    disabled={intel}
                                    onPress={() => sondarBairro(selSoldado.id, alvo.id)}
                                    style={styles.jobBtn}
                                  />
                                </View>
                                {jog.veiculos.length > 0 ? (
                                  <Botao
                                    titulo="🚗 Drive-by (bate e corre)"
                                    variante="ataque"
                                    onPress={() => driveBy(selSoldado.id, alvo.id)}
                                  />
                                ) : null}
                              </>
                            ) : null}
                          </View>
                        );
                      })}

                      {/* Deploy: mandar vender em outro território (seu) ou ocupar neutro */}
                      {deployTargets.length > 0 ? (
                        <>
                          <Text style={styles.moverLabel}>Mandar vender em:</Text>
                          <View style={styles.moverBtns}>
                            {deployTargets.map((t) => (
                              <Botao
                                key={t.id}
                                titulo={t.dono === null ? `⚑ Ocupar ${t.nome}` : `→ ${t.nome}`}
                                variante="neutro"
                                onPress={() => deployarVendedor(selSoldado.id, t.id)}
                                style={styles.moverBtn}
                              />
                            ))}
                          </View>
                        </>
                      ) : null}

                      <Botao titulo="🔫 Arsenal / armar" variante="fantasma" onPress={abrirArsenal} />
                    </>
                  ) : (
                    <>
                      <Text style={styles.jaAgiu}>Já agiu neste turno ({jobLabel(selSoldado.jobAtual)}).</Text>
                      <Botao titulo="🔫 Arsenal / armar" variante="fantasma" onPress={abrirArsenal} />
                    </>
                  )}
                </View>
              ) : bairroEhDoJogador ? (
                <Text style={styles.dica}>Toque num soldado pra dar um job.</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.dica}>Toque num território pra ver detalhes e agir.</Text>
          )}

          <LogPanel log={game.log} />
        </ScrollView>

        {/* Barra fixa inferior */}
        <View style={[styles.rodape, { paddingBottom: insets.bottom + espaco.sm }]}>
          {feedback ? (
            <Animated.Text
              style={[styles.feedback, { opacity: fbOp, transform: [{ translateY: fbY }] }]}
              numberOfLines={2}
            >
              {feedback}
            </Animated.Text>
          ) : null}
          <View style={styles.rodapeBtns}>
            <Botao titulo="Menu" variante="fantasma" onPress={() => navigation.navigate('Home')} style={styles.btnMenu} />
            <Botao titulo="PASSAR TURNO ▶" variante="primario" onPress={passarTurno} style={styles.btnTurno} />
          </View>
        </View>
      </Animated.View>

      <FlashOverlay seq={flash.seq} cor={flash.cor} />
      <TurnoBanner turno={game.turno.numero} />
      <RelatorioModal relatorio={game.ultimoRelatorio} onFechar={limparRelatorio} />

      <MercadoModal
        visible={mercadoAberto}
        itens={game.mercado}
        veiculos={jog.veiculos}
        caixa={jog.caixa}
        onComprar={(itemId) => comprarMercado(itemId)}
        onClose={() => setMercadoAberto(false)}
      />

      <LojaModal
        visible={lojaAberta}
        armas={game.armas}
        caixa={jog.caixa}
        soldado={selSoldado}
        armaAtual={selSoldado ? armaDe(game, selSoldado.armaId) : undefined}
        onComprar={(armaId) => {
          if (selSoldado) comprarArma(armaId, selSoldado.id);
        }}
        onClose={() => setLojaAberta(false)}
      />

      <GameOverOverlay
        status={game.status}
        respeito={jog.respeito}
        turno={game.turno.numero}
        onJogarDeNovo={() => {
          novoJogo(game.dificuldade);
          setSelBairroId(null);
          setSelSoldadoId(null);
        }}
        onMenu={() => {
          sairParaMenu();
          navigation.navigate('Home');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: cores.bg },
  screen: { flex: 1, backgroundColor: cores.bg },
  conteudo: { padding: espaco.md, gap: espaco.md },
  vazio: { flex: 1, backgroundColor: cores.bg, justifyContent: 'center', alignItems: 'center', gap: espaco.md },
  vazioTxt: { fontFamily: fontes.corpo, fontSize: 18, color: cores.muted },

  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  turnoTxt: { fontFamily: fontes.titulo, fontSize: 20, color: cores.gold1 },
  cidadeTxt: { fontFamily: fontes.corpo, fontSize: 15, color: cores.muted, marginTop: 2 },

  stats: { flexDirection: 'row', gap: espaco.sm },

  advogadoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco.sm },
  alerta: { flex: 1, fontFamily: fontes.corpo, fontSize: 15, color: cores.danger },
  advogadoDica: { flex: 1, fontFamily: fontes.corpo, fontSize: 14, color: cores.muted },
  advogadoBtn: { minWidth: 130 },
  intelTag: { fontFamily: fontes.corpo, fontSize: 14, color: cores.gold1, textAlign: 'center' },

  secao: { fontFamily: fontes.titulo, fontSize: 12, color: cores.muted, letterSpacing: 2, marginTop: espaco.xs },
  mapaGrid: { gap: espaco.sm },
  mapaRow: { flexDirection: 'row', gap: espaco.sm },

  painel: {
    backgroundColor: cores.bgElev,
    borderWidth: 1,
    borderColor: cores.cardBorder,
    borderRadius: 3,
    padding: espaco.md,
    gap: espaco.sm,
  },
  painelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  painelNome: { fontFamily: fontes.titulo, fontSize: 16, color: cores.cream },
  painelTier: { fontFamily: fontes.corpo, fontSize: 15, color: cores.moneyLight },
  painelDono: { fontFamily: fontes.corpo, fontSize: 15, color: cores.muted },

  economiaBox: { backgroundColor: cores.bg, borderRadius: 3, padding: espaco.sm, gap: espaco.sm },
  economiaTxt: { fontFamily: fontes.corpo, fontSize: 15, color: cores.cream },
  novoTag: { color: cores.danger, fontSize: 13 },

  ataqueBox: { backgroundColor: cores.bg, borderRadius: 3, padding: espaco.sm, gap: espaco.xs },
  alvoBox: { backgroundColor: cores.bg, borderRadius: 3, padding: espaco.sm, gap: espaco.sm },
  previewTxt: { fontFamily: fontes.corpo, fontSize: 16, color: cores.cream, textAlign: 'center' },
  previewNum: { color: cores.gold1 },
  dicaMini: { fontFamily: fontes.corpo, fontSize: 13, color: cores.mutedDim, textAlign: 'center' },

  tropasBox: { gap: espaco.xs },
  subsecao: { fontFamily: fontes.titulo, fontSize: 10, color: cores.mutedDim, letterSpacing: 2, marginBottom: espaco.xs },
  vazioBairro: { fontFamily: fontes.corpo, fontSize: 15, color: cores.mutedDim },

  acoesSoldado: { borderTopWidth: 1, borderTopColor: cores.cardBorder, paddingTop: espaco.sm, gap: espaco.sm },
  soldadoHead: { gap: 2 },
  soldadoNome: { fontFamily: fontes.titulo, fontSize: 15, color: cores.cream },
  soldadoMeta: { fontFamily: fontes.corpo, fontSize: 14, color: cores.muted },
  jobLabel: { fontFamily: fontes.titulo, fontSize: 11, color: cores.gold1, letterSpacing: 2 },
  jobGrid: { flexDirection: 'row', gap: espaco.sm },
  jobBtn: { flex: 1 },
  jaAgiu: { fontFamily: fontes.corpo, fontSize: 15, color: cores.mutedDim, fontStyle: 'italic' },

  moverLabel: { fontFamily: fontes.corpo, fontSize: 15, color: cores.muted },
  moverBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  moverBtn: { flexGrow: 1 },
  dica: { fontFamily: fontes.corpo, fontSize: 15, color: cores.mutedDim, textAlign: 'center' },

  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: cores.bgElev,
    borderTopWidth: 1,
    borderTopColor: cores.cardBorder,
    paddingHorizontal: espaco.md,
    paddingTop: espaco.sm,
    gap: espaco.xs,
  },
  feedback: { fontFamily: fontes.corpo, fontSize: 15, color: cores.gold1, textAlign: 'center' },
  rodapeBtns: { flexDirection: 'row', gap: espaco.sm },
  btnMenu: { flex: 1 },
  btnTurno: { flex: 2 },
});
