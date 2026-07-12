/** Mercado Negro, drive-by, colete e vitória por eliminação. */

import { comprarMercado, driveBy } from '../actions';
import { resolverDriveBy } from '../combat';
import { gerarMercado } from '../mercado';
import { avaliarStatus } from '../victory';
import { faccaoDe, bairroDe } from '../selectors';
import { participaDeCombate } from '../combat';
import { B_BECO, B_MORRO, B_VILA, IA_ID, criarPartida, JOGADOR_ID } from '../../data/seed';
import { arma, bairro, rngFixo, soldado } from './helpers';
import type { GameState, Veiculo } from '../../types/game';

const CARRO: Veiculo = { id: 'c', nome: 'Test', lugares: 4, velocidade: 3, blindagem: 3 };

function comCarro(g: GameState): GameState {
  faccaoDe(g, JOGADOR_ID)!.veiculos.push({ ...CARRO });
  return g;
}
/** Torna a Vila um território rival (com um defensor) pra testar ataques a partir do Beco. */
function vilaRival(g: GameState): GameState {
  bairroDe(g, B_VILA)!.dono = IA_ID;
  faccaoDe(g, IA_ID)!.soldados.push(
    soldado({ id: 'd1', faccaoId: IA_ID, bairroId: B_VILA, forca: 6, armaId: null }),
  );
  return g;
}

describe('gerarMercado', () => {
  it('gera oferta de rua + carro + colete + (elite|lote)', () => {
    const itens = gerarMercado(2, rngFixo(0.5));
    expect(itens.length).toBe(4);
    expect(itens.map((i) => i.tipo)).toEqual(expect.arrayContaining(['arma', 'carro', 'colete']));
  });
});

describe('comprarMercado', () => {
  it('compra carro: entra na garagem e desconta a caixa', () => {
    const g = criarPartida();
    faccaoDe(g, JOGADOR_ID)!.caixa = 30000; // cobre qualquer carro sorteado
    const carroItem = g.mercado.find((m) => m.tipo === 'carro')!;
    const caixa = faccaoDe(g, JOGADOR_ID)!.caixa;
    const r = comprarMercado(g, JOGADOR_ID, carroItem.id);
    expect(r.ok).toBe(true);
    expect(faccaoDe(r.state, JOGADOR_ID)!.veiculos.length).toBe(1);
    expect(faccaoDe(r.state, JOGADOR_ID)!.caixa).toBe(caixa - carroItem.custo);
    // Oferta sai do mercado após comprar.
    expect(r.state.mercado.find((m) => m.id === carroItem.id)).toBeUndefined();
  });

  it('compra colete: equipa o mais forte sem colete', () => {
    const g = criarPartida();
    const coleteItem = g.mercado.find((m) => m.tipo === 'colete')!;
    const r = comprarMercado(g, JOGADOR_ID, coleteItem.id);
    expect(r.ok).toBe(true);
    expect(faccaoDe(r.state, JOGADOR_ID)!.soldados.some((s) => s.colete)).toBe(true);
  });

  it('recusa quando falta caixa', () => {
    const g = criarPartida();
    faccaoDe(g, JOGADOR_ID)!.caixa = 100;
    const item = g.mercado[0];
    expect(comprarMercado(g, JOGADOR_ID, item.id).ok).toBe(false);
  });
});

describe('driveBy', () => {
  it('recusa sem carro na garagem', () => {
    const g = vilaRival(criarPartida());
    expect(driveBy(g, JOGADOR_ID, 'p1', B_VILA).ok).toBe(false);
  });

  it('com carro: fere defensores mas NÃO toma o território', () => {
    const g = comCarro(vilaRival(criarPartida()));
    const r = driveBy(g, JOGADOR_ID, 'p1', B_VILA, rngFixo(0.1));
    expect(r.ok).toBe(true);
    // Bate e corre: a Vila continua rival.
    expect(bairroDe(r.state, B_VILA)!.dono).toBe(IA_ID);
    // O crew gastou o job.
    expect(faccaoDe(r.state, JOGADOR_ID)!.soldados.find((s) => s.id === 'p1')!.agiuNoTurno).toBe(true);
  });

  it('recusa alvo neutro (drive-by é contra rival)', () => {
    const g = comCarro(criarPartida()); // Vila neutra
    expect(driveBy(g, JOGADOR_ID, 'p1', B_VILA).ok).toBe(false);
  });
});

describe('colete em combate', () => {
  it('reduz as baixas do soldado', () => {
    const armas = new Map([['pistola', arma()]]);
    const alvo = bairro({ id: 'b', dono: 'def', risco: 0 });
    const atacantes = [
      soldado({ id: 'a1', faccaoId: 'atk', forca: 30, armaId: 'pistola' }),
      soldado({ id: 'a2', faccaoId: 'atk', forca: 30, armaId: 'pistola' }),
    ];
    // Dois defensores idênticos; um com colete. Sob pressão fixa, o sem colete cai mais.
    const semColete = soldado({ id: 'nu', faccaoId: 'def', forca: 8 });
    const comColete = soldado({ id: 'kevlar', faccaoId: 'def', forca: 8, colete: true });
    // rng 0.6: pressão do alvo ~0.85 (nu cai); com colete cai pra ~0.51 (kevlar segura).
    const res = resolverDriveBy(atacantes, [semColete, comColete], alvo, CARRO, armas, rngFixo(0.6));
    const caiu = (id: string) => res.baixasDefensor.some((b) => b.soldadoId === id);
    expect(caiu('nu')).toBe(true);
    expect(caiu('kevlar')).toBe(false);
  });
});

describe('vitória por eliminação', () => {
  it('vence se a gangue rival fica sem território e sem tropa', () => {
    const g = criarPartida();
    bairroDe(g, B_MORRO)!.dono = null; // IA perde o único território
    for (const s of faccaoDe(g, IA_ID)!.soldados) s.status = 'morto';
    expect(faccaoDe(g, IA_ID)!.soldados.some(participaDeCombate)).toBe(false);
    expect(avaliarStatus(g)).toBe('vitoria');
  });
});
