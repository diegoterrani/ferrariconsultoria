import * as z from "zod";

/**
 * Validação do registro de horas (spec seção 6.2, modal global "+
 * Registrar horas"). horas/minutos chegam separados do cliente (dois
 * inputs numéricos) para não precisar parsear "HH:MM" livre no servidor —
 * a duração final em minutos é derivada aqui, único lugar que faz essa
 * conta.
 */
export const TimeEntrySchema = z.object({
  tenantId: z.uuid(),
  atividade: z.enum(["entrega", "prospeccao", "administrativo"]),
  horas: z.coerce.number().int().min(0).max(23),
  minutos: z.coerce.number().int().min(0).max(59),
  data: z.iso.date(),
});

export type TimeEntryInput = z.infer<typeof TimeEntrySchema>;
