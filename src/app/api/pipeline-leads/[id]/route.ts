import { NextResponse } from "next/server";
import * as z from "zod";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

const EstagioSchema = z.object({
  estagio: z.enum(["contato", "reuniao", "diagnostico", "fechamento"]),
});

/**
 * PATCH /api/pipeline-leads/[id] — move um card entre colunas do Kanban
 * (spec seção 6.2: "arrastar entre colunas atualiza estagio"). Só o
 * estagio muda aqui; decisao/motivoDecisao/pacoteSugerido continuam
 * exclusivos do modal "Registrar decisão do cliente" no B1
 * (POST /api/pipeline-leads) — mover um card manualmente no board nunca
 * deve conseguir forjar uma decisão do cliente que não aconteceu.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "staff") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = EstagioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  const updated = await withTenantContext(ctx, async (tx) => {
    const atual = await tx.pipelineLead.findUnique({ where: { id } });
    if (!atual) return null;
    return tx.pipelineLead.update({ where: { id }, data: { estagio: parsed.data.estagio } });
  });

  if (!updated) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  return NextResponse.json(updated);
}
