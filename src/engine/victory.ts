/**
 * Checagem de vitória/derrota (doc, seção 4.5): dominar todos os bairros vence;
 * perder todo território (sem tropas de pé pra revidar) perde.
 */

import { participaDeCombate } from './combat';
import { bairrosDaFaccao, iasDe } from './selectors';
import type { GameState, StatusPartida } from '../types/game';

/** Uma gangue rival está eliminada quando não tem território nem tropa de pé. */
function iaEliminada(state: GameState, iaId: string): boolean {
  const semTerritorio = bairrosDaFaccao(state, iaId).length === 0;
  const fac = state.faccoes.find((f) => f.id === iaId);
  const semTropa = !fac || !fac.soldados.some(participaDeCombate);
  return semTerritorio && semTropa;
}

export function avaliarStatus(state: GameState): StatusPartida {
  const totalBairros = state.cidade.bairros.length;
  const doJogador = bairrosDaFaccao(state, state.jogadorId).length;

  // Vitória: dominar tudo OU eliminar todas as gangues rivais.
  if (doJogador === totalBairros) return 'vitoria';
  const rivais = iasDe(state);
  if (rivais.length > 0 && rivais.every((ia) => iaEliminada(state, ia.id))) return 'vitoria';

  // Sem território é xeque-mate: sem bairro próprio não dá pra recrutar, produzir
  // nem atacar (assalto sai de bairro seu). Tropas encalhadas em terra inimiga não
  // revertem o jogo — é derrota, mesmo que ainda estejam de pé.
  if (doJogador === 0) return 'derrota';

  return 'em_andamento';
}
