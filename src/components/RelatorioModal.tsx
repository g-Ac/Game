import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cores, espaco, fontes } from '../theme/tokens';
import { dinheiro } from '../util/format';
import type { RelatorioGrana } from '../types/game';

interface Props {
  relatorio: RelatorioGrana | null;
  onFechar: () => void;
}

/** "Relatório de Grana" — fecha o turno mostrando ganhos, custos, lucro e respeito. */
export function RelatorioModal({ relatorio, onFechar }: Props) {
  if (!relatorio) return null;
  const r = relatorio;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable style={styles.bg} onPress={onFechar}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.titulo}>Relatório de Grana</Text>
          <View style={styles.linhas}>
            <Row rotulo="Ganhos" valor={`$${dinheiro(r.ganhos)}`} cor={cores.cream} />
            <Row rotulo="Pagamento Crew" valor={`-$${dinheiro(r.pagamentoCrew)}`} cor={cores.danger} />
            <Row rotulo="Custo Produto" valor={`-$${dinheiro(r.custoProduto)}`} cor={cores.danger} />
            <View style={styles.sep} />
            <Row rotulo="Lucro" valor={`$${dinheiro(r.lucro)}`} cor={cores.moneyLight} negrito />
          </View>

          <View style={[styles.respeitoBox, { backgroundColor: r.respeitoSubindo ? '#14351a' : '#3a1414' }]}>
            <Text style={styles.pagtoMedio}>Pagto médio/soldado: ${dinheiro(r.pagtoMedio)}</Text>
            <Text style={[styles.respeitoTxt, { color: r.respeitoSubindo ? cores.moneyLight : cores.danger }]}>
              {r.respeitoSubindo
                ? `Respeito subindo (+${r.deltaRespeito}) 🟢`
                : r.deltaRespeito < 0
                  ? `Respeito caindo (${r.deltaRespeito}) 🔴`
                  : 'Sem crew — sem respeito.'}
            </Text>
          </View>

          {r.linhas.length > 0 ? (
            <ScrollView style={styles.detalhe} contentContainerStyle={styles.detalheInner}>
              {r.linhas.map((l) => (
                <View key={l.bairroId} style={styles.terrLinha}>
                  <Text style={styles.terrNome} numberOfLines={1}>
                    {l.nome}
                  </Text>
                  <Text style={styles.terrDados}>
                    ${dinheiro(l.receita)} · corre {l.suprido}/{l.demanda}
                    {l.penalidadeNovo > 0 ? `  novo -${Math.round(l.penalidadeNovo * 100)}%` : ''}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.semVenda}>Ninguém vendendo. Ponha vendedores nos territórios!</Text>
          )}

          <Pressable style={styles.btn} onPress={onFechar}>
            <Text style={styles.btnTxt}>Próximo ▶</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ rotulo, valor, cor, negrito }: { rotulo: string; valor: string; cor: string; negrito?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowRotulo, negrito ? styles.negrito : null]}>{rotulo}:</Text>
      <Text style={[styles.rowValor, { color: cor }, negrito ? styles.negrito : null]}>{valor}</Text>
    </View>
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
    gap: espaco.md,
    maxHeight: '85%',
  },
  titulo: { fontFamily: fontes.titulo, fontSize: 20, color: cores.gold1 },
  linhas: { gap: espaco.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowRotulo: { fontFamily: fontes.corpo, fontSize: 16, color: cores.cream },
  rowValor: { fontFamily: fontes.corpo, fontSize: 16 },
  negrito: { fontFamily: fontes.titulo, fontSize: 15 },
  sep: { height: 1, backgroundColor: cores.cardBorder, marginVertical: 2 },
  respeitoBox: { borderRadius: 3, padding: espaco.sm, gap: 2 },
  pagtoMedio: { fontFamily: fontes.corpo, fontSize: 14, color: cores.cream },
  respeitoTxt: { fontFamily: fontes.corpo, fontSize: 15 },
  detalhe: { maxHeight: 180 },
  detalheInner: { gap: espaco.xs },
  terrLinha: { flexDirection: 'row', justifyContent: 'space-between', gap: espaco.sm },
  terrNome: { fontFamily: fontes.corpo, fontSize: 15, color: cores.cream, flexShrink: 1 },
  terrDados: { fontFamily: fontes.corpo, fontSize: 13, color: cores.muted },
  semVenda: { fontFamily: fontes.corpo, fontSize: 15, color: cores.mutedDim, textAlign: 'center' },
  btn: {
    backgroundColor: cores.money,
    borderWidth: 2,
    borderColor: cores.moneyLight,
    borderRadius: 3,
    paddingVertical: espaco.md,
    alignItems: 'center',
  },
  btnTxt: { fontFamily: fontes.titulo, fontSize: 15, color: cores.cream },
});
