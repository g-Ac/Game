/**
 * Partida — Zona Sul em grade 4×4 (16 bairros), economia estilo Respect 2.
 *
 * Cada bairro tem uma DEMANDA por produto (Corre necessário). Você toma
 * territórios (neutros, deployando vendedor; rivais, na porrada) e posiciona
 * vendedores pra suprir a demanda e faturar. Jogador começa no canto inferior
 * esquerdo; a IA no canto superior direito. O miolo é neutro pra expansão.
 */

import { cores } from '../theme/tokens';
import { CAIXA_INICIAL, DEMANDA_TIER } from '../engine/economia';
import { gerarMercado } from '../engine/mercado';
import type {
  Arma,
  Bairro,
  Cidade,
  Dificuldade,
  Faccao,
  GameState,
  Soldado,
} from '../types/game';

export const CIDADE_ID = 'zona-sul';
export const JOGADOR_ID = 'os-corvos';
export const IA_ID = 'sindicato-rubro';

const [D1, D2, D3, D4] = DEMANDA_TIER; // 8, 16, 24, 32

// Grade 4×4 (row-major). Beco (jogador) no canto inferior esq.; Morro (IA) no
// canto superior dir. Beco—Vila permanecem adjacentes (usado nos testes).
export const B_BECO = 'beco-do-sol'; // (3,0) jogador
export const B_VILA = 'vila-torta'; // (3,1) neutro
export const B_MORRO = 'morro-alto'; // (0,3) IA
const B_ALTO = 'alto-da-cruz';
const B_PEDREIRA = 'pedreira';
const B_GROTA = 'grota-funda';
const B_LADEIRA = 'ladeira-preta';
const B_CORTICO = 'cortico';
const B_SERENO = 'sereno';
const B_BURACO = 'buraco-quente';
const B_CANAL = 'canal';
const B_FUNDAO = 'fundao';
const B_PALAFITA = 'palafita';
const B_CURVA = 'curva-do-rio';
const B_CHAPADAO = 'chapadao';
const B_MATO = 'boca-do-mato';

/** Catálogo de armas (escala Respect). Faca é grátis (arma base). */
export const ARMAS: Arma[] = [
  { id: 'faca', nome: 'Faca', dano: 2, custo: 0, cidadesDisponiveis: [CIDADE_ID] },
  { id: 'pistola', nome: 'Pistola', dano: 5, custo: 2500, cidadesDisponiveis: [CIDADE_ID] },
  { id: 'escopeta', nome: 'Escopeta', dano: 9, custo: 6000, cidadesDisponiveis: [CIDADE_ID] },
  { id: 'fuzil', nome: 'Fuzil', dano: 15, custo: 14000, cidadesDisponiveis: [CIDADE_ID] },
];

interface BairroSeed {
  id: string;
  nome: string;
  dono: string | null;
  demanda: number;
  risco: number;
  conexoes: string[];
}

function mkBairro(s: BairroSeed): Bairro {
  return {
    id: s.id,
    nome: s.nome,
    dono: s.dono,
    // valorBase (legado) derivado da demanda só pra manter o campo coerente.
    valorBase: s.demanda * 100,
    risco: s.risco,
    conexoes: s.conexoes,
    producao: 0,
    demanda: s.demanda,
    estabilidade: 1,
  };
}

function bairros(): Bairro[] {
  return [
    // Fileira 0 (topo)
    mkBairro({ id: B_ALTO, nome: 'Alto da Cruz', dono: null, demanda: D1, risco: 20, conexoes: [B_PEDREIRA, B_LADEIRA] }),
    mkBairro({ id: B_PEDREIRA, nome: 'Pedreira', dono: null, demanda: D2, risco: 30, conexoes: [B_ALTO, B_GROTA, B_CORTICO] }),
    mkBairro({ id: B_GROTA, nome: 'Grota Funda', dono: null, demanda: D2, risco: 30, conexoes: [B_PEDREIRA, B_MORRO, B_SERENO] }),
    mkBairro({ id: B_MORRO, nome: 'Morro Alto', dono: IA_ID, demanda: D2, risco: 30, conexoes: [B_GROTA, B_BURACO] }),
    // Fileira 1
    mkBairro({ id: B_LADEIRA, nome: 'Ladeira Preta', dono: null, demanda: D2, risco: 25, conexoes: [B_ALTO, B_CORTICO, B_CANAL] }),
    mkBairro({ id: B_CORTICO, nome: 'Cortiço', dono: null, demanda: D4, risco: 50, conexoes: [B_PEDREIRA, B_LADEIRA, B_SERENO, B_FUNDAO] }),
    mkBairro({ id: B_SERENO, nome: 'Sereno', dono: null, demanda: D3, risco: 40, conexoes: [B_GROTA, B_CORTICO, B_BURACO, B_PALAFITA] }),
    mkBairro({ id: B_BURACO, nome: 'Buraco Quente', dono: null, demanda: D2, risco: 35, conexoes: [B_MORRO, B_SERENO, B_CURVA] }),
    // Fileira 2
    mkBairro({ id: B_CANAL, nome: 'Canal', dono: null, demanda: D1, risco: 20, conexoes: [B_LADEIRA, B_FUNDAO, B_BECO] }),
    mkBairro({ id: B_FUNDAO, nome: 'Fundão', dono: null, demanda: D3, risco: 40, conexoes: [B_CORTICO, B_CANAL, B_PALAFITA, B_VILA] }),
    mkBairro({ id: B_PALAFITA, nome: 'Palafita', dono: null, demanda: D4, risco: 50, conexoes: [B_SERENO, B_FUNDAO, B_CURVA, B_CHAPADAO] }),
    mkBairro({ id: B_CURVA, nome: 'Curva do Rio', dono: null, demanda: D2, risco: 30, conexoes: [B_BURACO, B_PALAFITA, B_MATO] }),
    // Fileira 3 (base)
    mkBairro({ id: B_BECO, nome: 'Beco do Sol', dono: JOGADOR_ID, demanda: D2, risco: 20, conexoes: [B_CANAL, B_VILA] }),
    mkBairro({ id: B_VILA, nome: 'Vila Torta', dono: null, demanda: D3, risco: 45, conexoes: [B_FUNDAO, B_BECO, B_CHAPADAO] }),
    mkBairro({ id: B_CHAPADAO, nome: 'Chapadão', dono: null, demanda: D2, risco: 30, conexoes: [B_PALAFITA, B_VILA, B_MATO] }),
    mkBairro({ id: B_MATO, nome: 'Boca do Mato', dono: null, demanda: D1, risco: 20, conexoes: [B_CURVA, B_CHAPADAO] }),
  ];
}

function soldado(
  id: string,
  nome: string,
  faccaoId: string,
  bairroId: string,
  forca: number,
  corre: number,
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
    corre,
    armaId,
    colete: false,
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
    caixa: CAIXA_INICIAL,
    respeito: 0,
    calor: 0,
    soldados: [
      soldado('p1', 'Zé Pequeno', JOGADOR_ID, B_BECO, 11, 6, 'leal', 'pistola', 'capitao'),
      soldado('p2', 'Bagre', JOGADOR_ID, B_BECO, 9, 5, 'ganancioso', 'pistola', 'tenente'),
      soldado('p3', 'Formiga', JOGADOR_ID, B_BECO, 8, 4, 'covarde', 'faca'),
    ],
    veiculos: [],
  };
}

/** Arquétipo da IA por dificuldade. */
const ARQ_POR_DIFICULDADE: Record<Dificuldade, Faccao['arquetipo']> = {
  normal: 'oportunista',
  dificil: 'agressivo',
  og: 'agressivo',
};

function ia(dificuldade: Dificuldade): Faccao {
  const soldados = [
    soldado('e1', 'Régis', IA_ID, B_MORRO, 10, 5, 'leal', 'pistola', 'tenente'),
    soldado('e2', 'Caveira', IA_ID, B_MORRO, 12, 6, 'ganancioso', 'pistola', 'capitao'),
    soldado('e3', 'Sombra', IA_ID, B_MORRO, 8, 4, 'covarde', 'faca'),
  ];
  // O.G.: a IA entra reforçada (mais grana + um capanga extra).
  if (dificuldade === 'og') {
    soldados.push(soldado('e4', 'Trinca', IA_ID, B_MORRO, 10, 5, 'ganancioso', 'pistola'));
  }
  return {
    id: IA_ID,
    nome: 'Sindicato Rubro',
    tipo: 'ia',
    arquetipo: ARQ_POR_DIFICULDADE[dificuldade],
    cor: cores.bloodLight,
    caixa: dificuldade === 'og' ? CAIXA_INICIAL + 6000 : CAIXA_INICIAL,
    respeito: 0,
    calor: 0,
    soldados,
    veiculos: [],
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

/** Monta um GameState novo e limpo. */
export function criarPartida(dificuldade: Dificuldade = 'normal'): GameState {
  const faccoes = [jogador(), ia(dificuldade)];
  const jog = faccoes.find((f) => f.id === JOGADOR_ID);
  const livres = jog ? jog.soldados.filter((s) => s.status === 'ativo').length : 0;
  return {
    versao: 2,
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
        texto: 'Guerra por Zona Sul começou. Ponha teus vendedores pra rodar.',
      },
    ],
    logSeq: 1,
    recrutaSeq: 0,
    intel: [],
    dificuldade,
    ultimoRelatorio: null,
    mercado: gerarMercado(1),
  };
}

/** Quantas ações o jogador tem por turno (vestigial — hoje é 1 job por soldado). */
export const ACOES_POR_TURNO = 3;

/** Traços possíveis de um recruta. */
export const TRACOS: Soldado['traco'][] = ['leal', 'ganancioso', 'covarde'];

/** Custo pra recrutar um soldado novo (escala Respect). */
export const CUSTO_RECRUTA = 3000;

/** Pool de apelidos pra recrutas (indexado por seq + rng). */
export const NOMES_RECRUTA = [
  'Piloto', 'Neném', 'Gordo', 'Xis', 'Baiano', 'Russo', 'Tuim', 'Careca',
  'Nariz', 'Metralha', 'Dente', 'Faísca', 'Mão Branca', 'Corvo', 'Passarinho',
  'Zóio', 'Cebola', 'Trovão', 'Meia-Noite', 'Chumbo',
] as const;

// --- Sondagem / Heat / Polícia / Advogados (escala Respect) ---

/** Custo em caixa pra espionar um bairro. */
export const CUSTO_ESPIONAGEM = 1500;
/** Calor ganho ao espionar (operação arriscada). */
export const ESPIONAGEM_CALOR = 3;
/** Turnos que o intel permanece válido além do turno atual. */
export const INTEL_DURACAO = 1;
/** Multiplicador de ataque quando há intel ativo sobre o alvo. */
export const INTEL_BONUS_ATAQUE = 1.25;

/** Custo pra contratar advogado (esfria o calor / despista a polícia). */
export const CUSTO_ADVOGADO = 3000;
/** Quanto de calor o advogado remove. */
export const ADVOGADO_REDUZ_CALOR = 25;

/** Calor a partir do qual a facção corre risco de batida policial. */
export const CALOR_LIMIAR_BATIDA = 50;
/** Calor removido quando uma batida acontece. */
export const BATIDA_ESFRIA_CALOR = 20;
