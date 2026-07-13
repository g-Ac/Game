import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cores, espaco, fontes } from '../theme/tokens';
import { useGameStore } from '../store/gameStore';
import {
  alvosDeDeploy,
  alvosDeSoldado,
  ataqueDoBairroEstimado,
  bairroDe,
  defesaEstimada,
  jogador as jogadorSel,
  temDefensorOculto,
  temIntel,
} from '../engine/selectors';
import { Botao } from './Botao';
import type { Patente, SoldadoJob } from '../types/game';

interface Props {
  soldadoId: string | null;
  onClose: () => void;
  onAbrirArsenal: () => void;
}

const PATENTE_LABEL: Record<Patente, string> = {
  soldado: 'Soldado',
  tenente: 'Tenente',
  capitao: 'Capitão',
};

const JOB_ATUAL: Record<string, string> = {
  vender: '💰 Vendendo',
  proteger: '🛡 Em guarda',
};

function custoPromocao(p: Patente): number | null {
  if (p === 'soldado') return 5000;
  if (p === 'tenente') return 12000;
  return null;
}

/** Popup do soldado: stats + escolha de job (persistente) + promover + arsenal. */
export function SoldadoModal({ soldadoId, onClose, onAbrirArsenal }: Props) {
  const game = useGameStore((s) => s.game);
  const venderNoBairro = useGameStore((s) => s.venderNoBairro);
  const protegerBairro = useGameStore((s) => s.protegerBairro);
  const sondarBairro = useGameStore((s) => s.sondarBairro);
  const invadirBairro = useGameStore((s) => s.invadirBairro);
  const driveBy = useGameStore((s) => s.driveBy);
  const deployarVendedor = useGameStore((s) => s.deployarVendedor);
  const promoverSoldado = useGameStore((s) => s.promoverSoldado);

  if (!game || !soldadoId) return null;
  const jog = jogadorSel(game);
  const s = jog.soldados.find((x) => x.id === soldadoId);
  if (!s) return null;

  const alvos = alvosDeSoldado(game, s);
  const deployTargets = alvosDeDeploy(game, game.jogadorId).filter((b) => b.id !== s.bairroId);
  const custoProm = custoPromocao(s.patente);
  const bairro = bairroDe(game, s.bairroId);
  const jobTxt = s.jobAtual && JOB_ATUAL[s.jobAtual] ? JOB_ATUAL[s.jobAtual] : 'Parado';

  const agir = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.bg} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.nome}>
              {s.importante ? '⭐ ' : ''}
              {s.nome}
            </Text>
            <Text style={styles.jobAtual}>{jobTxt}</Text>
          </View>
          <Text style={styles.meta}>
            {PATENTE_LABEL[s.patente]} · {bairro?.nome ?? '—'}
          </Text>
          <Text style={styles.stats}>
            💪 fç {s.forca} · 🎯 corre {s.corre} · ⚔ edge {s.edge} · ☠ {s.mortes}
            {s.colete ? ' · 🦺' : ''}
          </Text>

          <ScrollView style={styles.lista} contentContainerStyle={styles.listaInner}>
            <Text style={styles.secao}>JOB (fica ativo todo turno)</Text>
            <View style={styles.grid}>
              <Botao titulo="💰 Vender aqui" variante="primario" onPress={() => agir(() => venderNoBairro(s.id))} style={styles.flex} />
              <Botao titulo="🛡 Proteger" variante="neutro" onPress={() => agir(() => protegerBairro(s.id))} style={styles.flex} />
            </View>

            {alvos.map((alvo) => {
              const rival = alvo.dono !== null;
              if (!rival) return null;
              const oculto = temDefensorOculto(game, alvo.id, game.jogadorId);
              const atk = ataqueDoBairroEstimado(game, game.jogadorId, s.bairroId, alvo.id);
              const def = defesaEstimada(game, alvo.id);
              const intel = temIntel(game, game.jogadorId, alvo.id);
              return (
                <View key={alvo.id} style={styles.alvoBox}>
                  <Text style={styles.alvoTxt}>
                    {alvo.nome} — ataque <Text style={styles.num}>{atk}</Text> vs def{' '}
                    <Text style={styles.num}>{oculto ? '???' : def}</Text>
                  </Text>
                  <View style={styles.grid}>
                    <Botao titulo="⚔ Invadir" variante="ataque" disabled={atk <= 0} onPress={() => agir(() => invadirBairro(s.id, alvo.id))} style={styles.flex} />
                    <Botao titulo="🔍 Sondar" variante="neutro" disabled={intel} onPress={() => agir(() => sondarBairro(s.id, alvo.id))} style={styles.flex} />
                  </View>
                  {jog.veiculos.length > 0 ? (
                    <Botao titulo="🚗 Drive-by" variante="ataque" onPress={() => agir(() => driveBy(s.id, alvo.id))} />
                  ) : null}
                </View>
              );
            })}

            {deployTargets.length > 0 ? (
              <>
                <Text style={styles.secao}>MANDAR VENDER EM</Text>
                <View style={styles.gridWrap}>
                  {deployTargets.map((t) => (
                    <Botao
                      key={t.id}
                      titulo={t.dono === null ? `⚑ Ocupar ${t.nome}` : `→ ${t.nome}`}
                      variante="neutro"
                      onPress={() => agir(() => deployarVendedor(s.id, t.id))}
                      style={styles.deployBtn}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.grid}>
              {custoProm !== null ? (
                <Botao
                  titulo={`⬆ Promover ($${custoProm})`}
                  variante="neutro"
                  disabled={jog.caixa < custoProm}
                  onPress={() => agir(() => promoverSoldado(s.id))}
                  style={styles.flex}
                />
              ) : null}
              <Botao titulo="🔫 Arsenal" variante="fantasma" onPress={onAbrirArsenal} style={styles.flex} />
            </View>
          </ScrollView>

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
    gap: espaco.xs,
    maxHeight: '88%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  nome: { fontFamily: fontes.titulo, fontSize: 18, color: cores.cream },
  jobAtual: { fontFamily: fontes.corpo, fontSize: 15, color: cores.gold1 },
  meta: { fontFamily: fontes.corpo, fontSize: 15, color: cores.muted },
  stats: { fontFamily: fontes.corpo, fontSize: 14, color: cores.muted, marginBottom: espaco.xs },
  lista: { maxHeight: 380 },
  listaInner: { gap: espaco.sm },
  secao: { fontFamily: fontes.titulo, fontSize: 11, color: cores.gold1, letterSpacing: 2, marginTop: espaco.xs },
  grid: { flexDirection: 'row', gap: espaco.sm },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  flex: { flex: 1 },
  deployBtn: { flexGrow: 1 },
  alvoBox: { backgroundColor: cores.bg, borderRadius: 3, padding: espaco.sm, gap: espaco.xs },
  alvoTxt: { fontFamily: fontes.corpo, fontSize: 15, color: cores.cream, textAlign: 'center' },
  num: { color: cores.gold1 },
  fechar: { borderWidth: 1, borderColor: cores.cardBorder, borderRadius: 3, paddingVertical: espaco.sm, alignItems: 'center', marginTop: espaco.xs },
  fecharTxt: { fontFamily: fontes.corpo, fontSize: 15, color: cores.muted },
});
