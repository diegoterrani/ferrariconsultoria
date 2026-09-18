import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Health-check de deploy.
 *
 * Valida duas coisas independentes, cada uma reportada separadamente para
 * não confundir "build no ar" com "banco alcançável" (são falhas com causas
 * e remediações bem diferentes):
 *
 * 1. `service`: sempre "ok" se esta rota respondeu — confirma que o build
 *    do Next.js chegou ao ar (spec seção 10).
 * 2. `database`: `SELECT 1` direto via Prisma, fora de `withTenantContext`
 *    de propósito — este check não lê nem escreve dado de tenant nenhum,
 *    só confirma que `DATABASE_URL` autentica contra o Postgres do
 *    Supabase a partir do runtime serverless do Vercel. Não expõe detalhe
 *    de erro na resposta (poderia vazar host/porta internos); detalhe vai
 *    só pro log do servidor via `console.error`.
 *
 * Não usa `withTenantContext` porque não há tenant nem role de sessão
 * neste ponto — é infraestrutura, não uma rota de produto.
 */
export async function GET() {
  let database: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    database = "error";
    console.error("[health] falha ao conectar no banco via DATABASE_URL:", err);
  }

  const status = database === "ok" ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      service: "ferrari-plataforma",
      database,
      timestamp: new Date().toISOString(),
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
