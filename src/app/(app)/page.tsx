import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { inicioSemanaUTC } from "@/lib/carteira/semanas";
import { botaoPrimario, botaoSecundario, cartao, textoSecundario } from "@/lib/ui/classes";
import { NovoClienteModal } from "@/components/carteira/novo-cliente-modal";

type PipelineLeadDecisao = { decisao: string | null };
type CapacitySettingsRow = { horasPorSemana: number } | null;

/**
 * / (Início) — dashboard real do dia a dia (auditoria de UX, set/2026).
 * Antes desta mudança era uma landing estática mostrando texto de status de
 * engenharia do projeto ("Módulos B1... C1 ainda não... ver /api/health") —
 * informação para quem desenvolve a plataforma, não para quem a usa pra
 * tocar a consultoria no dia a dia. Os 4 números abaixo são os mesmos que
 * cada módulo já calcula (capacidade, diagnósticos, faturamento, carteira)
 * — reaproveitados aqui, não recalculados com lógica nova — cada um
 * linkando direto pra tela onde a ação correspondente acontece.
 */
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };
  const inicioSemana = inicioSemanaUTC(new Date());
  const fimSemana = new Date(inicioSemana.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Cast explícito pelo mesmo motivo documentado nas demais páginas do
  // módulo B6/C1 — stub degenerado do Prisma Client neste sandbox (README).
  const { horasSemana, capacity, assessmentsConcluidos, cobrancasAtrasadas, clientesRisco } = (await withTenantContext(
    ctx,
    async (tx) => {
      const [agregadoSemana, capacity, assessmentsConcluidos, cobrancasAtrasadas, clientesRisco] = await Promise.all([
        tx.timeEntry.aggregate({
          where: { data: { gte: inicioSemana, lt: fimSemana } },
          _sum: { duracaoMinutos: true },
        }),
        tx.capacitySettings.findUnique({ where: { id: "default" } }),
        tx.assessment.findMany({
          where: { status: "concluido" },
          select: { pipelineLeads: { select: { decisao: true } } },
        }),
        tx.invoice.count({ where: { status: "atrasado" } }),
        tx.tenant.count({ where: { status: "risco_churn" } }),
      ]);
      return {
        horasSemana: (agregadoSemana._sum.duracaoMinutos ?? 0) / 60,
        capacity,
        assessmentsConcluidos,
        cobrancasAtrasadas,
        clientesRisco,
      };
    },
  )) as {
    horasSemana: number;
    capacity: CapacitySettingsRow;
    assessmentsConcluidos: { pipelineLeads: PipelineLeadDecisao[] }[];
    cobrancasAtrasadas: number;
    clientesRisco: number;
  };

  const horasPorSemana = capacity?.horasPorSemana ?? 10;
  // "Aguardando decisão" = diagnóstico concluído sem NENHUM pipelineLead com
  // decisao preenchida ainda — cobre tanto "nunca abriu o modal de decisão"
  // quanto "abriu, mas ainda não decidiu" (ambos têm o mesmo próximo passo
  // pra quem administra: voltar lá e decidir).
  const diagnosticosAguardando = assessmentsConcluidos.filter(
    (a) => !a.pipelineLeads.some((l) => l.decisao !== null),
  ).length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Início</h1>
        <div className="flex gap-3">
          <Link href="/assessments/novo" className={botaoPrimario}>
            + Novo diagnóstico
          </Link>
          <NovoClienteModal />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo="Capacidade da semana"
          valor={`${horasSemana.toFixed(1)}h / ${horasPorSemana}h`}
          alerta={horasSemana > horasPorSemana}
          href="/carteira/capacidade"
        />
        <Kpi
          rotulo="Diagnósticos aguardando decisão"
          valor={String(diagnosticosAguardando)}
          alerta={diagnosticosAguardando > 0}
          href="/assessments"
        />
        <Kpi
          rotulo="Cobranças atrasadas"
          valor={String(cobrancasAtrasadas)}
          alerta={cobrancasAtrasadas > 0}
          href="/carteira/faturamento"
        />
        <Kpi
          rotulo="Clientes em risco de churn"
          valor={String(clientesRisco)}
          alerta={clientesRisco > 0}
          href="/carteira"
        />
      </div>

      <Link href="/carteira/pipeline" className={`self-start ${botaoSecundario}`}>
        Ver pipeline comercial
      </Link>
    </div>
  );
}

function Kpi({ rotulo, valor, alerta, href }: { rotulo: string; valor: string; alerta: boolean; href: string }) {
  return (
    <Link href={href} className={`${cartao} flex flex-col gap-1 p-4 transition-colors hover:bg-surface-2`}>
      <span className={textoSecundario}>{rotulo}</span>
      <span className={`text-2xl font-semibold ${alerta ? "text-danger" : "text-ink"}`}>{valor}</span>
    </Link>
  );
}
