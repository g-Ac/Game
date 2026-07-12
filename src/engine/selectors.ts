/**
 * Seletores puros sobre GameState. Sem mutação — só leitura e derivação.
 * Compartilhados entre UI, IA e resolução de ações.
 */

import { INTEL_BONUS_ATAQUE } from '../data/seed';
import {
  garrisonNeutro,
  INICIATIVA_ATAQUE,
  participaDeCombate,
  poderDefensivo,
  poderEfetivo,
  VANTAGEM_CASA,
} from './combat';
import type { Arma, Bairro, Faccao, GameState, Soldado } from '../types/game';

/** Soldado de pé que ainda não gastou o job deste turno. */
export function podeAgir(s: Soldado): boolean {
  return participaDeCombate(s) && !s.agiuNoTurno;
}

export function faccaoDe(state: GameState, faccaoId: string): Faccao | undefined {
  return state.faccoes.find((f) => f.id === faccaoId);
}

export function jogador(state: GameState): Faccao {
  const f = faccaoDe(state, state.jogadorId);
  if (!f) throw new Error('Facção do jogador não encontrada no estado.');
  return f;
}

export function iasDe(state: GameState): Faccao[] {
  return state.faccoes.filter((f) => f.tipo === 'ia');
}

export function bairroDe(state: GameState, bairroId: string): Bairro | undefined {
  return state.cidade.bairros.find((b) => b.id === bairroId);
}

export function armasMap(state: GameState): Map<string, Arma> {
  return new Map(state.armas.map((a) => [a.id, a]));
}

export function armaDe(state: GameState, armaId: string | null): Arma | undefined {
  if (!armaId) return undefined;
  return state.armas.find((a) => a.id === armaId);
}

export function bairrosDaFaccao(state: GameState, faccaoId: string): Bairro[] {
  return state.cidade.bairros.filter((b) => b.dono === faccaoId);
}

/** Soldados de uma facção que estão num bairro específico. */
export function soldadosNoBairro(state: GameState, faccaoId: string, bairroId: string): Soldado[] {
  const f = faccaoDe(state, faccaoId);
  if (!f) return [];
  return f.soldados.filter((s) => s.bairroId === bairroId);
}

/** Todos os soldados de pé (ativo/ferido) posicionados num bairro, de qualquer facção. */
export function defensoresDoBairro(state: GameState, bairroId: string): Soldado[] {
  const b = bairroDe(state, bairroId);
  if (!b || !b.dono) return [];
  return soldadosNoBairro(state, b.dono, bairroId).filter(participaDeCombate);
}

/**
 * Força de ataque que `faccaoId` consegue projetar sobre `alvoId`: soma do poder
 * dos soldados de pé em bairros próprios adjacentes ao alvo.
 */
export function forcaDeAtaque(state: GameState, faccaoId: string, alvoId: string): {
  atacantes: Soldado[];
  poder: number;
} {
  const alvo = bairroDe(state, alvoId);
  const armas = armasMap(state);
  if (!alvo) return { atacantes: [], poder: 0 };

  const f = faccaoDe(state, faccaoId);
  if (!f) return { atacantes: [], poder: 0 };

  const bairrosProprios = new Set(bairrosDaFaccao(state, faccaoId).map((b) => b.id));
  const atacantes = f.soldados.filter(
    (s) =>
      participaDeCombate(s) &&
      bairrosProprios.has(s.bairroId) &&
      alvo.conexoes.includes(s.bairroId),
  );
  const poder = atacantes.reduce(
    (acc, s) => acc + poderEfetivo(s, s.armaId ? armas.get(s.armaId) : undefined),
    0,
  );
  return { atacantes, poder };
}

/** Soldados de uma facção que ainda podem receber um job neste turno. */
export function soldadosDisponiveis(state: GameState, faccaoId: string): Soldado[] {
  const f = faccaoDe(state, faccaoId);
  if (!f) return [];
  return f.soldados.filter(podeAgir);
}

/**
 * Força de ataque projetada a partir de UM bairro de origem (crew local que
 * ainda não agiu) sobre um alvo adjacente. É a base do job "Invadir" por soldado.
 */
export function forcaDeAtaqueDoBairro(
  state: GameState,
  faccaoId: string,
  origemId: string,
  alvoId: string,
): { atacantes: Soldado[]; poder: number } {
  const origem = bairroDe(state, origemId);
  const alvo = bairroDe(state, alvoId);
  const f = faccaoDe(state, faccaoId);
  if (!origem || !alvo || !f) return { atacantes: [], poder: 0 };
  if (origem.dono !== faccaoId || !origem.conexoes.includes(alvoId)) {
    return { atacantes: [], poder: 0 };
  }
  const armas = armasMap(state);
  // O crew que embarca no assalto: quem está nesse bairro e ainda não agiu.
  const atacantes = f.soldados.filter((s) => s.bairroId === origemId && podeAgir(s));
  const poder = atacantes.reduce((acc, s) => acc + poderEfetivo(s, armas.get(s.armaId ?? '')), 0);
  return { atacantes, poder };
}

/** Ataque estimado de um assalto liderado a partir de `origemId` (iniciativa + intel). */
export function ataqueDoBairroEstimado(
  state: GameState,
  faccaoId: string,
  origemId: string,
  alvoId: string,
): number {
  const bonusIntel = temIntel(state, faccaoId, alvoId) ? INTEL_BONUS_ATAQUE : 1;
  const poder = forcaDeAtaqueDoBairro(state, faccaoId, origemId, alvoId).poder;
  return Math.round(poder * INICIATIVA_ATAQUE * bonusIntel);
}

/** Bairros inimigos/neutros adjacentes ao bairro atual do soldado (alvos de invadir/sondar). */
export function alvosDeSoldado(state: GameState, soldado: Soldado): Bairro[] {
  const atual = bairroDe(state, soldado.bairroId);
  if (!atual || atual.dono !== soldado.faccaoId) return [];
  return atual.conexoes
    .map((id) => bairroDe(state, id))
    .filter((b): b is Bairro => !!b && b.dono !== soldado.faccaoId);
}

/** Há intel de espionagem ativo de `faccaoId` sobre `alvoId` neste turno? */
export function temIntel(state: GameState, faccaoId: string, alvoId: string): boolean {
  return state.intel.some(
    (m) =>
      m.faccaoId === faccaoId &&
      m.bairroId === alvoId &&
      m.expiraTurno >= state.turno.numero,
  );
}

/** Ataque estimado (iniciativa + intel, se houver) pra exibir no preview de combate. */
export function ataqueEstimado(state: GameState, faccaoId: string, alvoId: string): number {
  const bonusIntel = temIntel(state, faccaoId, alvoId) ? INTEL_BONUS_ATAQUE : 1;
  return Math.round(forcaDeAtaque(state, faccaoId, alvoId).poder * INICIATIVA_ATAQUE * bonusIntel);
}

/** Defesa estimada de um bairro (soma do poder dos defensores + guarnição neutra). */
export function defesaEstimada(state: GameState, alvoId: string): number {
  const alvo = bairroDe(state, alvoId);
  if (!alvo) return 0;
  const armas = armasMap(state);
  const defensores = defensoresDoBairro(state, alvoId);
  const somaDefesa = defensores.reduce(
    (acc, s) => acc + poderDefensivo(s, s.armaId ? armas.get(s.armaId) : undefined),
    0,
  );
  const garrison = defensores.length === 0 ? garrisonNeutro(alvo.risco) : 0;
  return Math.round(somaDefesa * VANTAGEM_CASA + garrison);
}

/** Bairros que `faccaoId` pode atacar (adjacentes a território próprio, não próprios). */
export function alvosPossiveis(state: GameState, faccaoId: string): Bairro[] {
  const proprios = bairrosDaFaccao(state, faccaoId);
  const idsProprios = new Set(proprios.map((b) => b.id));
  const alvos = new Map<string, Bairro>();
  for (const b of proprios) {
    for (const vizinhoId of b.conexoes) {
      if (idsProprios.has(vizinhoId)) continue;
      const vizinho = bairroDe(state, vizinhoId);
      if (vizinho) alvos.set(vizinho.id, vizinho);
    }
  }
  return [...alvos.values()];
}

/**
 * Destinos de realocação de um soldado: QUALQUER bairro próprio (logística livre
 * dentro do território, estilo Respect), menos o atual.
 */
export function destinosDeMovimento(state: GameState, soldado: Soldado): Bairro[] {
  return bairrosDaFaccao(state, soldado.faccaoId).filter((b) => b.id !== soldado.bairroId);
}

/**
 * Bairros onde a facção pode pôr um vendedor (deploy): os próprios + os neutros
 * que fazem fronteira com o território (ocupação pacífica). Rival exige combate.
 */
export function alvosDeDeploy(state: GameState, faccaoId: string): Bairro[] {
  const proprios = bairrosDaFaccao(state, faccaoId);
  const idsProprios = new Set(proprios.map((b) => b.id));
  const alvos = new Map<string, Bairro>();
  for (const b of proprios) alvos.set(b.id, b);
  for (const b of proprios) {
    for (const vizinhoId of b.conexoes) {
      if (idsProprios.has(vizinhoId)) continue;
      const vizinho = bairroDe(state, vizinhoId);
      if (vizinho && vizinho.dono === null) alvos.set(vizinho.id, vizinho);
    }
  }
  return [...alvos.values()];
}
