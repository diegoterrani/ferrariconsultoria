/**
 * Bucketing de semanas (segunda a segunda, UTC) para o painel de capacidade
 * (spec seção 6.2: "horas comprometidas por cliente, semana a semana").
 */

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Segunda-feira 00:00 UTC da semana que contém `data`. */
export function inicioSemanaUTC(data: Date): Date {
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  const diaDaSemana = d.getUTCDay(); // 0 = domingo
  const deslocamento = diaDaSemana === 0 ? 6 : diaDaSemana - 1; // dias desde a última segunda
  d.setUTCDate(d.getUTCDate() - deslocamento);
  return d;
}

/** N segundas-feiras consecutivas, mais antiga primeiro, terminando na semana de `referencia`. */
export function ultimasNSemanas(n: number, referencia = new Date()): Date[] {
  const inicioAtual = inicioSemanaUTC(referencia);
  const semanas: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    semanas.push(new Date(inicioAtual.getTime() - i * 7 * UM_DIA_MS));
  }
  return semanas;
}

export function rotuloSemana(inicioSemana: Date): string {
  return inicioSemana.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}
