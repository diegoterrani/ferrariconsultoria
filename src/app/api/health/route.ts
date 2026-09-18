import { NextResponse } from "next/server";

/**
 * Health-check de deploy.
 *
 * Propósito único desta rota: validar, ao subir cada ambiente (local →
 * staging → produção, spec seção 10), que o build do Next.js chegou ao ar
 * corretamente — antes de qualquer módulo de negócio existir. Não consulta
 * o banco (isso viria com sua própria checagem, quando Prisma estiver
 * conectado a um projeto Supabase real); intencionalmente simples.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "ferrari-plataforma",
    timestamp: new Date().toISOString(),
  });
}
