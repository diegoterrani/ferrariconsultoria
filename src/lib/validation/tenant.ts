import * as z from "zod";

import { validarCnpj } from "@/lib/cnpj";

/**
 * Edição de pacote/status do cliente na aba "Dados do cliente" de
 * /carteira/[id] (spec seção 6.2). Campos deliberadamente limitados a
 * pacoteContratado e status — razaoSocial/CNPJ/porte/segmento continuam sem
 * tela de *edição* nesta fatia (mudar isso é decisão de produto separada,
 * não um esquecimento); eles agora têm uma tela de *criação* própria (ver
 * `TenantCreateSchema` abaixo — auditoria de UX, set/2026), porque até
 * então o único jeito de um cliente existir na Carteira era ter passado
 * pelo wizard do B1 primeiro, o que não cobre o caso real de fechar um
 * cliente sem diagnóstico prévio.
 */
export const TenantPatchSchema = z.object({
  pacoteContratado: z.enum(["Básico", "Premium", "Implantação"]).nullable().optional(),
  status: z.enum(["ativo", "risco_churn", "encerrado"]).optional(),
});

export type TenantPatchInput = z.infer<typeof TenantPatchSchema>;

/**
 * Criação manual de cliente (POST /api/tenants) — mesmos 4 campos e mesmas
 * regras do passo 1 do wizard de diagnóstico (`Passo1Schema` em
 * `@/lib/validation/assessment.ts`: razaoSocial, cnpj validado por dígito
 * verificador, porte, segmento), sem `numColaboradores`/`unidades` — esses
 * dois são respostas do questionário de diagnóstico, não campos do modelo
 * `Tenant`. CNPJ é `@unique` no schema (`prisma/schema.prisma`): a rota
 * trata a violação dessa constraint como 409, não como 500 (ver
 * `src/app/api/tenants/route.ts`).
 */
export const TenantCreateSchema = z.object({
  razaoSocial: z.string().trim().min(2, "Informe a razão social."),
  cnpj: z.string().refine(validarCnpj, "CNPJ inválido — confira o dígito verificador."),
  porte: z.enum(["pequeno", "medio", "grande"]),
  segmento: z.enum(["restaurante", "hotel", "outro"]),
});

export type TenantCreateInput = z.infer<typeof TenantCreateSchema>;
