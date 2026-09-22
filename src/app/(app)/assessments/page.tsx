import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { botaoPrimario, tabelaCabecalho, tabelaContainer, tabelaLinha, textoSecundario } from "@/lib/ui/classes";

type AssessmentRow = {
  id: string;
  status: string;
  scoreExposicao: number | null;
  createdAt: Date;
  tenant: { razaoSocial: string };
  pipelineLeads: { decisao: string | null }[];
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  concluido: "Concluído",
};

const DECISAO_LABEL: Record<string, string> = {
  aceite: "Aceite",
  recusa: "Recusa",
  nao_agora: "Não agora",
};

/**
 * /assessments — histórico de diagnósticos (auditoria de UX, set/2026):
 * antes desta tela não existia NENHUMA forma de listar diagnósticos
 * antigos — só era possível chegar num específico por link direto (vindo
 * do card do Pipeline, quando ele tinha assessmentId) ou lembrando de
 * salvar a URL na hora. Concluído linka pro resultado; rascunho linka pra
 * retomar o wizard de onde parou (`/assessments/[id]/editar`).
 */
export default async function AssessmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "staff") redirect("/");

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  // Cast explícito pelo mesmo motivo documentado nas demais páginas do
  // módulo B6/C1 — stub degenerado do Prisma Client neste sandbox (README).
  const assessments = (await withTenantContext(ctx, (tx) =>
    tx.assessment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        tenant: { select: { razaoSocial: true } },
        pipelineLeads: { select: { decisao: true }, orderBy: { updatedAt: "desc" }, take: 1 },
      },
    }),
  )) as AssessmentRow[];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Diagnósticos</h1>
        <Link href="/assessments/novo" className={botaoPrimario}>
          + Novo diagnóstico
        </Link>
      </div>

      {assessments.length === 0 ? (
        <p className={textoSecundario}>Nenhum diagnóstico rodado ainda.</p>
      ) : (
        <div className={tabelaContainer}>
          <table className="w-full text-left text-sm">
            <thead className={tabelaCabecalho}>
              <tr>
                <th className="px-4 py-2 font-medium">Empresa</th>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Score</th>
                <th className="px-4 py-2 font-medium">Decisão</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => {
                const decisao = a.pipelineLeads[0]?.decisao ?? null;
                const href = a.status === "concluido" ? `/assessments/${a.id}/resultado` : `/assessments/${a.id}/editar`;
                return (
                  <tr key={a.id} className={tabelaLinha}>
                    <td className="px-4 py-3">
                      <Link href={href} className="font-medium hover:underline">
                        {a.tenant.razaoSocial}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {new Date(a.createdAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                    </td>
                    <td className="px-4 py-3">{STATUS_LABEL[a.status] ?? a.status}</td>
                    <td className="px-4 py-3">{a.scoreExposicao ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{decisao ? (DECISAO_LABEL[decisao] ?? decisao) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
