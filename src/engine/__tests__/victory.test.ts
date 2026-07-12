import { avaliarStatus } from '../victory';
import { bairrosDaFaccao, faccaoDe } from '../selectors';
import { criarPartida, JOGADOR_ID, IA_ID } from '../../data/seed';

describe('avaliarStatus', () => {
  it('em andamento na partida inicial', () => {
    expect(avaliarStatus(criarPartida())).toBe('em_andamento');
  });

  it('vitória quando o jogador domina todos os bairros', () => {
    const g = criarPartida();
    for (const b of g.cidade.bairros) b.dono = JOGADOR_ID;
    expect(avaliarStatus(g)).toBe('vitoria');
  });

  it('derrota quando o jogador perde todo o território', () => {
    const g = criarPartida();
    for (const b of bairrosDaFaccao(g, JOGADOR_ID)) b.dono = IA_ID;
    for (const s of faccaoDe(g, JOGADOR_ID)!.soldados) s.status = 'morto';
    expect(avaliarStatus(g)).toBe('derrota');
  });

  it('derrota mesmo com tropas de pé, se não há território (encalhado = xeque-mate)', () => {
    const g = criarPartida();
    for (const b of bairrosDaFaccao(g, JOGADOR_ID)) b.dono = IA_ID;
    // Soldados seguem ativos, mas sem bairro próprio não dá pra recrutar/atacar.
    expect(avaliarStatus(g)).toBe('derrota');
  });
});
