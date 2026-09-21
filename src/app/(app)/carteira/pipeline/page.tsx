import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";

import { KanbanBoard, type LeadCard } from "./kanban-board";

/**
 * /carteira/pipeline — Kanban comercial (spec seção 6.2): 4 colunas fixas,
 * não reordenáveis pelo usuário ("a ordem tem significado de negócio").
 * Server Component só busca os dados; o board (drag-and-drop) é Client
 * Component — ver kanban-board.tsx.
 */
export default async function PipelinePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "staff") redirect("/");

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  const leads = (await withTenantContext(ctx, (tx) =>
    tx.pipelineLead.findMany({
      include: { tenant: { select: { razaoSocial: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  )) as LeadCard[];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <h1 className="text-xl font-semibold">Pipeline</h1>
      <KanbanBoard leadsIniciais={leads} />
    </div>
  );
}
