/**
 * Economia estilo Respect 2 (puro, testável).
 *
 * Loop: cada território tem uma DEMANDA (Corre). Você posiciona vendedores; o
 * Corre deles supre a demanda e gera receita. No fim do turno, sobre os ganhos:
 *   ~55% vai pro pagamento da crew, ~25% é custo de produto, ~20% é lucro.
 * O pagamento médio por soldado decide se o RESPEITO sobe ou cai — crew grande
 * demais pra pouco território derruba o respeito (auto-regula o jogo).
 */

import type { Bairro, GameState, LinhaRelatorio, RelatorioGrana } from '../types/game';
import { participaDeCombate } from './combat';
import { bairrosDaFaccao, faccaoDe } from './selectors';

/** Caixa inicial (escala Respect). */
export const CAIXA_INICIAL = 10000;

/** Demanda (Corre necessário) por tier — índice = tier-1 ($, $$, $$$, $$$$). */
export const DEMANDA_TIER = [8, 16, 24, 32];
/** Valor ($) por unidade de Corre suprida, por tier. $$$$ paga prêmio. */
export const VALOR_POR_CORRE = [500, 625, 625, 875];

/** Fatia dos ganhos que vai pro pagamento da crew. */
export const CREW_SHARE = 0.55;
/** Fatia dos ganhos que é custo do produto. */
export const PRODUTO_SHARE = 0.25;
// lucro = 1 - CREW_SHARE - PRODUTO_SHARE = 0.20

/** Estabilidade de território recém-tomado (rende 40%). */
export const ESTABILIDADE_INICIAL = 0.4;
/** Quanto a estabilidade sobe por turno até chegar a 1.0. */
export const ESTABILIDADE_RAMPA = 0.15;

/** Pagamento médio por soldado a partir do qual o respeito sobe (abaixo, cai). */
export const PAGTO_MEDIO_LIMIAR = 1200;

/** Tier (1..4) do bairro a partir da demanda. */
export function tierDoBairro(b: Bairro): number {
  if (b.demanda >= DEMANDA_TIER[3]) return 4;
  if (b.demanda >= DEMANDA_TIER[2]) return 3;
  if (b.demanda >= DEMANDA_TIER[1]) return 2;
  return 1;
}

/** String de cifrões ($..$$$$) pra exibir o tier. */
export function cifraoDoBairro(b: Bairro): string {
  return '$'.repeat(tierDoBairro(b));
}

function valorPorCorre(b: Bairro): number {
  return VALOR_POR_CORRE[tierDoBairro(b) - 1];
}

/** Receita máxima de um bairro (demanda 100% suprida, estável). */
export function receitaMax(b: Bairro): number {
  return b.demanda * valorPorCorre(b);
}

/** Corre suprido num bairro = soma do Corre dos soldados de pé vendendo ali. */
export function suprimentoDoBairro(state: GameState, b: Bairro): number {
  if (!b.dono) return 0;
  const fac = faccaoDe(state, b.dono);
  if (!fac) return 0;
  return fac.soldados
    .filter((s) => s.bairroId === b.id && s.jobAtual === 'vender' && participaDeCombate(s))
    .reduce((acc, s) => acc + s.corre, 0);
}

/** Receita de um bairro neste turno (limitada pela demanda, escalada pela estabilidade). */
export function receitaDoBairro(state: GameState, b: Bairro): number {
  const suprido = Math.min(suprimentoDoBairro(state, b), b.demanda);
  return Math.round(suprido * valorPorCorre(b) * b.estabilidade);
}

/** Monta o relatório de grana de uma facção (sem aplicar nada ao estado). */
export function calcularRelatorio(state: GameState, faccaoId: string): RelatorioGrana {
  const bairros = bairrosDaFaccao(state, faccaoId);
  const fac = faccaoDe(state, faccaoId);
  const linhas: LinhaRelatorio[] = [];
  let ganhos = 0;
  for (const b of bairros) {
    const suprido = Math.min(suprimentoDoBairro(state, b), b.demanda);
    const receita = Math.round(suprido * valorPorCorre(b) * b.estabilidade);
    ganhos += receita;
    linhas.push({
      bairroId: b.id,
      nome: b.nome,
      demanda: b.demanda,
      suprido,
      receita,
      receitaMax: receitaMax(b),
      penalidadeNovo: Math.round((1 - b.estabilidade) * 100) / 100,
    });
  }
  const pagamentoCrew = Math.round(ganhos * CREW_SHARE);
  const custoProduto = Math.round(ganhos * PRODUTO_SHARE);
  const lucro = ganhos - pagamentoCrew - custoProduto;
  const nSold = fac ? fac.soldados.filter(participaDeCombate).length : 0;
  const pagtoMedio = nSold > 0 ? Math.round(pagamentoCrew / nSold) : 0;

  const dist = pagtoMedio - PAGTO_MEDIO_LIMIAR;
  const magnitude = Math.min(8, 1 + Math.floor(Math.abs(dist) / 400));
  const deltaRespeito = nSold === 0 ? 0 : dist >= 0 ? magnitude : -magnitude;

  return {
    turno: state.turno.numero,
    ganhos,
    pagamentoCrew,
    custoProduto,
    lucro,
    pagtoMedio,
    respeitoSubindo: deltaRespeito > 0,
    deltaRespeito,
    linhas,
  };
}

/**
 * Fecha a economia do turno pra todas as facções: paga o lucro na caixa, ajusta
 * o respeito pelo pagamento médio e estabiliza os territórios (rampa). Guarda o
 * relatório do jogador em `ultimoRelatorio` pra UI. Muta o estado (usar em clone).
 */
export function aplicarEconomia(state: GameState): void {
  for (const fac of state.faccoes) {
    const rel = calcularRelatorio(state, fac.id);
    fac.caixa += rel.lucro;
    fac.respeito = Math.max(0, fac.respeito + rel.deltaRespeito);
    if (fac.id === state.jogadorId) state.ultimoRelatorio = rel;
    // Territórios estabilizam (as vendas sobem até 100%).
    for (const b of bairrosDaFaccao(state, fac.id)) {
      b.estabilidade = Math.min(1, b.estabilidade + ESTABILIDADE_RAMPA);
    }
    // Calor decai um pouco por turno.
    fac.calor = Math.max(0, fac.calor - 3);
  }
}
