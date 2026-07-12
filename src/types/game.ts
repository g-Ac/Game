/**
 * Estrutura de dados core do jogo — segue o game-design-doc.md.
 * Tudo aqui é JSON-serializável (nenhuma classe / função), pra permitir
 * save/load direto via AsyncStorage.
 */

export type FaccaoTipo = 'jogador' | 'ia';

/** Arquétipos de comportamento da IA (só faz sentido pra facções tipo 'ia'). */
export type Arquetipo = 'agressivo' | 'paciente' | 'oportunista';

/** Traço de personalidade do soldado — influencia poder e decisões futuras. */
export type Traco = 'leal' | 'ganancioso' | 'covarde';

export type SoldadoStatus = 'ativo' | 'ferido' | 'preso' | 'morto';

/** Patente do soldado na hierarquia da facção. Tenente/Capitão são "importantes". */
export type Patente = 'soldado' | 'tenente' | 'capitao';

/**
 * Job que o soldado executa no turno (estilo Respect 2). Cada soldado de pé faz
 * UM job por turno; depois fica "gasto" até o próximo. `null` = ainda livre.
 */
export type SoldadoJob = 'vender' | 'sondar' | 'proteger' | 'invadir' | 'driveby' | 'mover' | null;

/** Veículo (Mercado Negro) — usado em drive-by. */
export interface Veiculo {
  id: string;
  nome: string;
  /** Lugares: quantos capangas embarcam no drive-by. */
  lugares: number;
  /** Velocidade (1-5): bônus de iniciativa/ataque no drive-by. */
  velocidade: number;
  /** Blindagem (1-5): reduz baixas do próprio crew no drive-by. */
  blindagem: number;
}

export type MercadoItemTipo = 'arma' | 'carro' | 'colete' | 'elite';

/** Uma oferta do Mercado Negro no turno atual (tudo em cash). */
export interface MercadoItem {
  id: string;
  tipo: MercadoItemTipo;
  nome: string;
  descricao: string;
  custo: number;
  /** 'arma': id da arma + quantidade equipada nos mais fracos. */
  armaId?: string;
  quantidade?: number;
  /** 'carro': o veículo ofertado. */
  veiculo?: Veiculo;
}

/** Fase atual do turno (loop de jogo do doc, seção 4). */
export type FaseTurno = 'relatorio' | 'decisao' | 'ia' | 'fim';

export type StatusPartida = 'em_andamento' | 'vitoria' | 'derrota';

/** Dificuldade escolhida no início (afeta a força/agressividade da IA). */
export type Dificuldade = 'normal' | 'dificil' | 'og';

export interface Arma {
  id: string;
  nome: string;
  dano: number;
  custo: number;
  /** ids de cidades onde a arma está disponível na loja. */
  cidadesDisponiveis: string[];
}

export interface Soldado {
  id: string;
  nome: string;
  /** 0-100. */
  lealdade: number;
  traco: Traco;
  /** Força base de combate (sem contar arma). */
  forca: number;
  /** Corre / hustle — define quanto o soldado fornece de produto ao Vender. */
  corre: number;
  /** id da arma equipada, ou null (briga no braço). */
  armaId: string | null;
  /** Tem colete? Reduz o dano recebido em combate. */
  colete: boolean;
  status: SoldadoStatus;
  /** Facção dona do soldado. */
  faccaoId: string;
  /** Bairro onde o soldado está posicionado. */
  bairroId: string;
  /** Patente na hierarquia. Recruta entra como 'soldado'. */
  patente: Patente;
  /** Peça-chave (⭐): tenente/capitão. Protegido em combate — cai por último. */
  importante: boolean;
  /** Inimigos que já derrubou (flavor + alimenta respeito). */
  mortes: number;
  /** Job atribuído/executado neste turno; null = livre (ainda pode agir). */
  jobAtual: SoldadoJob;
  /** Já gastou o job deste turno? */
  agiuNoTurno: boolean;
}

export interface Bairro {
  id: string;
  nome: string;
  /** id da facção dona, ou null (bairro neutro). */
  dono: string | null;
  /** Valor econômico — gera renda por turno pra quem controla. */
  valorBase: number;
  /** 0-100. Risco de batida policial (chance de prisão em combate aqui). */
  risco: number;
  /** ids dos bairros adjacentes. */
  conexoes: string[];
  /** Nível da boca/ponto de venda instalado (0 = nenhum). Legado — ver `demanda`. */
  producao: number;
  /** Demanda por produto (Corre necessário pra suprir 100%). Define o tier ($..$$$$). */
  demanda: number;
  /**
   * Estabilidade das vendas (0.4..1). Território recém-tomado começa em 0.4
   * (rende −60%) e sobe por turno até 1.0 — "mantenha pra estabilizar as vendas".
   */
  estabilidade: number;
}

export interface Faccao {
  id: string;
  nome: string;
  tipo: FaccaoTipo;
  /** null pro jogador; define comportamento pra IA. */
  arquetipo: Arquetipo | null;
  /** Cor de identidade (hex) — usada na UI. */
  cor: string;
  caixa: number;
  respeito: number;
  /** 0-100. Heat / atenção policial acumulada. */
  calor: number;
  soldados: Soldado[];
  /** Garagem — veículos comprados no Mercado Negro (usados em drive-by). */
  veiculos: Veiculo[];
}

export interface Cidade {
  id: string;
  nome: string;
  era: string;
  dificuldadeBase: number;
  bairros: Bairro[];
}

export type LogTipo = 'info' | 'combate' | 'ia' | 'renda' | 'sistema' | 'fim';

export interface LogEntry {
  id: number;
  turno: number;
  tipo: LogTipo;
  texto: string;
}

export interface Turno {
  numero: number;
  fase: FaseTurno;
  /** Ações que o jogador ainda pode gastar neste turno. */
  acoesRestantes: number;
}

/** Linha do relatório de grana por território. */
export interface LinhaRelatorio {
  bairroId: string;
  nome: string;
  demanda: number;
  suprido: number;
  receita: number;
  receitaMax: number;
  /** Penalidade de território novo (0 = estável, 0.6 = recém-tomado). */
  penalidadeNovo: number;
}

/** Relatório de grana no fim do turno (estilo "Cash Report" do Respect). */
export interface RelatorioGrana {
  turno: number;
  ganhos: number;
  pagamentoCrew: number;
  custoProduto: number;
  lucro: number;
  /** Pagamento médio por soldado — define se o respeito sobe ou cai. */
  pagtoMedio: number;
  respeitoSubindo: boolean;
  deltaRespeito: number;
  linhas: LinhaRelatorio[];
}

/**
 * Marcador de inteligência: uma facção espionou um bairro e ganha bônus de
 * ataque contra ele até `expiraTurno` (inclusive).
 */
export interface IntelMarker {
  faccaoId: string;
  bairroId: string;
  expiraTurno: number;
}

/**
 * Estado completo de uma partida. As "rivais" do doc (Cidade.rivais) e o
 * jogador vivem juntos em `faccoes`; a cidade guarda só os bairros.
 */
export interface GameState {
  versao: number;
  cidade: Cidade;
  faccoes: Faccao[];
  jogadorId: string;
  turno: Turno;
  status: StatusPartida;
  /** Catálogo de armas disponível na partida. */
  armas: Arma[];
  log: LogEntry[];
  /** Contador monotônico pra gerar ids de log estáveis. */
  logSeq: number;
  /** Contador monotônico pra gerar ids de soldados recrutados. */
  recrutaSeq: number;
  /** Marcadores de espionagem ativos. */
  intel: IntelMarker[];
  /** Dificuldade escolhida no início. */
  dificuldade: Dificuldade;
  /** Relatório de grana do último fechamento de turno (pra UI mostrar o popup). */
  ultimoRelatorio: RelatorioGrana | null;
  /** Ofertas do Mercado Negro neste turno (renova a cada turno). */
  mercado: MercadoItem[];
}
