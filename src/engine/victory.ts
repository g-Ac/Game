/**
 * Checagem de vitória/derrota (doc, seção 4.5): dominar todos os bairros vence;
 * perder todo território (sem tropas de pé pra revidar) perde.
 */

import { bairrosDaFaccao } from './selectors';
import type { GameState, StatusPartida } from '../types/game';

export function avaliarStatus(state: GameState): StatusPartida {
  const totalBairros = state.cidade.bairros.length;
  const doJogador = bairrosDaFaccao(state, state.jogadorId).length;

  if (doJogador === totalBairros) return 'vitoria';

  // Sem território é xeque-mate: sem bairro próprio não dá pra recrutar, produzir
  // nem atacar (assalto sai de bairro seu). Tropas encalhadas em terra inimiga não
  // revertem o jogo — é derrota, mesmo que ainda estejam de pé.
  if (doJogador === 0) return 'derrota';

  return 'em_andamento';
}
