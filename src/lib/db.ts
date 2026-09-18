import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma + contexto de tenant para RLS (spec seção 4).
 *
 * A policy RLS em supabase/migrations/0001_multi_tenant_rls.sql lê
 * `current_setting('app.current_tenant_id')` e `current_setting('app.current_role')`
 * de dentro da própria sessão de banco Postgres. `withTenantContext` é o único
 * caminho aprovado para rodar uma query de aplicação: ele seta essas duas
 * variáveis, na MESMA transação, antes de qualquer SELECT/INSERT/UPDATE —
 * nunca a partir de um parâmetro vindo do cliente (query string, body), só
 * do JWT da sessão autenticada (ver src/lib/auth.ts quando o Auth.js for
 * configurado).
 *
 * Não existe uma forma "rápida" de pular isso: uma rota que chama
 * `prisma.assessment.findMany()` direto, fora de `withTenantContext`, roda
 * sem `app.current_tenant_id` setado — a policy RLS então não casa
 * `tenant_id = null`, e a query retorna vazio (falha segura), não vaza dado.
 * O teste obrigatório #1 (spec seção 9) verifica exatamente essa garantia
 * fim a fim, não só que este arquivo exista.
 *
 * `engineType = "client"` (schema.prisma) troca o engine binário Rust por
 * WASM + driver adapter — não instancia sem um adapter configurado
 * (`PrismaClientInitializationError: Missing configured driver adapter`,
 * detectado no primeiro build real com uma rota importando este módulo).
 * `PrismaPg` usa `pg.Pool` para falar com o pooler do Supabase (porta 6543,
 * pgbouncer em modo transaction) via `DATABASE_URL`.
 */

declare global {
  var __prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Evita recriar o client a cada hot-reload em dev (padrão recomendado do
// próprio Prisma para Next.js).
export const prisma = globalThis.__prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export interface TenantContext {
  tenantId: string | null; // null só é válido junto com role "admin"/"staff"
  role: "admin" | "staff" | "client_owner";
}

export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  if (ctx.role === "client_owner" && !ctx.tenantId) {
    throw new Error("client_owner sem tenantId — contexto de sessão inválido, requisição recusada.");
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRawUnsafe(
      `select set_config('app.current_tenant_id', $1, true), set_config('app.current_role', $2, true)`,
      ctx.tenantId ?? "",
      ctx.role,
    );
    return fn(tx as PrismaClient);
  });
}
