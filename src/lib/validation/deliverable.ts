import * as z from "zod";

/**
 * Módulo C1 — validação das duas operações da página /entregaveis/[id]
 * (spec seção 6.3), deliberadamente separadas em schemas `.strict()`
 * distintos:
 *
 * - Editar conteúdo (rich-text livre) nunca deve, na mesma requisição,
 *   também poder mudar o `status` — mistura essas duas responsabilidades
 *   tornaria a máquina de estados (spec 8.3, teste obrigatório #2 da seção
 *   9) mais difícil de auditar e testar isoladamente.
 * - `.strict()` em vez do padrão "strip" do Zod: um corpo com campo extra
 *   (ex.: tentando mandar `conteudo` e `status` juntos) é rejeitado com 400
 *   em vez de ter o campo extra silenciosamente descartado — elimina
 *   ambiguidade sobre o que a requisição realmente pediu.
 */

export const TipoEntregavelSchema = z.enum(["descricao_cargo", "politica_interna", "material_onboarding"]);

export const CreateDeliverableSchema = z
  .object({
    tenantId: z.uuid(),
    tipo: TipoEntregavelSchema,
    templateBaseId: z.string().min(1),
    /** Opcional — nem todo entregável nasce a partir de um assessment (spec C1.2.a). */
    assessmentId: z.uuid().optional(),
  })
  .strict();

const EditarConteudoSchema = z
  .object({
    conteudo: z.string().min(1),
  })
  .strict();

const TransicaoStatusSchema = z
  .object({
    status: z.enum(["em_revisao", "aprovado", "enviado"]),
    /** Spec C1.3.a — só relevante na transição para "aprovado"; ignorado nas demais. */
    tempoManualEstimadoMinutos: z.coerce.number().int().min(0).max(1440).optional(),
  })
  .strict();

export const UpdateDeliverableSchema = z.union([EditarConteudoSchema, TransicaoStatusSchema]);

export type CreateDeliverableInput = z.infer<typeof CreateDeliverableSchema>;
export type UpdateDeliverableInput = z.infer<typeof UpdateDeliverableSchema>;
