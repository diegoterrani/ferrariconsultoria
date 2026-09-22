import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { Logomark } from "@/components/brand/logomark";

import { NavLinks } from "./nav-links";
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
 *
 * Cabeçalho aplicando a identidade visual (fase f3_escopo_mvp,
 * identidade_visual.html, aprovada por Eliane, 22/09/2026): fundo
 * vinho-noite + logomarca — a mesma combinação do mockup "Cabeçalho do
 * dashboard (plataforma)" do próprio documento de marca, que já
 * referenciava os módulos B1/B6/C1 nominalmente. Decisão de escopo:
 * o documento de marca desenha esse mockup como uma sidebar vertical; aqui
 * ele foi traduzido para o cabeçalho horizontal já existente, mantendo a
 * mesma paleta/tipografia/hierarquia (vinho-noite + ouro de destaque), em
 * vez de reestruturar a navegação de toda a plataforma para layout de
 * sidebar — a cor e a tipografia são a identidade; a forma do contêiner de
 * navegação é um detalhe de implementação que o documento não fixa como
 * requisito, e manter o cabeçalho horizontal existente evita reabrir todo o
 * layout responsivo (já testado) de ~20 páginas por uma mudança que não foi
 * pedida.
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
      <header className="flex flex-wrap items-center justify-between gap-3 bg-wine-deep px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" aria-label="Início — Plataforma Ferrari">
            <Logomark size="sm" />
          </Link>
          <NavLinks />
        </div>

        <div className="flex items-center gap-3">
          <RegistrarHorasButton tenants={tenants} />
          <span className="text-xs text-on-brand/70">{session.user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-white/25 px-3 py-1.5 text-xs text-on-brand transition-colors hover:bg-white/10"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 bg-bg">{children}</main>
    </div>
  );
}
