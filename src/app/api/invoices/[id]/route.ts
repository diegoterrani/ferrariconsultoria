import { NextResponse } from "next/server";
import * as z from "zod";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

const StatusSchema = z.object({ status: z.enum(["pendente", "pago", "atrasado"]) });

/**
 * PATCH /api/invoices/[id] — marcação manual de pago/pendente/atrasado
 * (spec seção 6.2 e 7: "sem gateway de pagamento no MVP... a cobrança é
 * registrada e marcada manualmente como paga/pendente/atrasada").
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
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  const updated = await withTenantContext(ctx, async (tx) => {
    const atual = await tx.invoice.findUnique({ where: { id } });
    if (!atual) return null;
    return tx.invoice.update({ where: { id }, data: { status: parsed.data.status } });
  });

  if (!updated) {
    return NextResponse.json({ error: "Cobrança não encontrada." }, { status: 404 });
  }

  return NextResponse.json(updated);
}
