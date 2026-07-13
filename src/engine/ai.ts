/**
 * Fase da IA (doc, seção 4.4): cada facção rival age conforme seu arquétipo.
 * Reusa as mesmas ações do jogador (comprar / mover / atacar) — a IA joga com
 * as mesmas regras.
 */

import {
  CALOR_LIMIAR_BATIDA,
  CUSTO_ADVOGADO,
  CUSTO_ESPIONAGEM,
  CUSTO_RECRUTA,
} from '../data/seed';
import {
  atacarBairro,
  comprarArma,
  contratarAdvogado,
  deployarVendedor,
  espionarBairro,
  moverSoldado,
  recrutarSoldado,
  venderNoBairro,
  type ResultadoAcao,
} from './actions';
import { participaDeCombate, type Rng } from './combat';
import {
  alvosDeDeploy,
  alvosPossiveis,
  armaDe,
  bairrosDaFaccao,
  defesaEstimada,
  faccaoDe,
  forcaDeAtaque,
} from './selectors';
import { suprimentoDoBairro } from './economia';
import type { Arquetipo, GameState } from '../types/game';

interface ConfigArquetipo {
  /** Razão mínima força-de-ataque / defesa pra decidir atacar. */
  razaoAtaque: number;
  /** Caixa que a IA segura de reserva antes de comprar armas. */
  reservaCaixa: number;
  /** Peso extra ao mirar bairros do jogador (>1 = prefere o jogador). */
  pesoJogador: number;
  /** Peso extra ao mirar bairros neutros. */
  pesoNeutro: number;
  /** Tamanho de exército (soldados de pé) a partir do qual a IA para de recrutar. */
  tetoExercito: number;
}

const CONFIG: Record<Arquetipo, ConfigArquetipo> = {
  agressivo: { razaoAtaque: 1.0, reservaCaixa: 2000, pesoJogador: 1.4, pesoNeutro: 1.0, tetoExercito: 9 },
  paciente: { razaoAtaque: 1.4, reservaCaixa: 5000, pesoJogador: 0.8, pesoNeutro: 1.3, tetoExercito: 7 },
  oportunista: { razaoAtaque: 1.15, reservaCaixa: 3500, pesoJogador: 0.7, pesoNeutro: 1.5, tetoExercito: 7 },
};

/** Tenta uma compra de arma pro soldado mais fraco. Devolve estado (mutado ou não). */
function comprarSePossivel(state: GameState, faccaoId: string, cfg: ConfigArquetipo): GameState {
  const fac = faccaoDe(state, faccaoId);
  if (!fac) return state;

  const orcamento = fac.caixa - cfg.reservaCaixa;
  if (orcamento <= 0) return state;

  // Soldado que mais se beneficia de upgrade = o de arma mais fraca.
  const candidatos = fac.soldados
    .filter((s) => s.status === 'ativo' || s.status === 'ferido')
    .map((s) => ({ s, dano: armaDe(state, s.armaId)?.dano ?? 0 }))
    .sort((a, b) => a.dano - b.dano);
  if (candidatos.length === 0) return state;

  const alvo = candidatos[0];

  // Melhor arma que cabe no orçamento e é upgrade real.
  const melhor = state.armas
    .filter((a) => a.dano > alvo.dano && a.custo <= orcamento && a.cidadesDisponiveis.includes(state.cidade.id))
    .sort((a, b) => b.dano - a.dano)[0];
  if (!melhor) return state;

  const r: ResultadoAcao = comprarArma(state, faccaoId, melhor.id, alvo.s.id);
  return r.ok ? r.state : state;
}

/**
 * Recruta reforços enquanto o exército está abaixo do teto e sobra caixa acima
 * da reserva. Recruta no bairro próprio de maior valor (retaguarda produtiva).
 */
function recrutarSePossivel(
  state: GameState,
  faccaoId: string,
  cfg: ConfigArquetipo,
  rng: Rng,
): GameState {
  let atual = state;
  let guard = 0;
  while (guard++ < 3) {
    const fac = faccaoDe(atual, faccaoId);
    if (!fac) break;
    const vivos = fac.soldados.filter(participaDeCombate).length;
    if (vivos >= cfg.tetoExercito) break;
    if (fac.caixa - cfg.reservaCaixa < CUSTO_RECRUTA) break;

    const base = bairrosDaFaccao(atual, faccaoId).sort((a, b) => b.valorBase - a.valorBase)[0];
    if (!base) break;

    const r = recrutarSoldado(atual, faccaoId, base.id, rng);
    if (!r.ok) break;
    atual = r.state;
  }
  return atual;
}

/**
 * Distribui os jobs dos soldados ociosos da IA:
 *   1. Expande pra até 2 neutros de fronteira por turno (ocupa + vende).
 *   2. Fronteira com inimigo = proteger; resto = vender no bairro atual.
 * Também tenta mover vendedores pra territórios sub-supridos. Muta refs de `state`.
 */
function distribuirJobsIA(state: GameState, faccaoId: string, rng: Rng): GameState {
  let atual = state;

  // Expansão pacífica pra neutros (prioriza maior demanda). Usa soldados distintos.
  const usados = new Set<string>();
  let expansoes = 0;
  let guard = 0;
  while (expansoes < 2 && guard++ < 20) {
    const fac = faccaoDe(atual, faccaoId);
    if (!fac) break;
    const livre = fac.soldados.find((s) => participaDeCombate(s) && !usados.has(s.id));
    if (!livre) break;
    usados.add(livre.id);
    const neutro = alvosDeDeploy(atual, faccaoId)
      .filter((b) => b.dono === null)
      .sort((a, b) => b.demanda - a.demanda)[0];
    if (!neutro) break;
    const r = deployarVendedor(atual, faccaoId, livre.id, neutro.id);
    if (!r.ok) continue;
    atual = r.state;
    expansoes += 1;
  }

  // Resto: fronteira protege, demais vendem onde estão (não mexe em quem já expandiu).
  const fac = faccaoDe(atual, faccaoId);
  if (fac) {
    const proprios = new Set(bairrosDaFaccao(atual, faccaoId).map((b) => b.id));
    const fronteira = new Set(
      bairrosDaFaccao(atual, faccaoId)
        .filter((b) => b.conexoes.some((c) => !proprios.has(c)))
        .map((b) => b.id),
    );
    for (const s of fac.soldados) {
      if (!participaDeCombate(s) || usados.has(s.id)) continue;
      const bairro = bairrosDaFaccao(atual, faccaoId).find((b) => b.id === s.bairroId);
      if (!bairro) continue;
      if (fronteira.has(s.bairroId) && suprimentoDoBairro(atual, bairro) >= bairro.demanda) {
        s.jobAtual = 'proteger';
      } else {
        s.jobAtual = 'vender';
      }
      s.agiuNoTurno = true;
    }
  }
  // rng reservado pra futura variação; sem uso determinístico agora.
  void rng;
  return atual;
}

/** Contrata advogado quando o calor está no vermelho e sobra caixa acima da reserva. */
function advogadoSePossivel(state: GameState, faccaoId: string, cfg: ConfigArquetipo): GameState {
  const fac = faccaoDe(state, faccaoId);
  if (!fac) return state;
  if (fac.calor >= CALOR_LIMIAR_BATIDA && fac.caixa - cfg.reservaCaixa >= CUSTO_ADVOGADO) {
    const r = contratarAdvogado(state, faccaoId);
    if (r.ok) return r.state;
  }
  return state;
}

/** Reforça a fronteira: junta soldados ociosos no bairro que faz frente ao melhor alvo. */
function reforcar(state: GameState, faccaoId: string): GameState {
  const alvos = alvosPossiveis(state, faccaoId);
  if (alvos.length === 0) return state;

  // Bairro próprio que faz fronteira com algum alvo.
  const idsAlvos = new Set(alvos.map((a) => a.id));
  const fronteira = bairrosDaFaccao(state, faccaoId).find((b) =>
    b.conexoes.some((c) => idsAlvos.has(c)),
  );
  if (!fronteira) return state;

  let atual = state;
  const fac = faccaoDe(atual, faccaoId);
  if (!fac) return atual;

  for (const s of fac.soldados) {
    if (s.status !== 'ativo' && s.status !== 'ferido') continue;
    if (s.bairroId === fronteira.id) continue;
    // Só move se o bairro atual é vizinho da fronteira (1 passo).
    const bairro = bairrosDaFaccao(atual, faccaoId).find((b) => b.id === s.bairroId);
    if (bairro && bairro.conexoes.includes(fronteira.id)) {
      const r = moverSoldado(atual, s.id, fronteira.id);
      if (r.ok) atual = r.state;
    }
  }
  return atual;
}

/** Executa o turno completo de uma facção IA. Devolve novo estado. */
export function executarTurnoIA(state: GameState, faccaoId: string, rng: Rng = Math.random): GameState {
  const fac = faccaoDe(state, faccaoId);
  if (!fac || fac.tipo !== 'ia') return state;
  const cfg = CONFIG[fac.arquetipo ?? 'agressivo'];

  // 1. Economia: esfria o calor primeiro (sobrevivência), depois arma e recruta.
  let atual = advogadoSePossivel(state, faccaoId, cfg);
  atual = comprarSePossivel(atual, faccaoId, cfg);
  atual = recrutarSePossivel(atual, faccaoId, cfg, rng);

  // 2. Escolhe o melhor alvo (maior razão ponderada de vitória).
  const alvos = alvosPossiveis(atual, faccaoId);
  let melhorAlvo: { id: string; razao: number } | null = null;
  for (const alvo of alvos) {
    const ataque = forcaDeAtaque(atual, faccaoId, alvo.id).poder;
    if (ataque <= 0) continue;
    const defesa = Math.max(1, defesaEstimada(atual, alvo.id));
    const peso = alvo.dono === null ? cfg.pesoNeutro : cfg.pesoJogador;
    const razao = (ataque / defesa) * peso;
    if (!melhorAlvo || razao > melhorAlvo.razao) melhorAlvo = { id: alvo.id, razao };
  }

  // 3. Ataca se a razão bate o limiar; senão reforça a fronteira.
  if (melhorAlvo && melhorAlvo.razao >= cfg.razaoAtaque) {
    // Briga apertada + caixa sobrando: espiona antes pra ganhar bônus.
    const facAtual = faccaoDe(atual, faccaoId);
    if (
      facAtual &&
      melhorAlvo.razao < 1.15 &&
      facAtual.caixa - cfg.reservaCaixa >= CUSTO_ESPIONAGEM
    ) {
      const rEsp = espionarBairro(atual, faccaoId, melhorAlvo.id);
      if (rEsp.ok) atual = rEsp.state;
    }
    const r = atacarBairro(atual, faccaoId, melhorAlvo.id, rng);
    if (r.ok) atual = r.state;
  } else {
    atual = reforcar(atual, faccaoId);
  }

  // 4. Distribui os jobs dos ociosos: expande pra neutros, protege a fronteira,
  //    e põe o resto pra vender (economia da IA).
  atual = distribuirJobsIA(atual, faccaoId, rng);

  return atual;
}
