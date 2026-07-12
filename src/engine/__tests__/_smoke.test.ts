/** Smoke de integração da economia: vender acumula lucro e sobe o respeito ao longo dos turnos. */

import { resetarJobs, venderNoBairro, deployarVendedor } from '../actions';
import { aplicarEconomia } from '../economia';
import { faccaoDe, soldadosDisponiveis, bairrosDaFaccao } from '../selectors';
import { criarPartida, JOGADOR_ID, B_VILA } from '../../data/seed';
import type { GameState } from '../../types/game';

/** Põe todos os soldados livres do jogador pra vender onde estão. */
function venderTodos(s: GameState): GameState {
  let loop = 0;
  while (loop++ < 20) {
    const livres = soldadosDisponiveis(s, JOGADOR_ID);
    if (livres.length === 0) break;
    const r = venderNoBairro(s, JOGADOR_ID, livres[0].id);
    if (!r.ok) break;
    s = r.state;
  }
  return s;
}

it('smoke: vender acumula lucro e respeito ao longo dos turnos', () => {
  let s = criarPartida('normal');
  const caixaInicial = faccaoDe(s, JOGADOR_ID)!.caixa;
  for (let t = 0; t < 10; t++) {
    s = venderTodos(s);
    aplicarEconomia(s); // fecha a economia do turno (só jogador importa aqui)
    resetarJobs(s, JOGADOR_ID);
    s.turno.numero += 1;
  }
  const fac = faccaoDe(s, JOGADOR_ID)!;
  // eslint-disable-next-line no-console
  console.log(`SMOKE: caixa ${caixaInicial}→${fac.caixa} respeito=${fac.respeito}`);
  expect(fac.caixa).toBeGreaterThan(caixaInicial + 10000); // lucro real ao longo de 10 turnos
  expect(fac.respeito).toBeGreaterThan(0); // pagto médio alto → respeito sobe
});

it('smoke: ocupar neutro e vender lá também rende (após estabilizar)', () => {
  let s = criarPartida('normal');
  // Manda o Zé ocupar a Vila (neutra vizinha) e vender lá.
  s = deployarVendedor(s, JOGADOR_ID, 'p1', B_VILA).state;
  expect(bairrosDaFaccao(s, JOGADOR_ID).map((b) => b.id)).toContain(B_VILA);
  // Os outros dois vendem no Beco.
  s = venderTodos(s);
  const rel0 = (() => {
    const clone: GameState = JSON.parse(JSON.stringify(s));
    aplicarEconomia(clone);
    return clone;
  })();
  // Vila recém-ocupada rende pouco (−60%); depois de estabilizar, rende mais.
  expect(faccaoDe(rel0, JOGADOR_ID)!.caixa).toBeGreaterThan(faccaoDe(s, JOGADOR_ID)!.caixa);
});
