/**
 * Partida — Zona Sul em grade 3×3 (9 bairros).
 *
 * Layout (linha de baixo = a rua onde as duas facções brigam; as duas fileiras
 * de cima são território neutro de expansão — economia, jobs e manobra):
 *
 *   Alto da Cruz   Pedreira      Grota Funda
 *   Ladeira Preta  Cortiço       Buraco Quente
 *   BECO(jogador)  Vila Torta    MORRO(IA)
 *
 * A linha de baixo Beco—Vila—Morro é a disputa clássica (Vila no meio). As duas
 * fileiras de cima dão espaço pra construir economia e usar os jobs antes do
 * choque — o mapa pequeno de 3 bairros decidia tudo em 2-3 turnos.
 */

import { cores } from '../theme/tokens';
import type { Arma, Bairro, Cidade, Faccao, GameState, Soldado } from '../types/game';

export const CIDADE_ID = 'zona-sul';
export const JOGADOR_ID = 'os-corvos';
export const IA_ID = 'sindicato-rubro';

// Linha de baixo — mantém a adjacência Beco—Vila—Morro (a rua da disputa).
export const B_BECO = 'beco-do-sol';
export const B_VILA = 'vila-torta';
export const B_MORRO = 'morro-alto';
// Fileira do meio.
const B_LADEIRA = 'ladeira-preta';
const B_CORTICO = 'cortico';
const B_BURACO = 'buraco-quente';
// Fileira de cima.
const B_ALTO = 'alto-da-cruz';
const B_PEDREIRA = 'pedreira';
const B_GROTA = 'grota-funda';

/** Catálogo de armas da cidade. Faca é grátis (arma base). */
export const ARMAS: Arma[] = [
  { id: 'faca', nome: 'Faca', dano: 2, custo: 0, cidadesDisponiveis: [CIDADE_ID] },
  { id: 'pistola', nome: 'Pistola', dano: 5, custo: 300, cidadesDisponiveis: [CIDADE_ID] },
  { id: 'escopeta', nome: 'Escopeta', dano: 9, custo: 700, cidadesDisponiveis: [CIDADE_ID] },
  { id: 'fuzil', nome: 'Fuzil', dano: 15, custo: 1500, cidadesDisponiveis: [CIDADE_ID] },
];

function bairros(): Bairro[] {
  // Grade 3×3 em ordem row-major (a UI desenha em fileiras de 3). Adjacência
  // ortogonal (cima/baixo/esquerda/direita).
  return [
    // Fileira de cima.
    { id: B_ALTO, nome: 'Alto da Cruz', dono: null, valorBase: 1100, risco: 20, conexoes: [B_PEDREIRA, B_LADEIRA], producao: 0 },
    { id: B_PEDREIRA, nome: 'Pedreira', dono: null, valorBase: 1600, risco: 35, conexoes: [B_ALTO, B_GROTA, B_CORTICO], producao: 0 },
    { id: B_GROTA, nome: 'Grota Funda', dono: null, valorBase: 1100, risco: 25, conexoes: [B_PEDREIRA, B_BURACO], producao: 0 },
    // Fileira do meio.
    { id: B_LADEIRA, nome: 'Ladeira Preta', dono: null, valorBase: 1300, risco: 25, conexoes: [B_ALTO, B_CORTICO, B_BECO], producao: 0 },
    { id: B_CORTICO, nome: 'Cortiço', dono: null, valorBase: 2200, risco: 50, conexoes: [B_PEDREIRA, B_LADEIRA, B_BURACO, B_VILA], producao: 0 },
    { id: B_BURACO, nome: 'Buraco Quente', dono: null, valorBase: 1300, risco: 30, conexoes: [B_GROTA, B_CORTICO, B_MORRO], producao: 0 },
    // Linha de baixo — a rua da disputa.
    { id: B_BECO, nome: 'Beco do Sol', dono: JOGADOR_ID, valorBase: 1200, risco: 20, conexoes: [B_LADEIRA, B_VILA], producao: 1 },
    { id: B_VILA, nome: 'Vila Torta', dono: null, valorBase: 2000, risco: 45, conexoes: [B_CORTICO, B_BECO, B_MORRO], producao: 0 },
    { id: B_MORRO, nome: 'Morro Alto', dono: IA_ID, valorBase: 1400, risco: 30, conexoes: [B_BURACO, B_VILA], producao: 1 },
  ];
}

function soldado(
  id: string,
  nome: string,
  faccaoId: string,
  bairroId: string,
  forca: number,
  traco: Soldado['traco'],
  armaId: string | null,
  patente: Soldado['patente'] = 'soldado',
): Soldado {
  return {
    id,
    nome,
    lealdade: 70,
    traco,
    forca,
    armaId,
    status: 'ativo',
    faccaoId,
    bairroId,
    patente,
    importante: patente !== 'soldado',
    mortes: 0,
    jobAtual: null,
    agiuNoTurno: false,
  };
}

function jogador(): Faccao {
  return {
    id: JOGADOR_ID,
    nome: 'Os Corvos',
    tipo: 'jogador',
    arquetipo: null,
    cor: cores.gold1,
    caixa: 500,
    respeito: 0,
    calor: 0,
    soldados: [
      soldado('p1', 'Zé Pequeno', JOGADOR_ID, B_BECO, 11, 'leal', 'pistola', 'capitao'),
      soldado('p2', 'Bagre', JOGADOR_ID, B_BECO, 9, 'ganancioso', 'pistola', 'tenente'),
      soldado('p3', 'Formiga', JOGADOR_ID, B_BECO, 8, 'covarde', 'faca'),
    ],
  };
}

function ia(): Faccao {
  return {
    id: IA_ID,
    nome: 'Sindicato Rubro',
    tipo: 'ia',
    arquetipo: 'agressivo',
    cor: cores.bloodLight,
    caixa: 500,
    respeito: 0,
    calor: 0,
    soldados: [
      soldado('e1', 'Régis', IA_ID, B_MORRO, 10, 'leal', 'pistola', 'tenente'),
      soldado('e2', 'Caveira', IA_ID, B_MORRO, 12, 'ganancioso', 'pistola', 'capitao'),
      soldado('e3', 'Sombra', IA_ID, B_MORRO, 8, 'covarde', 'faca'),
    ],
  };
}

export function cidadeInicial(): Cidade {
  return {
    id: CIDADE_ID,
    nome: 'Zona Sul',
    era: '2020s',
    dificuldadeBase: 1,
    bairros: bairros(),
  };
}

/** Monta um GameState novo e limpo pra uma partida de teste. */
export function criarPartida(): GameState {
  const faccoes = [jogador(), ia()];
  const jog = faccoes.find((f) => f.id === JOGADOR_ID);
  const livres = jog ? jog.soldados.filter((s) => s.status === 'ativo').length : 0;
  return {
    versao: 1,
    cidade: cidadeInicial(),
    faccoes,
    jogadorId: JOGADOR_ID,
    turno: { numero: 1, fase: 'decisao', acoesRestantes: livres },
    status: 'em_andamento',
    armas: ARMAS,
    log: [
      {
        id: 0,
        turno: 1,
        tipo: 'sistema',
        texto: 'Guerra por Zona Sul começou. Vila Torta está em disputa.',
      },
    ],
    logSeq: 1,
    recrutaSeq: 0,
    intel: [],
  };
}

/** Quantas ações (mover/atacar) o jogador tem por turno. Vestigial — hoje o
 *  orçamento de ação é por soldado (cada um faz 1 job/turno). */
export const ACOES_POR_TURNO = 3;

/** Fração do valorBase dos bairros que vira renda por turno. */
export const FATOR_RENDA = 0.1;

// --- Jobs por soldado (estilo Respect 2) ---

/** Job "Vender": fração do valorBase do bairro que o soldado fatura na hora. */
export const FATOR_VENDA = 0.06;
/** Job "Vender": bônus por nível de boca no bairro (hustle em cima da produção). */
export const VENDA_POR_BOCA = 90;
/** Calor gerado pelo job "Vender" (vender na esquina chama a polícia). */
export const VENDA_CALOR = 2;
/** Calor gerado pelo job "Sondar" (bisbilhotar território inimigo é arriscado). */
export const SONDAR_CALOR = 2;

/** Custo pra recrutar um soldado novo (economia in-match). */
export const CUSTO_RECRUTA = 450;

/** Traços possíveis de um recruta. */
export const TRACOS: Soldado['traco'][] = ['leal', 'ganancioso', 'covarde'];

/** Pool de apelidos pra recrutas (indexado por seq + rng). */
export const NOMES_RECRUTA = [
  'Piloto', 'Neném', 'Gordo', 'Xis', 'Baiano', 'Russo', 'Tuim', 'Careca',
  'Nariz', 'Metralha', 'Dente', 'Faísca', 'Mão Branca', 'Corvo', 'Passarinho',
  'Zóio', 'Cebola', 'Trovão', 'Meia-Noite', 'Chumbo',
] as const;

// --- Espionagem / Heat / Polícia / Advogados ---

/** Custo em caixa pra espionar um bairro. */
export const CUSTO_ESPIONAGEM = 150;
/** Calor ganho ao espionar (operação arriscada). */
export const ESPIONAGEM_CALOR = 3;
/** Turnos que o intel permanece válido além do turno atual. */
export const INTEL_DURACAO = 1;
/** Multiplicador de ataque quando há intel ativo sobre o alvo. */
export const INTEL_BONUS_ATAQUE = 1.25;

/** Custo pra contratar advogado (esfria o calor / despista a polícia). */
export const CUSTO_ADVOGADO = 300;
/** Quanto de calor o advogado remove. */
export const ADVOGADO_REDUZ_CALOR = 25;

/** Calor a partir do qual a facção corre risco de batida policial. */
export const CALOR_LIMIAR_BATIDA = 50;
/** Calor removido quando uma batida acontece. */
export const BATIDA_ESFRIA_CALOR = 20;

// --- Produção (bocas / pontos de venda) ---

/** Custo pra instalar/subir um nível de boca num bairro próprio. */
export const CUSTO_BOCA = 600;
/** Nível máximo de boca por bairro. */
export const MAX_BOCA_NIVEL = 3;
/** Renda por turno gerada por nível de boca. */
export const RENDA_POR_BOCA = 160;
/** Calor por turno gerado por nível de boca (tráfico atrai a polícia). */
export const CALOR_POR_BOCA = 3;
