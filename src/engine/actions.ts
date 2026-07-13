/**
 * Ações mutadoras da partida. Cada função clona o estado, aplica a mudança e
 * devolve um novo GameState — nunca muta o argumento. Reusadas pelo jogador
 * (via store) e pela IA.
 */

import {
  ADVOGADO_REDUZ_CALOR,
  BATIDA_ESFRIA_CALOR,
  CALOR_LIMIAR_BATIDA,
  CUSTO_ADVOGADO,
  CUSTO_ESPIONAGEM,
  CUSTO_RECRUTA,
  ESPIONAGEM_CALOR,
  INTEL_BONUS_ATAQUE,
  INTEL_DURACAO,
  NOMES_RECRUTA,
  TRACOS,
} from '../data/seed';
import { ESTABILIDADE_INICIAL } from './economia';
import { participaDeCombate, resolverCombate, resolverDriveBy, type Baixa, type Rng } from './combat';
import {
  alvosPossiveis,
  armaDe,
  armasMap,
  bairroDe,
  bairrosDaFaccao,
  defensoresDoBairro,
  destinosDeMovimento,
  faccaoDe,
  forcaDeAtaque,
  forcaDeAtaqueDoBairro,
  podeAgir,
  temIntel,
} from './selectors';
import type { GameState, LogTipo, Soldado } from '../types/game';

export interface ResultadoAcao {
  state: GameState;
  ok: boolean;
  mensagem: string;
}

/** Clone profundo — GameState é puro JSON, então isto é seguro e barato (estado pequeno). */
export function clonar(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

export function addLog(state: GameState, tipo: LogTipo, texto: string): void {
  state.log.push({ id: state.logSeq, turno: state.turno.numero, tipo, texto });
  state.logSeq += 1;
  // Mantém o log enxuto (últimos 60 eventos) — Expo Go / device com pouca RAM.
  if (state.log.length > 60) state.log = state.log.slice(-60);
}

function encontrarSoldado(state: GameState, soldadoId: string): Soldado | undefined {
  for (const f of state.faccoes) {
    const s = f.soldados.find((x) => x.id === soldadoId);
    if (s) return s;
  }
  return undefined;
}

function aplicarBaixas(state: GameState, baixas: Baixa[]): void {
  for (const b of baixas) {
    const s = encontrarSoldado(state, b.soldadoId);
    if (s) s.status = b.status;
  }
}

/** Teto de Edge (experiência de combate). */
const MAX_EDGE = 8;

/** Quem lutou e ficou de pé ganha +1 de Edge (experiência de combate). */
function ganharEdge(soldados: Soldado[]): void {
  for (const s of soldados) {
    if ((s.status === 'ativo' || s.status === 'ferido') && s.edge < MAX_EDGE) s.edge += 1;
  }
}

/** Move um soldado pra um bairro próprio adjacente. */
export function moverSoldado(
  state: GameState,
  soldadoId: string,
  destinoId: string,
): ResultadoAcao {
  const novo = clonar(state);
  const s = encontrarSoldado(novo, soldadoId);
  if (!s) return { state, ok: false, mensagem: 'Soldado não encontrado.' };
  if (s.status !== 'ativo' && s.status !== 'ferido') {
    return { state, ok: false, mensagem: `${s.nome} não pode se mover (${s.status}).` };
  }
  if (s.agiuNoTurno) {
    return { state, ok: false, mensagem: `${s.nome} já agiu neste turno.` };
  }
  const destinos = destinosDeMovimento(novo, s);
  const destino = destinos.find((b) => b.id === destinoId);
  if (!destino) {
    return { state, ok: false, mensagem: 'Destino inválido (precisa ser bairro seu e vizinho).' };
  }
  const origem = bairroDe(novo, s.bairroId);
  s.bairroId = destinoId;
  s.agiuNoTurno = true;
  s.jobAtual = 'mover';
  addLog(novo, 'info', `${s.nome} moveu de ${origem?.nome ?? '?'} pra ${destino.nome}.`);
  return { state: novo, ok: true, mensagem: `${s.nome} → ${destino.nome}` };
}

/** Compra e equipa uma arma num soldado da facção. */
export function comprarArma(
  state: GameState,
  faccaoId: string,
  armaId: string,
  soldadoId: string,
): ResultadoAcao {
  const novo = clonar(state);
  const fac = faccaoDe(novo, faccaoId);
  const arma = armaDe(novo, armaId);
  const s = encontrarSoldado(novo, soldadoId);
  if (!fac) return { state, ok: false, mensagem: 'Facção inválida.' };
  if (!arma) return { state, ok: false, mensagem: 'Arma inválida.' };
  if (!s || s.faccaoId !== faccaoId) {
    return { state, ok: false, mensagem: 'Soldado inválido pra essa facção.' };
  }
  if (s.status === 'morto' || s.status === 'preso') {
    return { state, ok: false, mensagem: `${s.nome} não pode ser armado (${s.status}).` };
  }
  if (!arma.cidadesDisponiveis.includes(novo.cidade.id)) {
    return { state, ok: false, mensagem: `${arma.nome} não está disponível aqui.` };
  }
  if (s.armaId === armaId) {
    return { state, ok: false, mensagem: `${s.nome} já usa ${arma.nome}.` };
  }
  if (fac.caixa < arma.custo) {
    return { state, ok: false, mensagem: `Caixa insuficiente pra ${arma.nome} ($${arma.custo}).` };
  }
  fac.caixa -= arma.custo;
  s.armaId = armaId;
  addLog(novo, 'info', `${fac.nome} armou ${s.nome} com ${arma.nome} (-$${arma.custo}).`);
  return { state: novo, ok: true, mensagem: `${s.nome} equipou ${arma.nome}.` };
}

/**
 * Recruta um soldado novo num bairro próprio (economia in-match). Não gasta ação,
 * só caixa — é o motor de snowball que resolve o empate estrutural: quem controla
 * mais território arrecada mais e forma exército maior.
 */
export function recrutarSoldado(
  state: GameState,
  faccaoId: string,
  bairroId: string,
  rng: Rng = Math.random,
): ResultadoAcao {
  const novo = clonar(state);
  const fac = faccaoDe(novo, faccaoId);
  const bairro = bairroDe(novo, bairroId);
  if (!fac) return { state, ok: false, mensagem: 'Facção inválida.' };
  if (!bairro || bairro.dono !== faccaoId) {
    return { state, ok: false, mensagem: 'Só dá pra recrutar em bairro seu.' };
  }
  if (fac.caixa < CUSTO_RECRUTA) {
    return { state, ok: false, mensagem: `Caixa insuficiente pra recrutar ($${CUSTO_RECRUTA}).` };
  }

  const seq = novo.recrutaSeq;
  novo.recrutaSeq += 1;
  const nome = NOMES_RECRUTA[Math.floor(rng() * NOMES_RECRUTA.length)] ?? `Recruta ${seq}`;
  const traco = TRACOS[Math.floor(rng() * TRACOS.length)] ?? 'ganancioso';
  const forca = 7 + Math.floor(rng() * 5); // 7-11
  const corre = 3 + Math.floor(rng() * 5); // 3-7

  fac.caixa -= CUSTO_RECRUTA;
  fac.soldados.push({
    id: `${faccaoId}-r${seq}`,
    nome,
    lealdade: 60,
    traco,
    forca,
    edge: 0,
    corre,
    armaId: 'faca',
    colete: false,
    status: 'ativo',
    faccaoId,
    bairroId,
    patente: 'soldado',
    importante: false,
    mortes: 0,
    jobAtual: null,
    // Recém-chegado: entra em serviço só no próximo turno (não invade no mesmo).
    agiuNoTurno: true,
  });
  addLog(novo, 'info', `${fac.nome} recrutou ${nome} (fç ${forca}, corre ${corre}) em ${bairro.nome} (-$${CUSTO_RECRUTA}).`);
  return { state: novo, ok: true, mensagem: `Recrutou ${nome} em ${bairro.nome}.` };
}

/**
 * Núcleo da resolução de um assalto: dado um conjunto de `atacantes` já
 * selecionado (refs dentro de `novo`), resolve o combate contra os defensores do
 * alvo, aplica baixas, transfere o bairro se o ataque vencer e registra o log.
 * `liderId` (opcional) recebe o crédito das mortes. Muta `novo` (deve ser clone).
 */
function executarAssalto(
  novo: GameState,
  faccaoId: string,
  alvoId: string,
  atacantes: Soldado[],
  rng: Rng,
  liderId?: string,
): ResultadoAcao {
  const fac = faccaoDe(novo, faccaoId);
  const alvo = bairroDe(novo, alvoId);
  if (!fac || !alvo) return { state: novo, ok: false, mensagem: 'Alvo inválido.' };

  const defensores = defensoresDoBairro(novo, alvoId);

  // Intel de espionagem dá bônus de ataque e é consumido no assalto.
  const comIntel = temIntel(novo, faccaoId, alvoId);
  const bonus = comIntel ? INTEL_BONUS_ATAQUE : 1;
  novo.intel = novo.intel.filter((m) => !(m.faccaoId === faccaoId && m.bairroId === alvoId));

  const resultado = resolverCombate(atacantes, defensores, alvo, armasMap(novo), rng, bonus);
  aplicarBaixas(novo, resultado.baixasAtacante);
  aplicarBaixas(novo, resultado.baixasDefensor);
  // Quem lutou e sobreviveu ganha experiência (Edge).
  ganharEdge(atacantes);
  ganharEdge(defensores);

  // Crédito de mortes: o líder (ou o atacante mais forte) leva as baixas fatais inimigas.
  const mortosInimigos = resultado.baixasDefensor.filter((b) => b.status === 'morto').length;
  if (mortosInimigos > 0 && atacantes.length > 0) {
    const lider =
      (liderId ? atacantes.find((a) => a.id === liderId) : undefined) ??
      [...atacantes].sort((a, b) => b.forca - a.forca)[0];
    if (lider) lider.mortes += mortosInimigos;
  }

  const donoAntigo = alvo.dono ? faccaoDe(novo, alvo.dono) : undefined;
  const nBaixas = resultado.baixasAtacante.length + resultado.baixasDefensor.length;
  const tagIntel = comIntel ? ' [intel]' : '';

  addLog(
    novo,
    'combate',
    `${fac.nome} atacou ${alvo.nome}${tagIntel} — ataque ${resultado.forcaAtaque} vs defesa ${resultado.forcaDefesa}.`,
  );

  if (resultado.vencedor === 'atacante') {
    alvo.dono = faccaoId;
    // Sobreviventes ocupam o bairro conquistado e já cavam trincheira (consolidam):
    // assumem postura de proteção pra aguentar o contra-ataque imediato do inimigo.
    for (const a of atacantes) {
      if (a.status === 'ativo' || a.status === 'ferido') {
        a.bairroId = alvoId;
        a.jobAtual = 'proteger';
      }
    }
    fac.respeito += 10 + Math.round(alvo.valorBase / 100);
    fac.calor = Math.min(100, fac.calor + 8);
    // Saque: tomar território rival rouba parte do estoque de produto (stash) da gangue.
    let tagSaque = '';
    if (donoAntigo && donoAntigo.id !== faccaoId && donoAntigo.stash > 0) {
      const saque = Math.round(donoAntigo.stash * 0.4);
      donoAntigo.stash -= saque;
      fac.caixa += saque;
      tagSaque = ` Saqueou $${saque} do estoque de ${donoAntigo.nome}.`;
    }
    const de = donoAntigo ? ` (tomado de ${donoAntigo.nome})` : '';
    addLog(novo, 'combate', `${fac.nome} DOMINOU ${alvo.nome}${de}. ${nBaixas} baixa(s).${tagSaque}`);
    return { state: novo, ok: true, mensagem: `Você dominou ${alvo.nome}!${tagSaque}` };
  }

  fac.calor = Math.min(100, fac.calor + 4);
  addLog(novo, 'combate', `${fac.nome} foi repelido em ${alvo.nome}. ${nBaixas} baixa(s).`);
  return { state: novo, ok: true, mensagem: `Ataque a ${alvo.nome} repelido.` };
}

/**
 * Ataca um bairro adjacente ao território da facção com TODA a fronteira (todos
 * os bairros próprios vizinhos ao alvo). Usado pela IA — combate agregado.
 */
export function atacarBairro(
  state: GameState,
  faccaoId: string,
  alvoId: string,
  rng: Rng = Math.random,
): ResultadoAcao {
  const novo = clonar(state);
  const fac = faccaoDe(novo, faccaoId);
  const alvo = bairroDe(novo, alvoId);
  if (!fac || !alvo) return { state, ok: false, mensagem: 'Alvo inválido.' };
  if (alvo.dono === faccaoId) {
    return { state, ok: false, mensagem: 'Esse bairro já é seu.' };
  }

  const { atacantes } = forcaDeAtaque(novo, faccaoId, alvoId);
  if (atacantes.length === 0) {
    return { state, ok: false, mensagem: 'Sem tropas em bairro vizinho pra atacar.' };
  }
  return executarAssalto(novo, faccaoId, alvoId, atacantes, rng);
}

/**
 * Job "Invadir": o soldado lidera o crew LIVRE do bairro dele num assalto a um
 * alvo adjacente. Todo o crew que embarca gasta o job do turno.
 */
export function invadirComSoldado(
  state: GameState,
  faccaoId: string,
  soldadoId: string,
  alvoId: string,
  rng: Rng = Math.random,
): ResultadoAcao {
  const novo = clonar(state);
  const lider = encontrarSoldado(novo, soldadoId);
  if (!lider || lider.faccaoId !== faccaoId) {
    return { state, ok: false, mensagem: 'Soldado inválido pra essa facção.' };
  }
  if (!podeAgir(lider)) {
    return { state, ok: false, mensagem: `${lider.nome} já agiu neste turno.` };
  }
  const alvo = bairroDe(novo, alvoId);
  if (!alvo) return { state, ok: false, mensagem: 'Alvo inválido.' };
  if (alvo.dono === faccaoId) {
    return { state, ok: false, mensagem: 'Esse bairro já é seu.' };
  }
  const { atacantes } = forcaDeAtaqueDoBairro(novo, faccaoId, lider.bairroId, alvoId);
  if (atacantes.length === 0) {
    return { state, ok: false, mensagem: 'Sem crew livre neste bairro pra invadir.' };
  }
  const res = executarAssalto(novo, faccaoId, alvoId, atacantes, rng, lider.id);
  if (res.ok) {
    // Invadir é uma AÇÃO do turno (não um job persistente): marca que agiram.
    // A vitória já pôs os sobreviventes em 'proteger' (consolidação); os repelidos
    // mantêm o job que já tinham.
    for (const a of atacantes) a.agiuNoTurno = true;
  }
  return res;
}

/**
 * Job "Vender" (PERSISTENTE): põe o soldado pra vender no bairro atual. O job fica
 * ativo turno após turno até você trocar — a renda entra no fim de cada turno
 * (Relatório de Grana). Pode reatribuir a qualquer momento.
 */
export function venderNoBairro(
  state: GameState,
  faccaoId: string,
  soldadoId: string,
): ResultadoAcao {
  const novo = clonar(state);
  const s = encontrarSoldado(novo, soldadoId);
  if (!s || s.faccaoId !== faccaoId) {
    return { state, ok: false, mensagem: 'Soldado inválido pra essa facção.' };
  }
  if (!participaDeCombate(s)) {
    return { state, ok: false, mensagem: `${s.nome} não pode trabalhar (${s.status}).` };
  }
  const bairro = bairroDe(novo, s.bairroId);
  if (!bairro || bairro.dono !== faccaoId) {
    return { state, ok: false, mensagem: 'Só dá pra vender em bairro seu.' };
  }
  s.jobAtual = 'vender';
  return { state: novo, ok: true, mensagem: `${s.nome} vendendo em ${bairro.nome}.` };
}

/**
 * Deploy de vendedor (o "Add Soldado" do Respect): move o soldado pra um bairro
 * e o põe pra vender. Aceita:
 *   - bairro SEU (realoca livremente dentro do território — logística);
 *   - bairro NEUTRO na fronteira do teu território (ocupa pacificamente + vende).
 * Território rival exige combate (invadir). Gasta o job do soldado.
 */
export function deployarVendedor(
  state: GameState,
  faccaoId: string,
  soldadoId: string,
  destinoId: string,
): ResultadoAcao {
  const novo = clonar(state);
  const s = encontrarSoldado(novo, soldadoId);
  if (!s || s.faccaoId !== faccaoId) {
    return { state, ok: false, mensagem: 'Soldado inválido pra essa facção.' };
  }
  if (!participaDeCombate(s)) {
    return { state, ok: false, mensagem: `${s.nome} não pode se deslocar (${s.status}).` };
  }
  const destino = bairroDe(novo, destinoId);
  if (!destino) return { state, ok: false, mensagem: 'Destino inválido.' };

  const proprios = new Set(bairrosDaFaccao(novo, faccaoId).map((b) => b.id));

  if (destino.dono === faccaoId) {
    // Realoca dentro do território.
    s.bairroId = destinoId;
  } else if (destino.dono === null) {
    // Ocupa neutro se faz fronteira com teu território.
    const naFronteira = destino.conexoes.some((c) => proprios.has(c)) || proprios.has(destinoId);
    if (!naFronteira) {
      return { state, ok: false, mensagem: 'Só ocupa neutro que faz fronteira com o teu território.' };
    }
    destino.dono = faccaoId;
    destino.estabilidade = ESTABILIDADE_INICIAL; // território novo rende −60% no começo
    s.bairroId = destinoId;
    addLog(novo, 'info', `${s.nome} ocupou ${destino.nome} — território novo (vendas instáveis).`);
  } else {
    return { state, ok: false, mensagem: 'Território rival — precisa invadir.' };
  }

  s.jobAtual = 'vender';
  return { state: novo, ok: true, mensagem: `${s.nome} vendendo em ${destino.nome}.` };
}

/**
 * Job "Proteger" (PERSISTENTE): postura defensiva no bairro (bônus de defesa +
 * blinda importantes + fica oculto pro inimigo). Fica ativo até você trocar.
 */
export function protegerBairro(
  state: GameState,
  faccaoId: string,
  soldadoId: string,
): ResultadoAcao {
  const novo = clonar(state);
  const s = encontrarSoldado(novo, soldadoId);
  if (!s || s.faccaoId !== faccaoId) {
    return { state, ok: false, mensagem: 'Soldado inválido pra essa facção.' };
  }
  if (!participaDeCombate(s)) {
    return { state, ok: false, mensagem: `${s.nome} não pode montar guarda (${s.status}).` };
  }
  s.jobAtual = 'proteger';
  const bairro = bairroDe(novo, s.bairroId);
  return { state: novo, ok: true, mensagem: `${s.nome} em guarda em ${bairro?.nome ?? 'o bairro'}.` };
}

/** Job "Sondar": bisbilhota um bairro adjacente inimigo → intel (grátis, sobe calor). */
export function sondarComSoldado(
  state: GameState,
  faccaoId: string,
  soldadoId: string,
  alvoId: string,
): ResultadoAcao {
  const novo = clonar(state);
  const fac = faccaoDe(novo, faccaoId);
  const s = encontrarSoldado(novo, soldadoId);
  if (!fac || !s || s.faccaoId !== faccaoId) {
    return { state, ok: false, mensagem: 'Soldado inválido pra essa facção.' };
  }
  if (!podeAgir(s)) return { state, ok: false, mensagem: `${s.nome} já agiu neste turno.` };
  const origem = bairroDe(novo, s.bairroId);
  const alvo = bairroDe(novo, alvoId);
  if (
    !origem ||
    !alvo ||
    origem.dono !== faccaoId ||
    !origem.conexoes.includes(alvoId) ||
    alvo.dono === faccaoId
  ) {
    return { state, ok: false, mensagem: 'Alvo de sondagem inválido (precisa ser vizinho inimigo).' };
  }
  fac.calor = Math.min(100, fac.calor + ESPIONAGEM_CALOR);
  novo.intel = novo.intel.filter((m) => !(m.faccaoId === faccaoId && m.bairroId === alvoId));
  novo.intel.push({ faccaoId, bairroId: alvoId, expiraTurno: novo.turno.numero + INTEL_DURACAO });
  // Sondar é uma AÇÃO do turno (não muda o job persistente do soldado).
  s.agiuNoTurno = true;
  addLog(novo, 'info', `${s.nome} sondou ${alvo.nome}. Intel obtido (+ataque no próximo assalto).`);
  return { state: novo, ok: true, mensagem: `Intel sobre ${alvo.nome} obtido.` };
}

/**
 * Compra um item do Mercado Negro (tudo em cash). Aplica o efeito e remove a
 * oferta do turno. `soldadoId` opcional mira o colete num soldado específico.
 */
export function comprarMercado(
  state: GameState,
  faccaoId: string,
  itemId: string,
  soldadoId?: string,
): ResultadoAcao {
  const novo = clonar(state);
  const fac = faccaoDe(novo, faccaoId);
  if (!fac) return { state, ok: false, mensagem: 'Facção inválida.' };
  const item = novo.mercado.find((m) => m.id === itemId);
  if (!item) return { state, ok: false, mensagem: 'Oferta indisponível.' };
  if (fac.caixa < item.custo) {
    return { state, ok: false, mensagem: `Caixa insuficiente ($${item.custo}).` };
  }

  const dePe = fac.soldados.filter(participaDeCombate);

  if (item.tipo === 'arma' && item.armaId) {
    const arma = armaDe(novo, item.armaId);
    if (!arma) return { state, ok: false, mensagem: 'Arma inválida.' };
    const n = item.quantidade ?? 1;
    // Equipa os N com arma mais fraca que ainda não têm essa arma.
    const alvos = [...dePe]
      .filter((s) => s.armaId !== item.armaId)
      .sort((a, b) => (armaDe(novo, a.armaId)?.dano ?? 0) - (armaDe(novo, b.armaId)?.dano ?? 0))
      .slice(0, n);
    if (alvos.length === 0) return { state, ok: false, mensagem: 'Ninguém pra armar com isso.' };
    for (const s of alvos) s.armaId = item.armaId;
    addLog(novo, 'info', `${fac.nome} comprou ${item.nome} e armou ${alvos.length} capanga(s).`);
  } else if (item.tipo === 'carro' && item.veiculo) {
    fac.veiculos.push({ ...item.veiculo });
    addLog(novo, 'info', `${fac.nome} comprou o carro ${item.veiculo.nome} (drive-by liberado).`);
  } else if (item.tipo === 'colete') {
    const alvo =
      (soldadoId ? dePe.find((s) => s.id === soldadoId && !s.colete) : undefined) ??
      [...dePe].filter((s) => !s.colete).sort((a, b) => b.forca - a.forca)[0];
    if (!alvo) return { state, ok: false, mensagem: 'Todo mundo já tem colete.' };
    alvo.colete = true;
    addLog(novo, 'info', `${fac.nome} pôs colete em ${alvo.nome}.`);
  } else if (item.tipo === 'elite') {
    const base = bairrosDaFaccao(novo, faccaoId).sort((a, b) => b.valorBase - a.valorBase)[0];
    if (!base) return { state, ok: false, mensagem: 'Sem território pra receber o soldado.' };
    const seq = novo.recrutaSeq;
    novo.recrutaSeq += 1;
    fac.soldados.push({
      id: `${faccaoId}-e${seq}`,
      nome: NOMES_RECRUTA[Math.floor((seq * 7) % NOMES_RECRUTA.length)] ?? `Elite ${seq}`,
      lealdade: 80,
      traco: 'leal',
      forca: 13,
      edge: 2,
      corre: 8,
      armaId: 'escopeta',
      colete: true,
      status: 'ativo',
      faccaoId,
      bairroId: base.id,
      patente: 'tenente',
      importante: true,
      mortes: 0,
      jobAtual: null,
      agiuNoTurno: true,
    });
    addLog(novo, 'info', `${fac.nome} contratou um Soldado de Elite em ${base.nome}.`);
  }

  fac.caixa -= item.custo;
  novo.mercado = novo.mercado.filter((m) => m.id !== itemId);
  return { state: novo, ok: true, mensagem: `Comprou: ${item.nome}.` };
}

/**
 * Drive-by: o líder embarca o crew do bairro num carro e mete bala num alvo rival
 * adjacente. Fere/mata defensores mas NÃO toma o território (bate e corre). Gasta
 * o job do crew e sobe o calor.
 */
export function driveBy(
  state: GameState,
  faccaoId: string,
  soldadoId: string,
  alvoId: string,
  rng: Rng = Math.random,
): ResultadoAcao {
  const novo = clonar(state);
  const fac = faccaoDe(novo, faccaoId);
  const lider = encontrarSoldado(novo, soldadoId);
  if (!fac || !lider || lider.faccaoId !== faccaoId) {
    return { state, ok: false, mensagem: 'Soldado inválido pra essa facção.' };
  }
  if (!podeAgir(lider)) return { state, ok: false, mensagem: `${lider.nome} já agiu neste turno.` };
  // Melhor carro da garagem (mais lugares).
  const carro = [...fac.veiculos].sort((a, b) => b.lugares - a.lugares)[0];
  if (!carro) return { state, ok: false, mensagem: 'Sem carro na garagem — compre um no Mercado.' };
  const alvo = bairroDe(novo, alvoId);
  const origem = bairroDe(novo, lider.bairroId);
  if (!alvo || !origem || origem.dono !== faccaoId || !origem.conexoes.includes(alvoId)) {
    return { state, ok: false, mensagem: 'Alvo inválido (precisa ser vizinho a partir de bairro seu).' };
  }
  if (alvo.dono === faccaoId || alvo.dono === null) {
    return { state, ok: false, mensagem: 'Drive-by é contra território rival.' };
  }

  // Crew embarca: quem está na origem, de pé, livre — até os lugares do carro.
  const crew = fac.soldados
    .filter((s) => s.bairroId === lider.bairroId && podeAgir(s))
    .sort((a, b) => b.forca - a.forca)
    .slice(0, carro.lugares);

  const defensores = defensoresDoBairro(novo, alvoId);
  const resultado = resolverDriveBy(crew, defensores, alvo, carro, armasMap(novo), rng);
  aplicarBaixas(novo, resultado.baixasAtacante);
  aplicarBaixas(novo, resultado.baixasDefensor);
  ganharEdge(crew);

  const mortosInimigos = resultado.baixasDefensor.filter((b) => b.status === 'morto').length;
  if (mortosInimigos > 0) lider.mortes += mortosInimigos;

  // Drive-by é uma AÇÃO do turno (não muda o job persistente do crew).
  for (const s of crew) s.agiuNoTurno = true;
  fac.calor = Math.min(100, fac.calor + 6);
  fac.respeito += 2 + mortosInimigos * 2;

  const nBaixas = resultado.baixasAtacante.length + resultado.baixasDefensor.length;
  addLog(
    novo,
    'combate',
    `${fac.nome} deu um drive-by em ${alvo.nome} (${carro.nome}) — ${nBaixas} baixa(s).`,
  );
  return { state: novo, ok: true, mensagem: `Drive-by em ${alvo.nome}: ${resultado.baixasDefensor.length} inimigo(s) atingido(s).` };
}

/** Custo pra promover, por patente atual (soldado→tenente, tenente→capitão). */
export const CUSTO_PROMOCAO: Record<string, number> = { soldado: 5000, tenente: 12000 };

/** Promove um soldado (Soldado→Tenente→Capitão): sobe stats e o torna importante. */
export function promoverSoldado(
  state: GameState,
  faccaoId: string,
  soldadoId: string,
): ResultadoAcao {
  const novo = clonar(state);
  const fac = faccaoDe(novo, faccaoId);
  const s = encontrarSoldado(novo, soldadoId);
  if (!fac || !s || s.faccaoId !== faccaoId) {
    return { state, ok: false, mensagem: 'Soldado inválido pra essa facção.' };
  }
  if (s.status === 'morto' || s.status === 'preso') {
    return { state, ok: false, mensagem: `${s.nome} não pode ser promovido (${s.status}).` };
  }
  const proxima = s.patente === 'soldado' ? 'tenente' : s.patente === 'tenente' ? 'capitao' : null;
  if (!proxima) return { state, ok: false, mensagem: `${s.nome} já é Capitão.` };
  const custo = CUSTO_PROMOCAO[s.patente] ?? 0;
  if (fac.caixa < custo) {
    return { state, ok: false, mensagem: `Caixa insuficiente pra promover ($${custo}).` };
  }
  fac.caixa -= custo;
  s.patente = proxima;
  s.importante = true;
  s.forca += 2;
  s.corre += 1;
  s.edge = Math.min(MAX_EDGE, s.edge + 1);
  addLog(novo, 'info', `${s.nome} foi promovido a ${proxima} (fç+2, corre+1).`);
  return { state: novo, ok: true, mensagem: `${s.nome} agora é ${proxima}.` };
}

/**
 * Início de um novo turno da facção: libera as AÇÕES de combate (agiuNoTurno),
 * mas MANTÉM o job persistente (vender/proteger seguem valendo turno após turno —
 * você não precisa reatribuir todo turno).
 */
export function resetarJobs(state: GameState, faccaoId: string): void {
  const fac = faccaoDe(state, faccaoId);
  if (!fac) return;
  for (const s of fac.soldados) {
    if (s.status === 'ativo' || s.status === 'ferido') s.agiuNoTurno = false;
  }
}

/**
 * Espiona um bairro adjacente ao território: paga caixa, sobe o calor e ganha
 * intel (bônus no próximo ataque a esse bairro). Gasta uma ação.
 */
export function espionarBairro(
  state: GameState,
  faccaoId: string,
  alvoId: string,
): ResultadoAcao {
  const novo = clonar(state);
  const fac = faccaoDe(novo, faccaoId);
  const alvo = bairroDe(novo, alvoId);
  if (!fac || !alvo) return { state, ok: false, mensagem: 'Alvo inválido.' };
  if (alvo.dono === faccaoId) {
    return { state, ok: false, mensagem: 'Não faz sentido espionar bairro seu.' };
  }
  const podeAlcancar = alvosPossiveis(novo, faccaoId).some((b) => b.id === alvoId);
  if (!podeAlcancar) {
    return { state, ok: false, mensagem: 'Só dá pra espionar bairro na sua fronteira.' };
  }
  if (fac.caixa < CUSTO_ESPIONAGEM) {
    return { state, ok: false, mensagem: `Caixa insuficiente pra espionar ($${CUSTO_ESPIONAGEM}).` };
  }

  fac.caixa -= CUSTO_ESPIONAGEM;
  fac.calor = Math.min(100, fac.calor + ESPIONAGEM_CALOR);
  // Renova/adiciona o marcador de intel.
  novo.intel = novo.intel.filter((m) => !(m.faccaoId === faccaoId && m.bairroId === alvoId));
  novo.intel.push({ faccaoId, bairroId: alvoId, expiraTurno: novo.turno.numero + INTEL_DURACAO });
  addLog(novo, 'info', `${fac.nome} espionou ${alvo.nome}. Intel obtido (+ataque no próximo assalto).`);
  return { state: novo, ok: true, mensagem: `Intel sobre ${alvo.nome} obtido.` };
}

/** Contrata advogado: paga caixa e reduz o calor (despista a polícia). Não gasta ação. */
export function contratarAdvogado(state: GameState, faccaoId: string): ResultadoAcao {
  const novo = clonar(state);
  const fac = faccaoDe(novo, faccaoId);
  if (!fac) return { state, ok: false, mensagem: 'Facção inválida.' };
  if (fac.calor <= 0) {
    return { state, ok: false, mensagem: 'Calor já está zerado.' };
  }
  if (fac.caixa < CUSTO_ADVOGADO) {
    return { state, ok: false, mensagem: `Caixa insuficiente pro advogado ($${CUSTO_ADVOGADO}).` };
  }
  fac.caixa -= CUSTO_ADVOGADO;
  const antes = fac.calor;
  fac.calor = Math.max(0, fac.calor - ADVOGADO_REDUZ_CALOR);
  addLog(novo, 'info', `${fac.nome} pagou advogado: calor ${antes} → ${fac.calor} (-$${CUSTO_ADVOGADO}).`);
  return { state: novo, ok: true, mensagem: `Advogado esfriou o calor pra ${fac.calor}.` };
}

/**
 * Batida policial: facções com calor alto sofrem consequências — prende um
 * soldado de pé ou apreende caixa. Muta o estado (usar em clone, na resolução do
 * turno). Quanto maior o calor, maior a chance.
 */
export function aplicarBatidaPolicial(state: GameState, rng: Rng = Math.random): void {
  for (const fac of state.faccoes) {
    if (fac.calor < CALOR_LIMIAR_BATIDA) continue;
    const chance = (fac.calor - CALOR_LIMIAR_BATIDA) / 100 + 0.1; // 0.1..0.6
    if (rng() >= chance) continue;

    const dePe = fac.soldados.filter(participaDeCombate);
    if (dePe.length > 0) {
      const alvo = dePe[Math.floor(rng() * dePe.length)];
      alvo.status = 'preso';
      addLog(state, 'combate', `BATIDA POLICIAL: ${alvo.nome} (${fac.nome}) foi preso.`);
    } else {
      const multa = Math.min(fac.caixa, 2000);
      fac.caixa -= multa;
      addLog(state, 'combate', `BATIDA POLICIAL: ${fac.nome} perdeu $${multa} em apreensão.`);
    }
    fac.calor = Math.max(0, fac.calor - BATIDA_ESFRIA_CALOR);
  }
}

/** Remove marcadores de intel expirados. Muta o estado (usar em clone). */
export function limparIntelExpirado(state: GameState): void {
  state.intel = state.intel.filter((m) => m.expiraTurno >= state.turno.numero);
}
