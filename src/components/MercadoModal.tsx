import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cores, espaco, fontes } from '../theme/tokens';
import type { MercadoItem, Veiculo } from '../types/game';

interface Props {
  visible: boolean;
  itens: MercadoItem[];
  veiculos: Veiculo[];
  caixa: number;
  onComprar: (itemId: string) => void;
  onClose: () => void;
}

const ICONE: Record<string, string> = { arma: '🔫', carro: '🚗', colete: '🦺', elite: '👤' };

/** Mercado Negro — ofertas do turno (tudo em cash). Renova a cada turno. */
export function MercadoModal({ visible, itens, veiculos, caixa, onComprar, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.bg} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.titulo}>Mercado Negro</Text>
            <Text style={styles.caixa}>${caixa.toLocaleString('pt-BR')}</Text>
          </View>
          <Text style={styles.sub}>Oferta muda a cada turno.</Text>

          {veiculos.length > 0 ? (
            <Text style={styles.garagem}>
              🚗 Garagem: {veiculos.map((v) => v.nome).join(', ')}
            </Text>
          ) : null}

          <ScrollView style={styles.lista} contentContainerStyle={styles.listaInner}>
            {itens.length === 0 ? (
              <Text style={styles.vazio}>Sem ofertas neste turno.</Text>
            ) : (
              itens.map((it) => {
                const podeComprar = caixa >= it.custo;
                return (
                  <View key={it.id} style={styles.item}>
                    <View style={styles.itemEsq}>
                      <Text style={styles.itemNome}>
                        {ICONE[it.tipo] ?? '•'} {it.nome}
                      </Text>
                      <Text style={styles.itemDesc}>{it.descricao}</Text>
                    </View>
                    <Pressable
                      onPress={() => podeComprar && onComprar(it.id)}
                      style={({ pressed }) => [
                        styles.btn,
                        !podeComprar ? styles.btnOff : null,
                        pressed && podeComprar ? styles.btnPressed : null,
                      ]}
                    >
                      <Text style={[styles.btnTxt, !podeComprar ? styles.btnTxtOff : null]}>
                        ${it.custo.toLocaleString('pt-BR')}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
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
    gap: espaco.sm,
    maxHeight: '85%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  titulo: { fontFamily: fontes.titulo, fontSize: 20, color: cores.gold1 },
  caixa: { fontFamily: fontes.corpo, fontSize: 16, color: cores.moneyLight },
  sub: { fontFamily: fontes.corpo, fontSize: 14, color: cores.mutedDim },
  garagem: { fontFamily: fontes.corpo, fontSize: 14, color: cores.cream },
  lista: { maxHeight: 340 },
  listaInner: { gap: espaco.sm },
  vazio: { fontFamily: fontes.corpo, fontSize: 15, color: cores.mutedDim, textAlign: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
    backgroundColor: cores.bg,
    borderRadius: 3,
    padding: espaco.sm,
  },
  itemEsq: { flex: 1, gap: 2 },
  itemNome: { fontFamily: fontes.corpo, fontSize: 16, color: cores.cream },
  itemDesc: { fontFamily: fontes.corpo, fontSize: 13, color: cores.muted },
  btn: {
    backgroundColor: cores.money,
    borderWidth: 2,
    borderColor: cores.moneyLight,
    borderRadius: 3,
    paddingVertical: espaco.sm,
    paddingHorizontal: espaco.md,
    minWidth: 92,
    alignItems: 'center',
  },
  btnOff: { backgroundColor: cores.cardLocked, borderColor: cores.cardBorder },
  btnPressed: { transform: [{ scale: 0.96 }] },
  btnTxt: { fontFamily: fontes.corpo, fontSize: 15, color: cores.cream },
  btnTxtOff: { color: cores.mutedDim },
  fechar: {
    borderWidth: 1,
    borderColor: cores.cardBorder,
    borderRadius: 3,
    paddingVertical: espaco.sm,
    alignItems: 'center',
  },
  fecharTxt: { fontFamily: fontes.corpo, fontSize: 15, color: cores.muted },
});
