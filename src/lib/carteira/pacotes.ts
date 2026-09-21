/**
 * Pacotes comerciais (spec seção 11 — tabela de preços) e as horas mensais
 * que cada um inclui, usado pelo painel /carteira (barra de progresso de
 * horas) e por /carteira/faturamento (valor da cobrança).
 *
 * As chaves aqui são as mesmas 3 usadas desde o módulo B1
 * (`ResultadoInterativo`, `pipelineLeads.pacoteSugerido` — spec seção 6.1:
 * "Básico/Premium/Implantação") para não introduzir uma segunda
 * nomenclatura: "Básico" = "On Demand Básico" da seção 11, "Premium" = "On
 * Demand Premium", "Implantação" = "Implantação completa". "Diagnóstico
 * inicial" não entra aqui — é a cobrança avulsa do próprio B1, não um
 * pacote recorrente que um tenant "contrata" na carteira.
 *
 * horasIncluidas null = pacote sem alocação mensal fixa (Implantação é
 * projeto de 3-6 meses, não horas/mês) — o painel de carteira mostra
 * "sem horas mensais contratadas" em vez de tentar uma barra de progresso
 * sem denominador.
 */
export const PACOTES = {
  Básico: { precoMensal: 2800, horasIncluidas: 20 },
  Premium: { precoMensal: 4800, horasIncluidas: 40 },
  Implantação: { precoMensal: 12000, horasIncluidas: null },
} as const;

export type NomePacote = keyof typeof PACOTES;

export function isPacoteValido(valor: string | null): valor is NomePacote {
  return valor !== null && valor in PACOTES;
}
