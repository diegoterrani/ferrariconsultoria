import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";

import { RegistrarHorasButton } from "./registrar-horas-button";

/**
 * Layout do app autenticado (route group `(app)`) — cabeçalho fixo com
 * navegação entre módulos e a ação global "+ Registrar horas" (spec seção
 * 6.2: "ação global, não presa a uma tela específica... forçar navegação
 * até uma tela específica pra logar 20 minutos de trabalho é fricção
 * real"). `/login` fica FORA deste grupo de propósito — não deve ter
 * cabeçalho nem checagem de sessão redundante antes de existir sessão.
 *
 * Checagem de sessão aqui é defesa em profundidade, não a barreira
 * principal — `src/proxy.ts` já redireciona não-autenticado pra /login
 * antes da rota renderizar; este redirect cobre o caso de o proxy mudar de
 * matcher no futuro e alguém esquecer de re-proteger uma rota nova.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Lista de tenants pro select do modal de horas — só admin/staff chega
  // aqui (spec seção 3: client_owner não acessa módulos do Grupo B), então
  // o contexto de RLS usado é o da própria sessão, igual a qualquer outra
  // query administrativa.
  //
  // Cast explícito: neste sandbox o client Prisma é um stub degenerado
  // (`PrismaClient = any` — ver README) que faz a inferência colapsar pra
  // `unknown` neste ponto; o client real do Vercel tipa isto corretamente
  // sem o cast (mesma limitação documentada, não um bug de lógica).
  const tenants = (await withTenantContext(
    { role: session.user.role, tenantId: session.user.tenantId },
    (tx) => tx.tenant.findMany({ select: { id: true, razaoSocial: true }, orderBy: { razaoSocial: "asc" } }),
  )) as { id: string; razaoSocial: string }[];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/" className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
            Plataforma Ferrari
          </Link>
          <Link href="/assessments/novo" className="hover:underline">
            Diagnóstico
          </Link>
          <Link href="/carteira" className="hover:underline">
            Carteira
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <RegistrarHorasButton tenants={tenants} />
          <span className="text-xs text-neutral-500">{session.user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-xs text-neutral-500 hover:underline">
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
