import { NextResponse } from "next/server";
import * as z from "zod";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { Passo2Schema, Passo3Schema } from "@/lib/validation/assessment";

const PatchSchema = z.object({
  step2: Passo2Schema.optional(),
  step3: Passo3Schema.optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET — carrega o assessment (retomar o wizard, ou popular a página de
 * resultado). PATCH — autosave dos passos 2 e 3 (spec seção 6.1), faz merge
 * raso dentro do jsonb `respostas` em vez de sobrescrever o campo inteiro,
 * pra nunca perder o passo 1 já salvo.
 *
 * Isolamento de tenant (teste obrigatório #1, spec seção 9): passar
 * `withTenantContext` com o papel da sessão é o que ativa a RLS — um
 * client_owner nunca chega aqui (só admin/staff autenticam nesta fatia),
 * mas a policy do banco é a rede de segurança mesmo assim, não só este
 * `if`.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;

  const assessment = await withTenantContext(
    { role: session.user.role, tenantId: session.user.tenantId },
    (tx) => tx.assessment.findUnique({ where: { id }, include: { tenant: true } }),
  );

  if (!assessment) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }

  return NextResponse.json(assessment);
}

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
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  const updated = await withTenantContext(ctx, async (tx) => {
    const atual = await tx.assessment.findUnique({ where: { id } });
    if (!atual) return null;

    const respostas = { ...(atual.respostas as object), ...parsed.data };
    return tx.assessment.update({ where: { id }, data: { respostas } });
  });

  if (!updated) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }

  return NextResponse.json(updated);
}
