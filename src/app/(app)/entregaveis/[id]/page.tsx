import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { LABELS_TIPO, type TipoEntregavel } from "@/lib/entregaveis/templates";
import { textoSecundario } from "@/lib/ui/classes";

import { EditorEntregavel } from "./editor-entregavel";

type Deliverable = {
  id: string;
  titulo: string;
  tipo: string;
  conteudo: string;
  status: "rascunho" | "em_revisao" | "aprovado" | "enviado";
  createdAt: Date;
  tenant: { id: string; razaoSocial: string };
};

/**
 * /entregaveis/[id] — página (não modal: "é um editor, precisa de espaço e
 * de o usuário poder voltar", spec seção 6.3).
 */
export default async function EntregavelPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "staff") redirect("/");

  const { id } = await params;
  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  // Cast explícito pelo mesmo motivo documentado nas demais páginas do
  // módulo B6/C1 — stub degenerado do Prisma Client neste sandbox (README).
  const deliverable = (await withTenantContext(ctx, (tx) =>
    tx.deliverable.findUnique({ where: { id }, include: { tenant: { select: { id: true, razaoSocial: true } } } }),
  )) as Deliverable | null;

  if (!deliverable) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <Link href={`/carteira/${deliverable.tenant.id}?aba=entregaveis`} className="text-xs text-ink-soft hover:underline">
          ← {deliverable.tenant.razaoSocial}
        </Link>
        <h1 className="text-xl font-semibold text-ink">{deliverable.titulo}</h1>
        <p className={textoSecundario}>{LABELS_TIPO[deliverable.tipo as TipoEntregavel] ?? deliverable.tipo}</p>
      </div>

      <EditorEntregavel id={deliverable.id} conteudoInicial={deliverable.conteudo} status={deliverable.status} />
    </div>
  );
}
