import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { PACOTES, isPacoteValido } from "@/lib/carteira/pacotes";
import { competenciaAtual } from "@/lib/carteira/periodo";

/**
 * GET /api/invoices/preview-mes — prévia pro modal de confirmação de
 * "Gerar cobranças do mês" (spec seção 6.2: "Isso vai gerar N cobranças
 * para M clientes ativos. Confirmar?" — a UI precisa saber N e M ANTES de
 * confirmar, não só depois). Mesma regra de elegibilidade do POST
 * gerar-mes (ver esse arquivo) — se um dia divergirem, o modal mente.
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
  const competencia = competenciaAtual();

  const elegiveis = await withTenantContext(ctx, async (tx) => {
    const tenants = await tx.tenant.findMany({ where: { status: "ativo" } });
    const existentes = await tx.invoice.findMany({ where: { competencia }, select: { tenantId: true } });
    const tenantIdsComFatura = new Set(existentes.map((i: { tenantId: string }) => i.tenantId));

    return tenants.filter(
      (t: { pacoteContratado: string | null; id: string }) =>
        isPacoteValido(t.pacoteContratado) && !tenantIdsComFatura.has(t.id),
    );
  });

  const tenantsElegiveis = elegiveis as { id: string; razaoSocial: string; pacoteContratado: string | null }[];

  return NextResponse.json({
    competencia,
    count: tenantsElegiveis.length,
    tenants: tenantsElegiveis.map((t) => ({
      id: t.id,
      razaoSocial: t.razaoSocial,
      valor: isPacoteValido(t.pacoteContratado) ? PACOTES[t.pacoteContratado].precoMensal : 0,
    })),
  });
}
