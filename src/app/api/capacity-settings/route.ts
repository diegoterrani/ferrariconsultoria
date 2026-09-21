import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { CapacitySchema } from "@/lib/validation/capacity";

/**
 * GET/PATCH /api/capacity-settings — linha singleton `id: 'default'` (spec
 * seção 6.2: "10h/semana, valor configurável... não deve ser hardcoded").
 * Sem tenant: é configuração interna da consultoria, não dado de cliente
 * (ver migration 0004, RLS restrita a admin/staff apenas por papel).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "staff") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };
  const settings = await withTenantContext(ctx, (tx) =>
    tx.capacitySettings.findUnique({ where: { id: "default" } }),
  );

  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "staff") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CapacitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };
  const updated = await withTenantContext(ctx, (tx) =>
    tx.capacitySettings.upsert({
      where: { id: "default" },
      create: { id: "default", horasPorSemana: parsed.data.horasPorSemana },
      update: { horasPorSemana: parsed.data.horasPorSemana },
    }),
  );

  return NextResponse.json(updated);
}
