import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { CarteiraSubNav } from "./sub-nav";

/**
 * Layout do módulo Carteira (route group `(modulo)` — sem segmento na URL,
 * escopo deste layout às 4 telas irmãs: Clientes, Capacidade, Pipeline,
 * Faturamento; /carteira/[id] fica FORA do grupo de propósito, porque já
 * tem sua própria navegação por abas e "← Carteira" — empilhar a barra de
 * módulo em cima da barra de abas do cliente só adicionaria peso visual sem
 * resolver nenhuma dor real; a página do cliente já é alcançável a partir
 * da aba "Clientes").
 *
 * Checagem de sessão/role aqui é defesa em profundidade, mesmo padrão já
 * documentado em (app)/layout.tsx e em cada página deste módulo — o proxy
 * (`src/proxy.ts`) e cada page.tsx continuam sendo a barreira principal.
 */
export default async function CarteiraModuloLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "staff") redirect("/");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <CarteiraSubNav />
      {children}
    </div>
  );
}
