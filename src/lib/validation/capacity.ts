import * as z from "zod";

/** PATCH da capacidade semanal (spec seção 6.2: "valor configurável"). */
export const CapacitySchema = z.object({
  horasPorSemana: z.coerce.number().int().min(1).max(168),
});
