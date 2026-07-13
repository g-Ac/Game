import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cores, espaco, fontes } from '../theme/tokens';
import { CUSTO_RECRUTA } from '../data/seed';
import { cifraoDoBairro, suprimentoDoBairro } from '../engine/economia';
import { dinheiro } from '../util/format';
import { useGameStore } from '../store/gameStore';
import {
  armaDe,
  bairroDe,
  defesaEstimada,
  defensoresVisiveis,
  faccaoDe,
  soldadosNoBairro,
  temDefensorOculto,
  temIntel,
} from '../engine/selectors';
import { Botao } from './Botao';
import { SoldadoRow } from './SoldadoRow';

interface Props {
  bairroId: string | null;
  onClose: () => void;
  onSelectSoldado: (id: string) => void;
}

function dePe(status: string): boolean {
  return status === 'ativo' || status === 'ferido';
}

/** Popup do bairro: economia/defesa + lista de tropas. Tocar num soldado abre o dele. */
export function BairroModal({ bairroId, onClose, onSelectSoldado }: Props) {
  const game = useGameStore((s) => s.game);
  const recrutarSoldado = useGameStore((s) => s.recrutarSoldado);

  if (!game || !bairroId) return null;
  const b = bairroDe(game, bairroId);
  if (!b) return null;

  const meu = b.dono === game.jogadorId;
  const jog = faccaoDe(game, game.jogadorId)!;
  const donoFac = b.dono ? faccaoDe(game, b.dono) : undefined;
  const oculto = temDefensorOculto(game, b.id, game.jogadorId);
  const revelado = temIntel(game, game.jogadorId, b.id);

  // Tropas: no meu vejo tudo; no inimigo só os visíveis (névoa).
  const tropas = !b.dono
    ? []
    : meu
      ? soldadosNoBairro(game, b.dono, b.id).filter((s) => dePe(s.status))
      : defensoresVisiveis(game, b.id, game.jogadorId);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.bg} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.nome}>
              {b.nome} <Text style={styles.tier}>{cifraoDoBairro(b)}</Text>
            </Text>
            <Text style={[styles.dono, meu ? styles.donoMeu : b.dono ? styles.donoInim : null]}>
              {donoFac?.nome ?? 'Neutro'}
            </Text>
          </View>

          {meu ? (
            <View style={styles.box}>
              <Text style={styles.txt}>
                Vendas: <Text style={styles.num}>{suprimentoDoBairro(game, b)}</Text> / {b.demanda} corre
                {b.estabilidade < 1 ? (
                  <Text style={styles.novo}>  · novo −{Math.round((1 - b.estabilidade) * 100)}%</Text>
                ) : null}
              </Text>
              <Botao
                titulo={`+ Recrutar ($${CUSTO_RECRUTA})`}
                variante="primario"
                disabled={jog.caixa < CUSTO_RECRUTA}
                onPress={() => {
                  recrutarSoldado(b.id);
                }}
              />
            </View>
          ) : (
            <View style={styles.box}>
              <Text style={styles.txt}>
                Demanda {b.demanda} · Defesa <Text style={styles.num}>{oculto ? '???' : defesaEstimada(game, b.id)}</Text>
              </Text>
              {oculto ? <Text style={styles.tag}>🌫 Tropa oculta — 🔍 Sondar pra revelar</Text> : null}
              {b.dono && revelado ? (
                <Text style={styles.tag}>💰 Estoque de {donoFac?.nome}: ${dinheiro(donoFac?.stash ?? 0)} (roubável)</Text>
              ) : null}
              <Text style={styles.dica}>
                {b.dono
                  ? 'Território rival — selecione um soldado seu num bairro vizinho e ⚔ Invadir.'
                  : 'Neutro — selecione um soldado seu e mande vender aqui pra ocupar.'}
              </Text>
            </View>
          )}

          <Text style={styles.secao}>TROPAS AQUI</Text>
          {tropas.length > 0 ? (
            <ScrollView style={styles.lista} contentContainerStyle={styles.listaInner}>
              {tropas.map((s) => (
                <SoldadoRow
                  key={s.id}
                  soldado={s}
                  arma={armaDe(game, s.armaId)}
                  selecionado={false}
                  selecionavel={meu}
                  onPress={() => onSelectSoldado(s.id)}
                />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.vazio}>{oculto ? 'Nada visível (pode ter tropa oculta).' : 'Sem tropas aqui.'}</Text>
          )}

          <Pressable style={styles.fechar} onPress={onClose}>
            <Text style={styles.fecharTxt}>Fechar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: espaco.lg },
  card: {
    backgroundColor: cores.bgElev,
    borderWidth: 2,
    borderColor: cores.gold2,
    borderRadius: 3,
    padding: espaco.lg,
    gap: espaco.sm,
    maxHeight: '85%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  nome: { fontFamily: fontes.titulo, fontSize: 18, color: cores.cream },
  tier: { fontFamily: fontes.corpo, fontSize: 16, color: cores.moneyLight },
  dono: { fontFamily: fontes.corpo, fontSize: 15, color: cores.muted },
  donoMeu: { color: cores.moneyLight },
  donoInim: { color: cores.bloodLight },
  box: { backgroundColor: cores.bg, borderRadius: 3, padding: espaco.sm, gap: espaco.sm },
  txt: { fontFamily: fontes.corpo, fontSize: 16, color: cores.cream },
  num: { color: cores.gold1 },
  novo: { color: cores.danger, fontSize: 13 },
  tag: { fontFamily: fontes.corpo, fontSize: 14, color: cores.gold1 },
  dica: { fontFamily: fontes.corpo, fontSize: 13, color: cores.mutedDim },
  secao: { fontFamily: fontes.titulo, fontSize: 11, color: cores.mutedDim, letterSpacing: 2 },
  lista: { maxHeight: 260 },
  listaInner: { gap: 2 },
  vazio: { fontFamily: fontes.corpo, fontSize: 15, color: cores.mutedDim },
  fechar: { borderWidth: 1, borderColor: cores.cardBorder, borderRadius: 3, paddingVertical: espaco.sm, alignItems: 'center' },
  fecharTxt: { fontFamily: fontes.corpo, fontSize: 15, color: cores.muted },
});
