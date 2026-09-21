/**
 * Limites de mês corrente em UTC, usado por /carteira (horas do mês) e
 * /carteira/faturamento (competência do mês). UTC porque `time_entries.data`
 * é gravado à meia-noite UTC (ver src/app/api/time-entries/route.ts) — usar
 * o fuso local do servidor aqui criaria um descompasso de até um dia perto
 * da virada do mês.
 */
export function inicioFimMesCorrente(referencia = new Date()): { inicio: Date; fim: Date } {
  const inicio = new Date(Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), 1));
  const fim = new Date(Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth() + 1, 1));
  return { inicio, fim };
}

/** "2026-09" — usado como `invoices.competencia`. */
export function competenciaAtual(referencia = new Date()): string {
  const ano = referencia.getUTCFullYear();
  const mes = String(referencia.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}
