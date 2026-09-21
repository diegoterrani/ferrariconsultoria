import * as z from "zod";

/**
 * Edição de pacote/status do cliente na aba "Dados do cliente" de
 * /carteira/[id] (spec seção 6.2). Campos deliberadamente limitados a
 * pacoteContratado e status — razaoSocial/CNPJ/porte/segmento vêm do
 * cadastro feito no wizard do B1 (spec seção 6.1) e não têm tela de edição
 * nesta fatia; mudar isso é decisão de produto, não um esquecimento.
 */
export const TenantPatchSchema = z.object({
  pacoteContratado: z.enum(["Básico", "Premium", "Implantação"]).nullable().optional(),
  status: z.enum(["ativo", "risco_churn", "encerrado"]).optional(),
});

export type TenantPatchInput = z.infer<typeof TenantPatchSchema>;
