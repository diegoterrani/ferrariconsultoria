import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { PACOTES, isPacoteValido } from "@/lib/carteira/pacotes";
import { competenciaAtual } from "@/lib/carteira/periodo";

/**
 * POST /api/invoices/gerar-mes — "Gerar cobranças do mês" (spec seção 6.2):
 * uma cobrança por tenant ativo com pacote contratado, valor da tabela de
 * preços (seção 11). Idempotente por competência: um tenant que já tem
 * fatura no mês corrente é pulado, nunca duplicado — rodar o botão duas
 * vezes por engano não pode cobrar o cliente em dobro. Sem gateway de
 * pagamento no MVP (seção 7): fica `pendente`, marcado manualmente depois.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "staff") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };
  const competencia = competenciaAtual();

  const criadas = await withTenantContext(ctx, async (tx) => {
    const tenants = await tx.tenant.findMany({ where: { status: "ativo" } });
    const existentes = await tx.invoice.findMany({ where: { competencia }, select: { tenantId: true } });
    const tenantIdsComFatura = new Set(existentes.map((i: { tenantId: string }) => i.tenantId));

    const elegiveis = tenants.filter(
      (t: { pacoteContratado: string | null; id: string }) =>
        isPacoteValido(t.pacoteContratado) && !tenantIdsComFatura.has(t.id),
    ) as { id: string; pacoteContratado: string | null }[];

    const criadas = [];
    for (const tenant of elegiveis) {
      if (!isPacoteValido(tenant.pacoteContratado)) continue; // narrowing pro TS; já filtrado acima
      const invoice = await tx.invoice.create({
        data: {
          tenantId: tenant.id,
          competencia,
          valor: PACOTES[tenant.pacoteContratado].precoMensal,
          status: "pendente",
        },
      });
      criadas.push(invoice);
    }
    return criadas;
  });

  return NextResponse.json({ competencia, criadas }, { status: 201 });
}
