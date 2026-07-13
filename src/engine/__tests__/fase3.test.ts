/** Fase 3: névoa de guerra, deserção, stash roubável, Edge/XP e promoção. */

import { atacarBairro, promoverSoldado } from '../actions';
import { aplicarEconomia } from '../economia';
import {
  bairroDe,
  defensoresVisiveis,
  faccaoDe,
  temDefensorOculto,
} from '../selectors';
import { participaDeCombate } from '../combat';
import { B_VILA, IA_ID, criarPartida, JOGADOR_ID } from '../../data/seed';
import { rngSeed, soldado } from './helpers';
import type { GameState } from '../../types/game';

function vilaDaIA(g: GameState) {
  bairroDe(g, B_VILA)!.dono = IA_ID;
  return g;
}

describe('névoa de guerra', () => {
  it('protetor inimigo fica oculto sem intel; vendedor aparece', () => {
    const g = vilaDaIA(criarPartida());
    const ia = faccaoDe(g, IA_ID)!;
    ia.soldados.push(soldado({ id: 'guard', faccaoId: IA_ID, bairroId: B_VILA, jobAtual: 'proteger' }));
    ia.soldados.push(soldado({ id: 'seller', faccaoId: IA_ID, bairroId: B_VILA, jobAtual: 'vender' }));

    const visiveis = defensoresVisiveis(g, B_VILA, JOGADOR_ID).map((s) => s.id);
    expect(visiveis).toContain('seller');
    expect(visiveis).not.toContain('guard');
    expect(temDefensorOculto(g, B_VILA, JOGADOR_ID)).toBe(true);
  });

  it('sondar (intel) revela os protetores ocultos', () => {
    const g = vilaDaIA(criarPartida());
    faccaoDe(g, IA_ID)!.soldados.push(
      soldado({ id: 'guard', faccaoId: IA_ID, bairroId: B_VILA, jobAtual: 'proteger' }),
    );
    g.intel.push({ faccaoId: JOGADOR_ID, bairroId: B_VILA, expiraTurno: g.turno.numero });
    expect(temDefensorOculto(g, B_VILA, JOGADOR_ID)).toBe(false);
    expect(defensoresVisiveis(g, B_VILA, JOGADOR_ID).map((s) => s.id)).toContain('guard');
  });
});

describe('deserção por respeito', () => {
  it('soldado desleal abandona a gangue quando o respeito cai', () => {
    const g = criarPartida(); // ninguém vendendo → respeito caindo
    faccaoDe(g, JOGADOR_ID)!.soldados.find((s) => s.id === 'p3')!.lealdade = 2; // covarde no limite
    aplicarEconomia(g);
    expect(faccaoDe(g, JOGADOR_ID)!.soldados.find((s) => s.id === 'p3')).toBeUndefined();
    // O capitão leal (p1) segura firme.
    expect(faccaoDe(g, JOGADOR_ID)!.soldados.find((s) => s.id === 'p1')).toBeDefined();
  });
});

describe('stash roubável + Edge', () => {
  it('tomar território rival saqueia o estoque e dá XP a quem sobrevive', () => {
    const g = vilaDaIA(criarPartida());
    const ia = faccaoDe(g, IA_ID)!;
    ia.stash = 1000;
    ia.soldados.push(soldado({ id: 'wv', faccaoId: IA_ID, bairroId: B_VILA, forca: 2, armaId: null }));
    // Reforça o jogador pra garantir a conquista.
    const jogSold = faccaoDe(g, JOGADOR_ID)!.soldados;
    for (const s of jogSold) s.forca = 40;
    const caixaAntes = faccaoDe(g, JOGADOR_ID)!.caixa;

    const r = atacarBairro(g, JOGADOR_ID, B_VILA, rngSeed(1));
    expect(r.ok).toBe(true);
    expect(bairroDe(r.state, B_VILA)!.dono).toBe(JOGADOR_ID);
    // Saque: 40% do estoque da IA foi pra caixa do jogador.
    expect(faccaoDe(r.state, IA_ID)!.stash).toBe(600);
    expect(faccaoDe(r.state, JOGADOR_ID)!.caixa).toBe(caixaAntes + 400);
    // Quem sobreviveu ganhou Edge.
    const vivos = faccaoDe(r.state, JOGADOR_ID)!.soldados.filter(participaDeCombate);
    expect(vivos.some((s) => s.edge > 0)).toBe(true);
  });
});

describe('promover', () => {
  it('sobe a patente, os stats e torna o soldado importante', () => {
    const g = criarPartida();
    const r = promoverSoldado(g, JOGADOR_ID, 'p3'); // soldado → tenente, custo 5000
    expect(r.ok).toBe(true);
    const p3 = faccaoDe(r.state, JOGADOR_ID)!.soldados.find((s) => s.id === 'p3')!;
    expect(p3.patente).toBe('tenente');
    expect(p3.importante).toBe(true);
    expect(p3.forca).toBe(10); // 8 + 2
    expect(faccaoDe(r.state, JOGADOR_ID)!.caixa).toBe(10000 - 5000);
  });

  it('recusa promover o capitão (já é o topo)', () => {
    const g = criarPartida();
    expect(promoverSoldado(g, JOGADOR_ID, 'p1').ok).toBe(false); // p1 é capitão
  });
});
