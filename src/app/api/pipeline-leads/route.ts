import { NextResponse } from "next/server";
import * as z from "zod";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { isPacoteValido } from "@/lib/carteira/pacotes";

/**
 * POST /api/pipeline-leads — modal "Registrar decisão do cliente" na página
 * de resultado do diagnóstico (spec seção 6.1). Cria ou atualiza (upsert
 * por assessmentId) o registro em pipeline_leads que alimenta o Kanban do
 * módulo B6 (seção 6.2).
 *
 * `estagio` não é escolhido pelo usuário aqui — é derivado da decisão
 * (aceite → fechamento, recusa/não agora → diagnostico). A ordem das
 * colunas do Kanban tem significado de negócio e não é reordenável pelo
 * usuário (seção 6.2); mover automaticamente pra fechamento só no aceite
 * respeita essa mesma regra.
 *
 * Ponte B1→B6 (decisão de implementação, a spec não resolve isso
 * explicitamente): "aceite" é o único evento de todo o sistema que faz um
 * tenant virar cliente de carteira de verdade — por isso é aqui, e só
 * aqui, que `tenants.pacoteContratado` é gravado, a partir do pacote
 * sugerido no momento do aceite. Sem isso, nenhum tenant jamais teria
 * pacote, e o painel /carteira nunca teria dado pra mostrar. Fica editável
 * depois em /carteira/[id] (PATCH /api/tenants/[id]) — isto aqui é só o
 * valor inicial no fechamento.
 */
const DecisaoSchema = z.object({
  assessmentId: z.uuid(),
  decisao: z.enum(["aceite", "recusa", "nao_agora"]),
  motivoDecisao: z.string().trim().optional(),
  pacoteSugerido: z.enum(["Básico", "Premium", "Implantação"]).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "staff") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = DecisaoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { assessmentId, decisao, motivoDecisao, pacoteSugerido } = parsed.data;

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  const resultado = await withTenantContext(ctx, async (tx) => {
    const assessment = await tx.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) return null;

    const estagio = decisao === "aceite" ? "fechamento" : "diagnostico";
    const existente = await tx.pipelineLead.findFirst({ where: { assessmentId } });

    if (decisao === "aceite" && isPacoteValido(pacoteSugerido ?? null)) {
      await tx.tenant.update({
        where: { id: assessment.tenantId },
        data: { pacoteContratado: pacoteSugerido },
      });
    }

    if (existente) {
      return tx.pipelineLead.update({
        where: { id: existente.id },
        data: { decisao, motivoDecisao, pacoteSugerido, estagio },
      });
    }

    return tx.pipelineLead.create({
      data: {
        tenantId: assessment.tenantId,
        assessmentId,
        decisao,
        motivoDecisao,
        pacoteSugerido,
        estagio,
      },
    });
  });

  if (!resultado) {
    return NextResponse.json({ error: "Assessment não encontrado." }, { status: 404 });
  }

  return NextResponse.json(resultado, { status: 201 });
}
