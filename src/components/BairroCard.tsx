import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { cores, fontes } from '../theme/tokens';
import { cifraoDoBairro } from '../engine/economia';
import type { Bairro } from '../types/game';

interface Props {
  bairro: Bairro;
  donoNome: string | null;
  donoCor: string;
  numSoldados: number;
  /** Corre suprido no bairro (só relevante em território do jogador). */
  suprido: number;
  /** true = território do jogador (mostra o indicador de venda). */
  ehDoJogador: boolean;
  selecionado: boolean;
  atacavel: boolean;
  onPress: () => void;
}

/** Tons de terreno (aéreo) — variação por bairro pra o mapa não ficar chapado. */
const TERRENOS = ['#4a4336', '#524a38', '#453f33', '#3e392f', '#4d4738', '#423d32', '#494133', '#3b3730'];

/** Hash estável de string → índice, pra escolher o terreno de forma determinística. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** ▼ sub-suprido · ▬ perfeito · ▲ excesso. */
function indicadorVenda(suprido: number, demanda: number): { txt: string; cor: string } {
  if (suprido === 0) return { txt: '—', cor: cores.mutedDim };
  if (suprido < demanda) return { txt: '▼', cor: cores.danger };
  if (suprido > demanda) return { txt: '▲', cor: cores.gold1 };
  return { txt: '▬', cor: cores.moneyLight };
}

export function BairroCard({
  bairro,
  donoNome,
  donoCor,
  numSoldados,
  suprido,
  ehDoJogador,
  selecionado,
  atacavel,
  onPress,
}: Props) {
  const ind = indicadorVenda(suprido, bairro.demanda);
  const terreno = TERRENOS[hash(bairro.id) % TERRENOS.length];
  // Dono lido pela cor do tile: verde = seu, vermelho = inimigo, sem tint = neutro.
  const inimigo = !!donoNome && !ehDoJogador;
  const tint = ehDoJogador
    ? 'rgba(77,125,82,0.60)'
    : inimigo
      ? 'rgba(168,58,58,0.52)'
      : 'transparent';

  // Pulso quando o bairro troca de dono (momento da conquista).
  const pulso = useRef(new Animated.Value(1)).current;
  const donoAnterior = useRef(bairro.dono);
  useEffect(() => {
    if (donoAnterior.current !== bairro.dono) {
      donoAnterior.current = bairro.dono;
      pulso.setValue(1);
      Animated.sequence([
        Animated.spring(pulso, { toValue: 1.14, friction: 4, useNativeDriver: true }),
        Animated.spring(pulso, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start();
    }
  }, [bairro.dono, pulso]);

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale: pulso }] }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.tile,
          { backgroundColor: terreno },
          selecionado ? styles.selecionado : null,
          pressed ? styles.pressed : null,
        ]}
      >
        {/* Tint de dono */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} pointerEvents="none" />
        {/* Textura de quarteirão (ruas) */}
        <View pointerEvents="none" style={[styles.ruaH, { top: '34%' }]} />
        <View pointerEvents="none" style={[styles.ruaH, { top: '68%' }]} />
        <View pointerEvents="none" style={[styles.ruaV, { left: '38%' }]} />
        <View pointerEvents="none" style={[styles.ruaV, { left: '72%' }]} />

        {/* Conteúdo */}
        <Text style={styles.nome} numberOfLines={2}>
          {bairro.nome}
        </Text>

        <View style={styles.rodape}>
          <Text style={styles.tier}>{cifraoDoBairro(bairro)}</Text>
          {ehDoJogador ? (
            <Text style={[styles.ind, { color: ind.cor }]}>
              {ind.txt}
              {numSoldados > 0 ? ` ${numSoldados}` : ''}
            </Text>
          ) : atacavel ? (
            <Text style={styles.alvo}>⚔</Text>
          ) : numSoldados > 0 ? (
            <Text style={styles.tropasInimigo}>♦{numSoldados}</Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  tile: {
    flex: 1,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.45)',
    padding: 5,
    minHeight: 88,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  selecionado: { borderColor: cores.gold1, borderWidth: 2 },
  pressed: { opacity: 0.85 },
  ruaH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  ruaV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  nome: {
    fontFamily: fontes.corpo,
    fontSize: 15,
    lineHeight: 15,
    color: cores.cream,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  tier: {
    fontFamily: fontes.corpo,
    fontSize: 15,
    color: cores.moneyLight,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  ind: {
    fontFamily: fontes.corpo,
    fontSize: 15,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  alvo: {
    fontFamily: fontes.corpo,
    fontSize: 16,
    color: cores.cream,
  },
  tropasInimigo: {
    fontFamily: fontes.corpo,
    fontSize: 14,
    color: cores.cream,
    opacity: 0.85,
  },
});
