/**
 * Formatação de dinheiro SEM Intl. O Hermes (motor JS do RN) no iOS não suporta
 * `Number.toLocaleString('pt-BR')` de forma confiável — chega a lançar exceção e
 * derrubar o app. Aqui usamos separador de milhar manual (ponto), à prova de bala.
 */
export function dinheiro(n: number): string {
  const round = Math.round(Number.isFinite(n) ? n : 0);
  const neg = round < 0;
  const s = Math.abs(round)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + s;
}
