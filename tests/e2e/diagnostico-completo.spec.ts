import { test } from "@playwright/test";

/**
 * Teste obrigatório #4 (especificacao_plataforma_dev.md, seção 9): "do
 * preenchimento do wizard de 3 passos até o download do PDF de resultado,
 * cobrindo o caminho mais usado da plataforma no dia a dia da fundadora."
 *
 * STATUS HONESTO: o wizard /assessments/novo (spec seção 6.1) ainda não
 * existe — este arquivo é o placeholder que documenta a obrigação, não uma
 * simulação de passar. `test.fixme` faz o Playwright listar o teste como
 * pendente sem contá-lo como falha nem como sucesso no pipeline de CI.
 */
test.fixme(
  "wizard de diagnóstico: 3 passos → cálculo do score → download do PDF de resultado",
  async () => {
    // Implementar junto com o módulo B1 (PRD, Prioridade 1):
    // 1. Navegar para /assessments/novo
    // 2. Preencher os 3 passos (dados cadastrais, mapeamento de dores, jornada/escala)
    // 3. Confirmar "Avançar" desabilitado até campos obrigatórios preenchidos
    // 4. Submeter e chegar em /assessments/[id]/resultado
    // 5. Abrir o modal de preview do PDF e confirmar o download
  },
);
