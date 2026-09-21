import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { TimeEntrySchema } from "@/lib/validation/time-entry";

/**
 * POST /api/time-entries — modal global "+ Registrar horas" (spec seção
 * 6.2). tenantId no corpo é o CLIENTE em quem a hora foi gasta, não o
 * tenant da sessão (admin/staff sempre têm tenantId nulo na própria
 * sessão) — por isso o contexto de RLS usado é o da sessão (papel), e o
 * tenantId da linha vem do corpo já validado contra o enum/uuid do Zod,
 * nunca de um campo livre.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "staff") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = TimeEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { tenantId, atividade, horas, minutos, data } = parsed.data;

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  const entry = await withTenantContext(ctx, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return null;

    return tx.timeEntry.create({
      data: {
        tenantId,
        atividade,
        duracaoMinutos: horas * 60 + minutos,
        data: new Date(`${data}T00:00:00.000Z`),
      },
    });
  });

  if (!entry) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  return NextResponse.json(entry, { status: 201 });
}
