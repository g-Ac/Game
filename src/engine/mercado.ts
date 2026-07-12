/**
 * Mercado Negro (estilo Respect 2) — ofertas que renovam a cada turno. Aqui tudo
 * é pago em cash (sem "Crowns"/IAP). Gera uma oferta de rua (armas com desconto) +
 * itens premium (carro pra drive-by, colete, soldado de elite).
 */

import type { MercadoItem, Veiculo } from '../types/game';
import type { Rng } from './combat';

/** Catálogo de carros (usados em drive-by). */
export const CARROS_CATALOGO: Veiculo[] = [
  { id: 'fusca', nome: 'Fusca Envenenado', lugares: 4, velocidade: 2, blindagem: 2 },
  { id: 'gol', nome: 'Gol Turbo', lugares: 4, velocidade: 4, blindagem: 1 },
  { id: 'brabo', nome: 'Brabo GT', lugares: 5, velocidade: 4, blindagem: 3 },
  { id: 'suv', nome: 'SUV Blindada', lugares: 6, velocidade: 2, blindagem: 5 },
];

const CUSTO_CARRO: Record<string, number> = { fusca: 5000, gol: 7000, brabo: 12000, suv: 16000 };

/** Preço/dano das armas ofertadas em lote na rua. */
const ARMAS_RUA: { id: string; nome: string; base: number }[] = [
  { id: 'pistola', nome: 'Pistola', base: 2500 },
  { id: 'escopeta', nome: 'Escopeta', base: 6000 },
  { id: 'fuzil', nome: 'Fuzil', base: 14000 },
];

export const CUSTO_COLETE = 2500;
export const CUSTO_ELITE = 8000;

function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Gera as ofertas do Mercado deste turno. Determinístico por `turno` + `rng`.
 * Sempre: 1 oferta de rua (armas em lote c/ desconto) + carro + colete + (elite | lote maior).
 */
export function gerarMercado(turno: number, rng: Rng = Math.random): MercadoItem[] {
  const itens: MercadoItem[] = [];

  // Oferta de rua: armas em lote com ~20% de desconto.
  const armaRua = pick(ARMAS_RUA, rng);
  const qtd = 2 + Math.floor(rng() * 3); // 2-4
  const custoRua = Math.round(armaRua.base * qtd * 0.8);
  itens.push({
    id: `m${turno}-rua`,
    tipo: 'arma',
    nome: `${qtd}× ${armaRua.nome}`,
    descricao: 'Oferta de rua — arma os mais fracos.',
    custo: custoRua,
    armaId: armaRua.id,
    quantidade: qtd,
  });

  // Carro (drive-by).
  const carro = pick(CARROS_CATALOGO, rng);
  itens.push({
    id: `m${turno}-carro`,
    tipo: 'carro',
    nome: carro.nome,
    descricao: `lugares ${carro.lugares} · vel ${carro.velocidade} · blind ${carro.blindagem}`,
    custo: CUSTO_CARRO[carro.id],
    veiculo: carro,
  });

  // Colete.
  itens.push({
    id: `m${turno}-colete`,
    tipo: 'colete',
    nome: 'Colete à prova de bala',
    descricao: 'Reduz o dano em combate (equipa o mais valioso sem colete).',
    custo: CUSTO_COLETE,
  });

  // Elite ou lote grande (alterna por turno).
  if (turno % 2 === 0) {
    itens.push({
      id: `m${turno}-elite`,
      tipo: 'elite',
      nome: 'Soldado de Elite',
      descricao: 'Capanga forte já treinado, entra no seu QG.',
      custo: CUSTO_ELITE,
    });
  } else {
    itens.push({
      id: `m${turno}-lote`,
      tipo: 'arma',
      nome: '5× Fuzil',
      descricao: 'Lote pesado — arma os 5 mais fracos.',
      custo: Math.round(14000 * 5 * 0.85),
      armaId: 'fuzil',
      quantidade: 5,
    });
  }

  return itens;
}
