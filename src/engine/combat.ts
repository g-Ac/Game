/**
 * Combate simples (doc, seção 4.3): força total dos soldados + dano da arma
 * vs defesa, com fator aleatório. Soldados podem ficar feridos, mortos ou presos.
 *
 * Funções puras: recebem estado, devolvem resultado. RNG injetável pra testes.
 */

import type { Arma, Bairro, Soldado, SoldadoStatus, Traco, Veiculo } from '../types/game';

export type Rng = () => number;

/** Vantagem de território pra quem defende em casa. */
export const VANTAGEM_CASA = 1.05;

/**
 * Bônus de iniciativa de quem ataca — recompensa a ofensiva e evita o
 * empate frio (ninguém toma a casa do outro). Balanceamento de v1: um jogador
 * que concentra tropas e assalta vence ~47% vs a IA agressiva; passividade empata.
 */
export const INICIATIVA_ATAQUE = 1.2;

/**
 * Guarnição/milícia local que defende um bairro neutro (sem soldados de facção).
 * Escala com o risco do bairro — na mesma ordem de grandeza do poder de um
 * pequeno esquadrão, não do valorBase econômico.
 */
export function garrisonNeutro(risco: number): number {
  return 8 + risco * 0.2;
}

/**
 * Multiplicador de defesa de um soldado com job "Proteger" (postura defensiva).
 * Calibrado ACIMA do ponto de virada: proteger × casa (1.05) = 1.26 > iniciativa
 * do atacante (1.2). Consequência de design:
 *   - Território DESPROTEGIDO (tropa ociosa / em outro job) cai a um ataque no par.
 *   - Território PROTEGIDO segura o contra-ataque no par — pra tomar, o atacante
 *     precisa de vantagem de força.
 * Isso dá valor real ao job Proteger, deixa consolidar conquista viável (quem toma
 * e cava trincheira aguenta a retomada imediata) e não trava porque território
 * desguarnecido sempre pode ser tomado.
 */
export const BONUS_PROTEGER = 1.2;

/**
 * Redução da pressão de baixa sobre um soldado "guardado" (importante ou
 * protegendo) enquanto ainda há rank-and-file de pé pra servir de escudo.
 */
export const PROTEGIDO_REDUCAO = 0.25;

/** Colete: multiplicador na chance de o soldado ser atingido (reduz o dano). */
export const COLETE_REDUCAO = 0.6;

/** Soldado blindado: peça-chave ou em postura de proteção. Cai por último. */
export function ehGuardado(s: Soldado): boolean {
  return s.importante || s.jobAtual === 'proteger';
}

/** Poder defensivo de um soldado, com bônus se estiver protegendo o bairro. */
export function poderDefensivo(s: Soldado, arma: Arma | undefined): number {
  const base = poderEfetivo(s, arma);
  return s.jobAtual === 'proteger' ? base * BONUS_PROTEGER : base;
}

/** Modificador de poder por traço de personalidade. */
const MOD_TRACO: Record<Traco, number> = {
  leal: 1.1,
  ganancioso: 1.0,
  covarde: 0.85,
};

/** Só quem está de pé (ativo/ferido) participa e conta força. */
export function participaDeCombate(s: Soldado): boolean {
  return s.status === 'ativo' || s.status === 'ferido';
}

/** Poder efetivo = (brutalidade + edge + dano da arma) * traço * penalidade de ferimento. */
export function poderEfetivo(s: Soldado, arma: Arma | undefined): number {
  if (!participaDeCombate(s)) return 0;
  const base = s.forca + s.edge + (arma?.dano ?? 0);
  const feridoPenalidade = s.status === 'ferido' ? 0.5 : 1;
  return base * MOD_TRACO[s.traco] * feridoPenalidade;
}

function entre(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export interface Baixa {
  soldadoId: string;
  status: SoldadoStatus;
}

export interface ResultadoCombate {
  vencedor: 'atacante' | 'defensor';
  forcaAtaque: number;
  forcaDefesa: number;
  baixasAtacante: Baixa[];
  baixasDefensor: Baixa[];
}

/**
 * Aplica baixas a um lado. `pressao` (0-1) é a chance-base de cada soldado ser
 * atingido; `risco` (0-100) do bairro adiciona chance de prisão (batida policial).
 */
function calcularBaixas(
  soldados: Soldado[],
  pressao: number,
  risco: number,
  rng: Rng,
): Baixa[] {
  const baixas: Baixa[] = [];
  // Enquanto houver rank-and-file de pé, as peças-chave (importantes/protegidos)
  // ficam blindadas — o escudo humano leva o tiro primeiro.
  const temEscudo = soldados.some((s) => participaDeCombate(s) && !ehGuardado(s));
  for (const s of soldados) {
    if (!participaDeCombate(s)) continue;

    let pressaoEfetiva = ehGuardado(s) && temEscudo ? pressao * PROTEGIDO_REDUCAO : pressao;
    if (s.colete) pressaoEfetiva *= COLETE_REDUCAO; // colete segura parte do dano
    if (rng() < pressaoEfetiva) {
      // Atingido. Se já estava ferido, não resiste de novo.
      let status: SoldadoStatus;
      if (s.status === 'ferido') {
        status = 'morto';
      } else {
        status = rng() < 0.4 ? 'morto' : 'ferido';
      }
      baixas.push({ soldadoId: s.id, status });
      continue;
    }

    // Não foi atingido no tiroteio, mas pode cair na batida policial.
    if (rng() < (risco / 100) * 0.2) {
      baixas.push({ soldadoId: s.id, status: 'preso' });
    }
  }
  return baixas;
}

/**
 * Resolve um confronto. `armas` mapeia armaId -> Arma pra lookup de dano.
 * Se `defensores` estiver vazio, o bairro neutro ainda oferece uma guarnição mínima.
 */
export function resolverCombate(
  atacantes: Soldado[],
  defensores: Soldado[],
  bairro: Bairro,
  armas: Map<string, Arma>,
  rng: Rng = Math.random,
  /** Bônus extra multiplicativo no ataque (ex.: intel de espionagem). */
  bonusAtaque = 1,
): ResultadoCombate {
  const armaDe = (s: Soldado) => (s.armaId ? armas.get(s.armaId) : undefined);

  const somaAtaque = atacantes.reduce((acc, s) => acc + poderEfetivo(s, armaDe(s)), 0);
  // Defensores em postura de "proteger" rendem mais na defesa.
  const somaDefesa = defensores.reduce((acc, s) => acc + poderDefensivo(s, armaDe(s)), 0);

  const garrison = defensores.length === 0 ? garrisonNeutro(bairro.risco) : 0;

  const forcaAtaque = somaAtaque * INICIATIVA_ATAQUE * bonusAtaque * entre(rng, 0.85, 1.15);
  const forcaDefesa = (somaDefesa * VANTAGEM_CASA + garrison) * entre(rng, 0.85, 1.15);

  const vencedor: ResultadoCombate['vencedor'] =
    forcaAtaque >= forcaDefesa ? 'atacante' : 'defensor';

  // Combate apertado = mais baixas dos dois lados.
  const intensidade =
    Math.min(forcaAtaque, forcaDefesa) / Math.max(forcaAtaque, forcaDefesa, 1);
  const pressaoPerdedor = 0.55 + 0.4 * intensidade;
  const pressaoVencedor = 0.15 + 0.35 * intensidade;

  const baixasAtacante = calcularBaixas(
    atacantes,
    vencedor === 'atacante' ? pressaoVencedor : pressaoPerdedor,
    bairro.risco,
    rng,
  );
  const baixasDefensor = calcularBaixas(
    defensores,
    vencedor === 'defensor' ? pressaoVencedor : pressaoPerdedor,
    bairro.risco,
    rng,
  );

  return {
    vencedor,
    forcaAtaque: Math.round(forcaAtaque),
    forcaDefesa: Math.round(forcaDefesa),
    baixasAtacante,
    baixasDefensor,
  };
}

export interface ResultadoDriveBy {
  forcaAtaque: number;
  forcaDefesa: number;
  baixasAtacante: Baixa[];
  baixasDefensor: Baixa[];
}

/**
 * Drive-by: ataque-relâmpago motorizado. Fere/mata defensores mas NÃO toma o
 * território (bate e corre). A velocidade do carro turbina o ataque; a blindagem
 * reduz as baixas do próprio crew. Bom pra amolecer um alvo antes de invadir.
 */
export function resolverDriveBy(
  atacantes: Soldado[],
  defensores: Soldado[],
  bairro: Bairro,
  carro: Veiculo,
  armas: Map<string, Arma>,
  rng: Rng = Math.random,
): ResultadoDriveBy {
  const armaDe = (s: Soldado) => (s.armaId ? armas.get(s.armaId) : undefined);

  const somaAtaque =
    atacantes.reduce((acc, s) => acc + poderEfetivo(s, armaDe(s)), 0) * (1 + carro.velocidade * 0.06);
  const somaDefesa = defensores.reduce((acc, s) => acc + poderDefensivo(s, armaDe(s)), 0);
  const garrison = defensores.length === 0 ? garrisonNeutro(bairro.risco) : 0;
  const forcaDefesa = somaDefesa + garrison;

  const vantagem = somaAtaque / Math.max(forcaDefesa, 1);
  // Mais vantagem = mais baixas no alvo; blindagem protege quem está no carro.
  const pressaoDefensor = Math.min(0.85, 0.25 + 0.25 * vantagem);
  const pressaoAtacante = Math.max(0.05, 0.3 - carro.blindagem * 0.05);

  const baixasDefensor = calcularBaixas(defensores, pressaoDefensor, bairro.risco, rng);
  // Atacantes fogem no carro — sem risco de prisão local.
  const baixasAtacante = calcularBaixas(atacantes, pressaoAtacante, 0, rng);

  return {
    forcaAtaque: Math.round(somaAtaque),
    forcaDefesa: Math.round(forcaDefesa),
    baixasAtacante,
    baixasDefensor,
  };
}
