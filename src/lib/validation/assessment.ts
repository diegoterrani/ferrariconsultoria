import * as z from "zod";

import { validarCnpj } from "@/lib/cnpj";

/**
 * Validação dos 3 passos do wizard de diagnóstico (spec seção 6.1).
 * Compartilhada entre cliente (habilitar/desabilitar "Avançar") e servidor
 * (a API nunca confia só na validação do formulário — mesmo princípio de
 * segurança aplicado a dado, não só a autenticação).
 */

export const Passo1Schema = z.object({
  razaoSocial: z.string().trim().min(2, "Informe a razão social."),
  cnpj: z
    .string()
    .refine(validarCnpj, "CNPJ inválido — confira o dígito verificador."),
  porte: z.enum(["pequeno", "medio", "grande"]),
  numColaboradores: z.coerce.number().int().min(1),
  unidades: z.array(z.string().trim().min(1)).min(1, "Adicione ao menos uma unidade."),
  segmento: z.enum(["restaurante", "hotel", "outro"]),
});

export const Passo2Schema = z.object({
  rotatividadePercebida: z.coerce.number().int().min(1).max(5),
  historicoFiscalizacao: z.boolean(),
  historicoFiscalizacaoDetalhe: z.string().trim().optional(),
  rhFormalizado: z.boolean(),
});

export const Passo3Schema = z.object({
  regime: z.enum(["12x36", "6x1", "outro"]),
  regimeDetalhe: z.string().trim().optional(),
  gestaoGorjetas: z.enum(["formal", "informal", "nao_ha"]),
  bancoDeHoras: z.boolean(),
});

export type Passo1 = z.infer<typeof Passo1Schema>;
export type Passo2 = z.infer<typeof Passo2Schema>;
export type Passo3 = z.infer<typeof Passo3Schema>;

export const RespostasWizardSchema = z.object({
  step1: Passo1Schema.optional(),
  step2: Passo2Schema.optional(),
  step3: Passo3Schema.optional(),
});

export type RespostasWizard = z.infer<typeof RespostasWizardSchema>;
