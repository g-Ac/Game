import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores, espaco, fontes } from '../theme/tokens';
import { CALOR_LIMIAR_BATIDA, CUSTO_ADVOGADO } from '../data/seed';
import { suprimentoDoBairro } from '../engine/economia';
import { useGameStore } from '../store/gameStore';
import {
  alvosPossiveis,
  armaDe,
  bairroDe,
  defensoresVisiveis,
  faccaoDe,
  jogador as jogadorSel,
  soldadosNoBairro,
  temDefensorOculto,
} from '../engine/selectors';
import { BairroCard } from '../components/BairroCard';
import { BairroModal } from '../components/BairroModal';
import { Botao } from '../components/Botao';
import { FlashOverlay } from '../components/FlashOverlay';
import { GameOverOverlay } from '../components/GameOverOverlay';
import { LogPanel } from '../components/LogPanel';
import { LojaModal } from '../components/LojaModal';
import { MercadoModal } from '../components/MercadoModal';
import { RelatorioModal } from '../components/RelatorioModal';
import { SoldadoModal } from '../components/SoldadoModal';
import { StatPill } from '../components/StatPill';
import { TurnoBanner } from '../components/TurnoBanner';
import type { GameProps } from '../navigation/types';
import type { Soldado } from '../types/game';

function dePe(s: Soldado): boolean {
  return s.status === 'ativo' || s.status === 'ferido';
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
  const comprarArma = useGameStore((s) => s.comprarArma);
  const comprarMercado = useGameStore((s) => s.comprarMercado);
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
  const selSoldado = selSoldadoId ? jog.soldados.find((s) => s.id === selSoldadoId) ?? null : null;
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
            <StatPill label="Parados" valor={game.turno.acoesRestantes} cor={cores.gold1} />
          </View>

          <View style={styles.stats}>
            <StatPill label="Caixa" valor={jog.caixa} prefixo="$" cor={cores.moneyLight} />
            <StatPill label="Respeito" valor={jog.respeito} cor={cores.gold1} />
            <StatPill
              label="Calor"
              valor={jog.calor}
              cor={jog.calor >= CALOR_LIMIAR_BATIDA ? cores.danger : cores.bloodLight}
            />
          </View>

          <Botao titulo="🛒 Mercado Negro" variante="neutro" onPress={() => setMercadoAberto(true)} />

          {jog.calor > 0 ? (
            <View style={styles.advogadoRow}>
              {jog.calor >= CALOR_LIMIAR_BATIDA ? (
                <Text style={styles.alerta}>⚠ Calor alto — risco de batida!</Text>
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

          {/* Mapa 4×4 — toque num bairro pra abrir o popup */}
          <Text style={styles.secao}>TERRITÓRIOS · toque pra agir</Text>
          <View style={styles.mapaGrid}>
            {linhasDoMapa(game.cidade.bairros).map((linha, i) => (
              <View key={i} style={styles.mapaRow}>
                {linha.map((b) => {
                  const dono = b.dono ? faccaoDe(game, b.dono) : undefined;
                  const meu = b.dono === game.jogadorId;
                  const num = !b.dono
                    ? 0
                    : meu
                      ? soldadosNoBairro(game, b.dono, b.id).filter(dePe).length
                      : defensoresVisiveis(game, b.id, game.jogadorId).length;
                  return (
                    <BairroCard
                      key={b.id}
                      bairro={b}
                      donoNome={dono?.nome ?? null}
                      donoCor={dono?.cor ?? cores.neutral}
                      numSoldados={num}
                      suprido={meu ? suprimentoDoBairro(game, b) : 0}
                      ehDoJogador={meu}
                      temOculto={temDefensorOculto(game, b.id, game.jogadorId)}
                      selecionado={selBairroId === b.id}
                      atacavel={alvos.has(b.id)}
                      onPress={() => setSelBairroId(b.id)}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          <LogPanel log={game.log} />
        </ScrollView>

        {/* Barra fixa inferior */}
        <View style={[styles.rodape, { paddingBottom: insets.bottom + espaco.sm }]}>
          {feedback ? (
            <Animated.Text style={[styles.feedback, { opacity: fbOp, transform: [{ translateY: fbY }] }]} numberOfLines={2}>
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

      {/* Popups — um modal por vez (iOS não curte empilhar) */}
      <BairroModal
        bairroId={selSoldadoId ? null : selBairroId}
        onClose={() => setSelBairroId(null)}
        onSelectSoldado={(id) => {
          setSelBairroId(null);
          setSelSoldadoId(id);
        }}
      />
      <SoldadoModal
        soldadoId={lojaAberta ? null : selSoldadoId}
        onClose={() => setSelSoldadoId(null)}
        onAbrirArsenal={() => setLojaAberta(true)}
      />
      <RelatorioModal
        relatorio={game.status === 'em_andamento' ? game.ultimoRelatorio : null}
        onFechar={limparRelatorio}
      />
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

  secao: { fontFamily: fontes.titulo, fontSize: 12, color: cores.muted, letterSpacing: 2, marginTop: espaco.xs },
  mapaGrid: { gap: 3, borderWidth: 2, borderColor: cores.cardBorder, borderRadius: 3, padding: 3, backgroundColor: '#26241d' },
  mapaRow: { flexDirection: 'row', gap: 3 },

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
