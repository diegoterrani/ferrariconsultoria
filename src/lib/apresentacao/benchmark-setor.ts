/**
 * Benchmark estático de rotatividade do setor (spec seção 6.1: "dado
 * estático, atualizável só por quem tem acesso admin"). Única fonte de
 * verdade — usado tanto pela tela `/assessments/[id]/resultado` quanto
 * pela geração do PDF (`src/lib/relatorio/relatorio-pdf.ts`), que não pode
 * divergir do que a tela mostra.
 *
 * Fica em código nesta fatia — vira campo editável via UI admin quando essa
 * tela existir; não é escopo desta.
 */
export const BENCHMARK_ROTATIVIDADE_SETOR = 77.6;
