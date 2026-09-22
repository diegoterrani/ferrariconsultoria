import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { TenantCreateSchema } from "@/lib/validation/tenant";

/**
 * POST /api/tenants — cadastro manual de cliente (auditoria de UX,
 * set/2026: até esta mudança o único jeito de um `Tenant` existir era o
 * upsert por CNPJ dentro de POST /api/assessments, ou seja, cliente só
 * entrava na Carteira depois de passar pelo wizard de diagnóstico inteiro —
 * não cobre fechar um cliente sem diagnóstico prévio). `status` sai sempre
 * "ativo" (default do schema) e `pacoteContratado` sai `null`: os dois têm
 * tela de edição própria em /carteira/[id] (`PATCH /api/tenants/[id]`),
 * então não precisam ser decididos no momento do cadastro.
 *
 * Checa CNPJ duplicado explicitamente (`findUnique` antes do `create`) em
 * vez de deixar a constraint `@unique` do schema estourar e capturar o
 * código de erro do Prisma — mais direto de ler e testar, e devolve 409 com
 * mensagem clara em vez de um 500 genérico.
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
  const parsed = TenantCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const dados = parsed.data;
  const cnpjLimpo = dados.cnpj.replace(/\D/g, "");

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  const resultado = await withTenantContext(ctx, async (tx) => {
    const existente = await tx.tenant.findUnique({ where: { cnpj: cnpjLimpo } });
    if (existente) return { conflito: true as const, tenant: null };

    const tenant = await tx.tenant.create({
      data: {
        razaoSocial: dados.razaoSocial,
        cnpj: cnpjLimpo,
        porte: dados.porte,
        segmento: dados.segmento,
      },
    });
    return { conflito: false as const, tenant };
  });

  if (resultado.conflito) {
    return NextResponse.json({ error: "Já existe um cliente cadastrado com esse CNPJ." }, { status: 409 });
  }

  return NextResponse.json(resultado.tenant, { status: 201 });
}
