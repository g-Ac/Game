/** Economia estilo Respect: demanda × Corre, relatório de grana e deploy/ocupação. */

import { deployarVendedor } from '../actions';
import {
  aplicarEconomia,
  calcularRelatorio,
  receitaDoBairro,
  suprimentoDoBairro,
  VALOR_POR_CORRE,
} from '../economia';
import { bairroDe, faccaoDe } from '../selectors';
import { B_BECO, B_MORRO, B_VILA, criarPartida, JOGADOR_ID } from '../../data/seed';

/** Põe os 3 soldados do jogador vendendo no Beco. */
function comVendedoresNoBeco(g: ReturnType<typeof criarPartida>) {
  for (const s of faccaoDe(g, JOGADOR_ID)!.soldados) s.jobAtual = 'vender';
  return g;
}

describe('suprimento e receita', () => {
  it('soma o Corre dos vendedores e limita pela demanda', () => {
    const g = comVendedoresNoBeco(criarPartida());
    const beco = bairroDe(g, B_BECO)!; // demanda 16
    expect(suprimentoDoBairro(g, beco)).toBe(6 + 5 + 4); // 15
    // receita = min(15,16) * valor/tier($$=625) * estabilidade(1)
    expect(receitaDoBairro(g, beco)).toBe(15 * VALOR_POR_CORRE[1]);
  });

  it('território novo (estabilidade 0.4) rende ~40%', () => {
    const g = comVendedoresNoBeco(criarPartida());
    const beco = bairroDe(g, B_BECO)!;
    const cheio = receitaDoBairro(g, beco);
    beco.estabilidade = 0.4;
    expect(receitaDoBairro(g, beco)).toBe(Math.round(cheio * 0.4));
  });

  it('sem ninguém vendendo, receita zero', () => {
    const g = criarPartida();
    expect(receitaDoBairro(g, bairroDe(g, B_BECO)!)).toBe(0);
  });
});

describe('calcularRelatorio', () => {
  it('divide os ganhos em crew (55%), produto (25%) e lucro (20%)', () => {
    const g = comVendedoresNoBeco(criarPartida());
    const rel = calcularRelatorio(g, JOGADOR_ID);
    expect(rel.ganhos).toBe(15 * VALOR_POR_CORRE[1]); // 9375
    expect(rel.pagamentoCrew).toBe(Math.round(rel.ganhos * 0.55));
    expect(rel.custoProduto).toBe(Math.round(rel.ganhos * 0.25));
    expect(rel.lucro).toBe(rel.ganhos - rel.pagamentoCrew - rel.custoProduto);
  });

  it('pagamento médio alto faz o respeito subir', () => {
    const g = comVendedoresNoBeco(criarPartida());
    const rel = calcularRelatorio(g, JOGADOR_ID);
    expect(rel.pagtoMedio).toBeGreaterThan(1200);
    expect(rel.respeitoSubindo).toBe(true);
    expect(rel.deltaRespeito).toBeGreaterThan(0);
  });

  it('crew grande e pouca venda derruba o respeito', () => {
    const g = criarPartida(); // ninguém vendendo → ganhos 0
    const rel = calcularRelatorio(g, JOGADOR_ID);
    expect(rel.pagtoMedio).toBe(0);
    expect(rel.deltaRespeito).toBeLessThan(0);
  });
});

describe('aplicarEconomia', () => {
  it('credita o lucro na caixa e estabiliza os territórios', () => {
    const g = comVendedoresNoBeco(criarPartida());
    bairroDe(g, B_BECO)!.estabilidade = 0.4;
    const caixaAntes = faccaoDe(g, JOGADOR_ID)!.caixa;
    const rel = calcularRelatorio(g, JOGADOR_ID);
    aplicarEconomia(g);
    expect(faccaoDe(g, JOGADOR_ID)!.caixa).toBe(caixaAntes + rel.lucro);
    expect(bairroDe(g, B_BECO)!.estabilidade).toBeCloseTo(0.55, 5);
    expect(g.ultimoRelatorio).not.toBeNull();
  });
});

describe('deployarVendedor', () => {
  it('ocupa neutro de fronteira, marca vender e começa instável', () => {
    const g = criarPartida();
    const r = deployarVendedor(g, JOGADOR_ID, 'p1', B_VILA); // Vila é neutra e vizinha de Beco
    expect(r.ok).toBe(true);
    const vila = bairroDe(r.state, B_VILA)!;
    expect(vila.dono).toBe(JOGADOR_ID);
    expect(vila.estabilidade).toBeCloseTo(0.4, 5);
    const p1 = faccaoDe(r.state, JOGADOR_ID)!.soldados.find((s) => s.id === 'p1')!;
    expect(p1.bairroId).toBe(B_VILA);
    expect(p1.jobAtual).toBe('vender'); // job persistente — segue vendendo lá
  });

  it('recusa território rival (precisa invadir)', () => {
    const g = criarPartida();
    expect(deployarVendedor(g, JOGADOR_ID, 'p1', B_MORRO).ok).toBe(false);
  });

  it('recusa neutro fora da fronteira', () => {
    const g = criarPartida();
    // 'palafita' é neutro no miolo, não faz divisa com o Beco inicial.
    expect(deployarVendedor(g, JOGADOR_ID, 'p1', 'palafita').ok).toBe(false);
  });
});
