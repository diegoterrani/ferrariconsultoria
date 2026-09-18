/**
 * Camada de abstração para IA generativa (módulo C1).
 *
 * Fonte: especificacao_plataforma_dev.md, seção 2 — "a abstração própria
 * existe para não travar a plataforma a um único fornecedor — trocar de
 * provedor no futuro deve significar reescrever um arquivo, não o produto
 * inteiro." Nenhum outro módulo deve importar `@anthropic-ai/sdk`
 * diretamente — sempre via este arquivo.
 *
 * Dependência: @anthropic-ai/sdk. Justificativa: SDK oficial, tipado,
 * mantido pelo fornecedor da API já escolhida (spec seção 2, "qualidade de
 * geração em português"). Ainda não adicionada ao package.json — este
 * arquivo é o contrato que o time implementa quando o módulo C1 entrar em
 * desenvolvimento; a interface abaixo é o que já pode ser decidido agora,
 * sem custo de infraestrutura.
 */

export interface GeracaoEntregavelInput {
  tipo: "descricao_cargo" | "politica_interna" | "material_onboarding";
  templateBaseId: string;
  /** Respostas do assessment (B1.1) usadas para personalizar o rascunho — spec C1.2.a. */
  contextoAssessment?: Record<string, unknown>;
}

export interface GeracaoEntregavelOutput {
  conteudo: string;
  /** Nunca true automaticamente — revisão humana é obrigatória (spec 8.3). */
  aprovadoAutomaticamente: false;
}

export interface AiProvider {
  gerarEntregavel(input: GeracaoEntregavelInput): Promise<GeracaoEntregavelOutput>;
}

/**
 * Implementação real fica para quando o módulo C1 entrar em desenvolvimento
 * (não é parte do esqueleto de infraestrutura). Lançar aqui em vez de
 * silenciosamente retornar vazio é intencional: uma rota que chamar isso
 * antes da hora falha de forma óbvia, não com um entregável em branco.
 */
export function createAiProvider(): AiProvider {
  return {
    async gerarEntregavel() {
      throw new Error(
        "AiProvider ainda não implementado — módulo C1 (spec PRD, Prioridade 1). " +
          "Ver lib/ai-provider.ts.",
      );
    },
  };
}
