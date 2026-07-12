import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { cores, espaco, fontes } from '../theme/tokens';
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

/** ▼ sub-suprido · ▬ perfeito · ▲ excesso — igual ao mapa do Respect. */
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
          styles.card,
          { borderColor: selecionado ? cores.gold1 : donoCor },
          selecionado ? styles.selecionado : null,
          pressed ? styles.pressed : null,
        ]}
      >
      <Text style={styles.nome} numberOfLines={1}>
        {bairro.nome}
      </Text>
      <Text style={[styles.dono, { color: donoCor }]} numberOfLines={1}>
        {donoNome ?? 'Neutro'}
      </Text>
      <View style={styles.linha}>
        <Text style={styles.tier}>{cifraoDoBairro(bairro)}</Text>
        {ehDoJogador ? (
          <Text style={[styles.ind, { color: ind.cor }]}>
            {ind.txt} {suprido}/{bairro.demanda}
          </Text>
        ) : (
          <Text style={styles.meta}>dem {bairro.demanda}</Text>
        )}
      </View>
        <View style={styles.rodape}>
          <Text style={styles.tropas}>♦ {numSoldados}</Text>
          {atacavel ? <Text style={styles.alvo}>⚔ ALVO</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  card: {
    flex: 1,
    backgroundColor: cores.bgElev,
    borderWidth: 2,
    borderRadius: 3,
    padding: espaco.sm,
    minHeight: 108,
  },
  selecionado: { backgroundColor: '#20200f' },
  pressed: { transform: [{ scale: 0.97 }] },
  nome: {
    fontFamily: fontes.titulo,
    fontSize: 12,
    color: cores.cream,
  },
  dono: {
    fontFamily: fontes.corpo,
    fontSize: 15,
    marginTop: 2,
  },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: espaco.xs,
  },
  meta: {
    fontFamily: fontes.corpo,
    fontSize: 14,
    color: cores.muted,
  },
  tier: {
    fontFamily: fontes.corpo,
    fontSize: 15,
    color: cores.moneyLight,
    letterSpacing: 1,
  },
  ind: {
    fontFamily: fontes.corpo,
    fontSize: 14,
  },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: espaco.xs,
  },
  tropas: {
    fontFamily: fontes.corpo,
    fontSize: 16,
    color: cores.cream,
  },
  boca: {
    fontFamily: fontes.corpo,
    fontSize: 15,
    color: cores.moneyLight,
  },
  alvo: {
    fontFamily: fontes.corpo,
    fontSize: 14,
    color: cores.bloodLight,
    letterSpacing: 1,
  },
});
