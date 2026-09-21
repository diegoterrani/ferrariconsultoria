import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { TenantPatchSchema } from "@/lib/validation/tenant";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/tenants/[id] — aba "Dados do cliente" de /carteira/[id] (spec
 * seção 6.2): editar pacote contratado e status manualmente. Complementa o
 * preenchimento automático de `pacoteContratado` no aceite do B1
 * (POST /api/pipeline-leads) — este endpoint é o ajuste manual depois
 * (upgrade de pacote, marcar risco de churn, encerrar contrato).
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
  const parsed = TenantPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  const updated = await withTenantContext(ctx, async (tx) => {
    const atual = await tx.tenant.findUnique({ where: { id } });
    if (!atual) return null;
    return tx.tenant.update({ where: { id }, data: parsed.data });
  });

  if (!updated) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  return NextResponse.json(updated);
}
