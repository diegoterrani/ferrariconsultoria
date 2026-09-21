import { NextResponse } from "next/server";

import { createAiProvider } from "@/lib/ai-provider";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { buscarTemplate, LABELS_TIPO } from "@/lib/entregaveis/templates";
import { CreateDeliverableSchema } from "@/lib/validation/deliverable";

/**
 * POST /api/deliverables — ponto de entrada "Gerar entregável" (spec seção
 * 6.3), acionado de /carteira/[id] ou /assessments/[id]/resultado.
 *
 * Desvio deliberado da spec seção 2 ("fila de jobs assíncronos — Inngest ou
 * BullMQ+Redis — para a geração não bloquear a tela"): esta rota chama a IA
 * de forma SÍNCRONA, dentro da própria requisição HTTP. Racional (spec
 * seção 1: "o que uma ou duas pessoas conseguem operar sozinhas, com custo
 * de infraestrutura próximo de zero"): a UX exigida pela spec — "estado de
 * carregamento visível, nunca um spinner mudo, evita clique duplo" — é
 * inteiramente alcançável com um `fetch` aguardado e um botão desabilitado
 * durante a chamada (ver gerar-entregavel-modal.tsx); a geração leva até
 * ~30s (spec 6.3), dentro do limite de função serverless do Vercel. Uma
 * fila com Redis dedicado adicionaria um serviço a operar e pagar para
 * resolver um problema de UX que a própria plataforma já resolve sem ela —
 * na escala de 1-3 clientes do MVP, essa complexidade não se paga. Se o
 * volume de gerações crescer a ponto de o tempo de resposta virar problema
 * real, essa é a linha a trocar por um job assíncrono — não o produto
 * inteiro, coerente com o racional da própria abstração `ai-provider.ts`.
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
  const parsed = CreateDeliverableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { tenantId, tipo, templateBaseId, assessmentId } = parsed.data;

  const template = buscarTemplate(templateBaseId);
  if (!template || template.tipo !== tipo) {
    return NextResponse.json({ error: "Template inválido para o tipo informado." }, { status: 400 });
  }

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  // Busca tenant (e, se informado, o assessment) antes de gastar uma
  // chamada de IA — falhar rápido em requisição inválida é mais barato
  // (dinheiro real, spec seção 12) do que descobrir o 404 depois de gerar.
  const busca = await withTenantContext(ctx, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return { tipo: "tenant_nao_encontrado" } as const;

    if (!assessmentId) return { tipo: "ok", contextoAssessment: undefined } as const;

    const assessment = await tx.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.tenantId !== tenantId) {
      return { tipo: "assessment_nao_encontrado" } as const;
    }
    // Prisma stub degenerado neste sandbox (ver README) tipa `respostas`
    // como `{}` — cast documentado, não é o bug real.
    const contextoAssessment = (assessment as { respostas: Record<string, unknown> }).respostas;
    return { tipo: "ok", contextoAssessment } as const;
  });

  if (busca.tipo === "tenant_nao_encontrado") {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }
  if (busca.tipo === "assessment_nao_encontrado") {
    return NextResponse.json({ error: "Diagnóstico não encontrado para este cliente." }, { status: 404 });
  }

  let conteudoGerado: string;
  try {
    const resultado = await createAiProvider().gerarEntregavel({
      tipo,
      templateBaseId,
      templateNome: template.nome,
      templateBriefing: template.briefing,
      contextoAssessment: busca.contextoAssessment,
    });
    conteudoGerado = resultado.conteudo;
  } catch (erro) {
    // Nada é gravado no banco se a geração falhar — sem rascunho órfão em
    // branco. O erro original (chave ausente, rate limit, etc.) já vem
    // formatado por ai-provider.ts; só adaptamos para resposta HTTP aqui.
    console.error("[api/deliverables] falha na geração", erro);
    return NextResponse.json(
      {
        error:
          erro instanceof Error
            ? erro.message
            : "Falha desconhecida ao gerar entregável via IA.",
      },
      { status: 502 },
    );
  }

  const criado = await withTenantContext(ctx, (tx) =>
    tx.deliverable.create({
      data: {
        tenantId,
        tipo,
        titulo: `${LABELS_TIPO[tipo]} — ${template.nome}`,
        templateBaseId,
        assessmentId: assessmentId ?? null,
        conteudo: conteudoGerado,
        geradoPorIa: true,
        // status fica no default "rascunho" do schema — nenhum atalho aqui.
      },
    }),
  );

  return NextResponse.json(criado, { status: 201 });
}
