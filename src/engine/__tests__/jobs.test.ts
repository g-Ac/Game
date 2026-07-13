/**
 * Sistema de Jobs por soldado (estilo Respect 2): vender / sondar / proteger /
 * invadir + blindagem de personagens importantes em combate.
 */

import {
  invadirComSoldado,
  protegerBairro,
  resetarJobs,
  sondarComSoldado,
  venderNoBairro,
} from '../actions';
import { resolverCombate } from '../combat';
import { faccaoDe, soldadosDisponiveis, temIntel } from '../selectors';
import { B_BECO, B_VILA, criarPartida, JOGADOR_ID } from '../../data/seed';
import { arma, bairro, rngFixo, rngSeed, soldado } from './helpers';

function p1De(state: ReturnType<typeof criarPartida>) {
  return faccaoDe(state, JOGADOR_ID)!.soldados.find((s) => s.id === 'p1')!;
}

describe('venderNoBairro', () => {
  it('põe o soldado pra vender (job PERSISTENTE, renda no fim do turno)', () => {
    const g = criarPartida();
    const caixaAntes = faccaoDe(g, JOGADOR_ID)!.caixa;
    const r = venderNoBairro(g, JOGADOR_ID, 'p1');
    expect(r.ok).toBe(true);
    // Vender não paga na hora — só marca o job. A grana entra na economia do turno.
    expect(faccaoDe(r.state, JOGADOR_ID)!.caixa).toBe(caixaAntes);
    expect(p1De(r.state).jobAtual).toBe('vender');
  });

  it('pode reatribuir mesmo depois de já ter agido (job não é gasto)', () => {
    const g = criarPartida();
    p1De(g).agiuNoTurno = true;
    expect(venderNoBairro(g, JOGADOR_ID, 'p1').ok).toBe(true);
  });

  it('recusa vender com soldado fora de combate', () => {
    const g = criarPartida();
    p1De(g).status = 'preso';
    expect(venderNoBairro(g, JOGADOR_ID, 'p1').ok).toBe(false);
  });
});

describe('protegerBairro', () => {
  it('coloca o soldado em guarda (job proteger persistente)', () => {
    const g = criarPartida();
    const r = protegerBairro(g, JOGADOR_ID, 'p1');
    expect(r.ok).toBe(true);
    expect(p1De(r.state).jobAtual).toBe('proteger');
  });
});

describe('sondarComSoldado', () => {
  it('ganha intel sobre vizinho inimigo (ação do turno, gasta agiu)', () => {
    const g = criarPartida(); // Beco (jogador) vizinho de Vila (neutra)
    const r = sondarComSoldado(g, JOGADOR_ID, 'p1', B_VILA);
    expect(r.ok).toBe(true);
    expect(temIntel(r.state, JOGADOR_ID, B_VILA)).toBe(true);
    expect(p1De(r.state).agiuNoTurno).toBe(true);
  });

  it('recusa alvo que não é vizinho', () => {
    const g = criarPartida();
    const r = sondarComSoldado(g, JOGADOR_ID, 'p1', B_BECO); // próprio, inválido
    expect(r.ok).toBe(false);
  });
});

describe('invadirComSoldado', () => {
  it('lidera o crew do bairro, conquista o alvo e gasta o job de todos', () => {
    const g = criarPartida(); // 3 soldados no Beco invadem Vila neutra
    const r = invadirComSoldado(g, JOGADOR_ID, 'p1', B_VILA, rngSeed(1));
    expect(r.ok).toBe(true);
    const vila = r.state.cidade.bairros.find((b) => b.id === B_VILA)!;
    expect(vila.dono).toBe(JOGADOR_ID);
    // Todo o crew que embarcou gastou o job.
    const crew = faccaoDe(r.state, JOGADOR_ID)!.soldados.filter((s) => s.status !== 'morto');
    for (const s of crew) {
      if (s.bairroId === B_VILA) expect(s.agiuNoTurno).toBe(true);
    }
  });

  it('recusa se o líder já agiu', () => {
    const g = criarPartida();
    p1De(g).agiuNoTurno = true;
    const r = invadirComSoldado(g, JOGADOR_ID, 'p1', B_VILA, rngSeed(1));
    expect(r.ok).toBe(false);
  });
});

describe('resetarJobs', () => {
  it('libera as ações do turno mas MANTÉM o job persistente', () => {
    const g = criarPartida();
    for (const s of faccaoDe(g, JOGADOR_ID)!.soldados) {
      s.agiuNoTurno = true;
      s.jobAtual = 'vender';
    }
    resetarJobs(g, JOGADOR_ID);
    // Ações liberadas de novo...
    expect(soldadosDisponiveis(g, JOGADOR_ID).length).toBe(3);
    // ...mas o job continua valendo (não precisa reatribuir todo turno).
    expect(p1De(g).jobAtual).toBe('vender');
  });
});

describe('proteção de personagens importantes (combate)', () => {
  const armas = new Map([['pistola', arma()]]);
  const alvo = bairro({ id: 'b', dono: 'def', risco: 0 });

  it('blinda o importante enquanto há rank-and-file de pé', () => {
    // Atacantes fortes vencem; com rng fixo 0.5 o perdedor (defensor) toma baixa,
    // mas o importante é blindado pelo escudo (pressão reduzida) e sobrevive.
    const atacantes = [
      soldado({ id: 'a1', faccaoId: 'atk', forca: 30, armaId: 'pistola' }),
      soldado({ id: 'a2', faccaoId: 'atk', forca: 30, armaId: 'pistola' }),
    ];
    const chefe = soldado({ id: 'chefe', faccaoId: 'def', forca: 8, importante: true, patente: 'capitao' });
    const zeReles = soldado({ id: 'reles', faccaoId: 'def', forca: 8 });
    const res = resolverCombate(atacantes, [chefe, zeReles], alvo, armas, rngFixo(0.5));
    expect(res.vencedor).toBe('atacante');
    const idsCaidos = res.baixasDefensor.map((b) => b.soldadoId);
    expect(idsCaidos).toContain('reles'); // escudo leva o tiro
    expect(idsCaidos).not.toContain('chefe'); // peça-chave protegida
  });

  it('job proteger aumenta a defesa do bairro', () => {
    const def = soldado({ id: 'd', faccaoId: 'def', forca: 10, armaId: 'pistola' });
    const semGuarda = resolverCombate([], [{ ...def }], alvo, armas, rngFixo(0.5));
    const comGuarda = resolverCombate([], [{ ...def, jobAtual: 'proteger' }], alvo, armas, rngFixo(0.5));
    expect(comGuarda.forcaDefesa).toBeGreaterThan(semGuarda.forcaDefesa);
  });
});
