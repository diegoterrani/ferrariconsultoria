import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { UpdateDeliverableSchema } from "@/lib/validation/deliverable";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Máquina de estados (spec 8.3 / teste obrigatório #2, seção 9): cada
 * status só avança para o próximo da sequência, nunca pula, nunca
 * retrocede. Tabela explícita em vez de comparação numérica de índice —
 * mais fácil de auditar e de testar cada transição isoladamente.
 */
const PROXIMO_ESTADO: Record<string, string | undefined> = {
  rascunho: "em_revisao",
  em_revisao: "aprovado",
  aprovado: "enviado",
  enviado: undefined,
};

/**
 * PATCH /api/deliverables/[id] — a página /entregaveis/[id] (spec seção
 * 6.3) usa esta rota tanto para editar o conteúdo livremente quanto para
 * avançar o estágio; os dois nunca acontecem na mesma requisição (ver
 * validation/deliverable.ts).
 *
 * "aprovado → enviado" nesta fatia é só o registro do estágio, não um
 * disparo automático de e-mail — o portal do cliente (módulo A1) e a
 * automação de notificação (spec seção 7) estão fora do MVP. "Enviado"
 * aqui significa que a administradora já entregou o documento por fora do
 * sistema (e-mail manual, download) e está registrando isso — mesmo
 * princípio de honestidade de escopo já aplicado ao faturamento do B6
 * (cobrança registrada, não temos gateway de pagamento).
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
  const parsed = UpdateDeliverableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  const resultado = await withTenantContext(ctx, async (tx) => {
    const atual = await tx.deliverable.findUnique({ where: { id } });
    if (!atual) return { tipo: "nao_encontrado" } as const;

    if ("conteudo" in parsed.data) {
      if (atual.status === "aprovado" || atual.status === "enviado") {
        return {
          tipo: "estado_invalido",
          motivo: `Conteúdo não pode ser editado depois de aprovado (status atual: "${atual.status}") — evita invalidar uma aprovação já dada silenciosamente.`,
        } as const;
      }
      const atualizado = await tx.deliverable.update({
        where: { id },
        data: { conteudo: parsed.data.conteudo },
      });
      return { tipo: "ok", deliverable: atualizado } as const;
    }

    // Transição de estágio — a máquina de estados que o teste obrigatório
    // #2 verifica: nenhum pulo, mesmo chamando a API direto (spec seção 9).
    const proximoEsperado = PROXIMO_ESTADO[atual.status];
    if (proximoEsperado !== parsed.data.status) {
      return {
        tipo: "estado_invalido",
        motivo: proximoEsperado
          ? `Transição de "${atual.status}" para "${parsed.data.status}" não é permitida — o único próximo estágio válido é "${proximoEsperado}".`
          : `Este entregável já está no estágio final ("${atual.status}") e não pode avançar mais.`,
      } as const;
    }

    const atualizado = await tx.deliverable.update({
      where: { id },
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === "aprovado" && parsed.data.tempoManualEstimadoMinutos !== undefined
          ? { tempoManualEstimadoMinutos: parsed.data.tempoManualEstimadoMinutos }
          : {}),
      },
    });
    return { tipo: "ok", deliverable: atualizado } as const;
  });

  if (resultado.tipo === "nao_encontrado") {
    return NextResponse.json({ error: "Entregável não encontrado." }, { status: 404 });
  }
  if (resultado.tipo === "estado_invalido") {
    return NextResponse.json({ error: resultado.motivo }, { status: 409 });
  }

  return NextResponse.json(resultado.deliverable);
}
