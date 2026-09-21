import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { Passo1Schema } from "@/lib/validation/assessment";

/**
 * POST /api/assessments — cria o registro a partir do passo 1 do wizard
 * (spec seção 6.1: "autosave a cada mudança de passo" — este é o primeiro
 * ponto de save, disparado ao avançar do passo 1 pro passo 2).
 *
 * Upsert de Tenant por CNPJ: reabrir um diagnóstico pra uma empresa já
 * cadastrada (mesmo CNPJ) reaproveita o tenant em vez de duplicar — decisão
 * registrada em prisma/schema.prisma, comentário do model Assessment.
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
  const parsed = Passo1Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const step1 = parsed.data;
  const cnpjLimpo = step1.cnpj.replace(/\D/g, "");

  const assessment = await withTenantContext(
    { role: session.user.role, tenantId: session.user.tenantId },
    async (tx) => {
      const tenant = await tx.tenant.upsert({
        where: { cnpj: cnpjLimpo },
        create: {
          razaoSocial: step1.razaoSocial,
          cnpj: cnpjLimpo,
          porte: step1.porte,
          segmento: step1.segmento,
        },
        update: {
          razaoSocial: step1.razaoSocial,
          porte: step1.porte,
          segmento: step1.segmento,
        },
      });

      return tx.assessment.create({
        data: {
          tenantId: tenant.id,
          respostas: { step1 },
          status: "rascunho",
        },
      });
    },
  );

  return NextResponse.json({ id: assessment.id, tenantId: assessment.tenantId }, { status: 201 });
}
