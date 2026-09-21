import { NextResponse } from "next/server";
import * as z from "zod";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { calcularScoreExposicaoTrabalhista } from "@/lib/scoring/exposicao-trabalhista";
import { Passo2Schema, Passo3Schema, Passo1Schema } from "@/lib/validation/assessment";

const SubmitSchema = z.object({ step3: Passo3Schema });

const RespostasCompletasSchema = z.object({
  step1: Passo1Schema,
  step2: Passo2Schema,
  step3: Passo3Schema,
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/assessments/[id]/submit — botão "Calcular diagnóstico" (spec
 * seção 6.1). Faz o merge final do passo 3, então roda a função
 * determinística de scoring (lib/scoring/exposicao-trabalhista.ts) — nunca
 * IA, nunca não-determinístico, é o teste obrigatório #3.
 *
 * Recusa calcular se step1/step2 não estiverem completos: o botão só fica
 * habilitado no cliente com o wizard completo, mas a API nunca confia só
 * nisso (mesmo princípio de "Comandos Exatos, Alvos Exatos" — validação no
 * mesmo lugar onde o dado é usado, não só onde é exibido).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "staff") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsedBody = SubmitSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
  }

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  const resultado = await withTenantContext(ctx, async (tx) => {
    const atual = await tx.assessment.findUnique({ where: { id } });
    if (!atual) return { kind: "not_found" as const };

    const respostasMescladas = { ...(atual.respostas as object), step3: parsedBody.data.step3 };
    const parsedCompleto = RespostasCompletasSchema.safeParse(respostasMescladas);
    if (!parsedCompleto.success) {
      return { kind: "incompleto" as const, detalhe: parsedCompleto.error.flatten() };
    }

    const { step2, step3 } = parsedCompleto.data;
    const score = calcularScoreExposicaoTrabalhista({
      regime: step3.regime,
      gestaoGorjetas: step3.gestaoGorjetas,
      bancoDeHoras: step3.bancoDeHoras,
      historicoFiscalizacao: step2.historicoFiscalizacao,
      rhFormalizado: step2.rhFormalizado,
      rotatividadePercebida: step2.rotatividadePercebida as 1 | 2 | 3 | 4 | 5,
    });

    const assessment = await tx.assessment.update({
      where: { id },
      data: {
        respostas: respostasMescladas,
        scoreExposicao: score.score,
        status: "concluido",
      },
    });

    return { kind: "ok" as const, assessment, score };
  });

  if (resultado.kind === "not_found") {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }
  if (resultado.kind === "incompleto") {
    return NextResponse.json(
      { error: "Passos anteriores do wizard incompletos.", detalhe: resultado.detalhe },
      { status: 422 },
    );
  }

  return NextResponse.json({
    id: resultado.assessment.id,
    scoreExposicao: resultado.score.score,
    fatores: resultado.score.fatores,
  });
}
