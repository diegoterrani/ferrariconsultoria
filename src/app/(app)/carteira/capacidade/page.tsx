import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { ultimasNSemanas, rotuloSemana } from "@/lib/carteira/semanas";
import { textoSecundario } from "@/lib/ui/classes";

import { EditarCapacidade } from "./editar-capacidade";

const JANELA_SEMANAS = 8;
// Paleta cíclica pra empilhar por cliente — sem lib de gráfico nova (spec
// não pede uma; um SVG inline resolve um gráfico de barras empilhadas
// simples sem mais uma dependência pra manter). Cores derivadas da
// identidade visual da marca (vinho/ouro/sálvia + variantes) em vez do
// arco-íris genérico anterior — ainda categórica o bastante pra distinguir
// vários clientes ao mesmo tempo, mas dentro da paleta aprovada.
const CORES = ["#7A2E2E", "#A87A2A", "#5F7350", "#3A1414", "#C9A24B", "#8FA57C", "#A83232", "#5B4A43"];

type TimeEntryRow = { tenantId: string; duracaoMinutos: number; data: Date };
type TenantRow = { id: string; razaoSocial: string };
type CapacityRow = { horasPorSemana: number } | null;

/**
 * /carteira/capacidade — spec seção 6.2: "o painel mais importante da
 * plataforma segundo o próprio negócio (A-23: capacidade de horas, não
 * demanda, é o fator limitante)".
 *
 * DECISÃO (a spec não resolve isso): "horas comprometidas" usa
 * `time_entries` — não existe, no MVP, uma tabela separada de horas
 * *planejadas* vs. *realizadas*; o único dado que a plataforma tem é o
 * registro de horas já trabalhadas (spec seção 6.2, "Registro de horas").
 * Tratar isso como proxy de "comprometido" é a leitura mais honesta
 * disponível com o modelo de dados atual — revisitar se um dia existir
 * planejamento prospectivo de verdade.
 */
export default async function CapacidadePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "staff") redirect("/");

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };
  const semanas = ultimasNSemanas(JANELA_SEMANAS);
  const inicioJanela = semanas[0];
  const fimJanela = new Date(semanas[semanas.length - 1].getTime() + 7 * 24 * 60 * 60 * 1000);

  const { entries, tenants, capacity } = (await withTenantContext(ctx, async (tx) => {
    const entries = await tx.timeEntry.findMany({
      where: { data: { gte: inicioJanela, lt: fimJanela } },
      select: { tenantId: true, duracaoMinutos: true, data: true },
    });
    const tenants = await tx.tenant.findMany({ select: { id: true, razaoSocial: true } });
    const capacity = await tx.capacitySettings.findUnique({ where: { id: "default" } });
    return { entries, tenants, capacity };
  })) as { entries: TimeEntryRow[]; tenants: TenantRow[]; capacity: CapacityRow };

  const horasPorSemana = capacity?.horasPorSemana ?? 10;
  const nomePorTenant = new Map(tenants.map((t): [string, string] => [t.id, t.razaoSocial]));

  // tenantIds que efetivamente aparecem na janela, em ordem estável (por
  // nome) — só esses entram na legenda/empilhamento.
  const tenantIdsComHoras = [...new Set(entries.map((e) => e.tenantId))].sort((a, b) =>
    (nomePorTenant.get(a) ?? "").localeCompare(nomePorTenant.get(b) ?? ""),
  );
  const corPorTenant = new Map(tenantIdsComHoras.map((id, i): [string, string] => [id, CORES[i % CORES.length]]));

  const dadosPorSemana = semanas.map((inicioSemana) => {
    const fimSemana = new Date(inicioSemana.getTime() + 7 * 24 * 60 * 60 * 1000);
    const minutosPorTenant = new Map<string, number>();
    for (const entry of entries) {
      const data = new Date(entry.data);
      if (data >= inicioSemana && data < fimSemana) {
        minutosPorTenant.set(entry.tenantId, (minutosPorTenant.get(entry.tenantId) ?? 0) + entry.duracaoMinutos);
      }
    }
    const porTenant = tenantIdsComHoras.map((tenantId) => ({
      tenantId,
      horas: (minutosPorTenant.get(tenantId) ?? 0) / 60,
    }));
    return {
      rotulo: rotuloSemana(inicioSemana),
      porTenant,
      total: porTenant.reduce((soma, t) => soma + t.horas, 0),
    };
  });

  const maiorValor = Math.max(horasPorSemana, ...dadosPorSemana.map((s) => s.total), 1);
  const yMax = maiorValor * 1.15;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Capacidade</h1>
        <EditarCapacidade horasAtual={horasPorSemana} />
      </div>

      <p className={textoSecundario}>
        Horas comprometidas por cliente, semana a semana, contra a linha de capacidade disponível ({horasPorSemana}
        h/semana).
      </p>

      <GraficoCapacidade
        dadosPorSemana={dadosPorSemana}
        horasPorSemana={horasPorSemana}
        yMax={yMax}
        corPorTenant={corPorTenant}
      />

      {tenantIdsComHoras.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs">
          {tenantIdsComHoras.map((tenantId) => (
            <span key={tenantId} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: corPorTenant.get(tenantId) }} />
              {nomePorTenant.get(tenantId) ?? tenantId}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function GraficoCapacidade({
  dadosPorSemana,
  horasPorSemana,
  yMax,
  corPorTenant,
}: {
  dadosPorSemana: { rotulo: string; porTenant: { tenantId: string; horas: number }[]; total: number }[];
  horasPorSemana: number;
  yMax: number;
  corPorTenant: Map<string, string>;
}) {
  const largura = 720;
  const altura = 300;
  const margemEsquerda = 40;
  const margemBaixo = 30;
  const margemTopo = 10;
  const alturaUtil = altura - margemBaixo - margemTopo;
  const larguraUtil = largura - margemEsquerda - 10;
  const larguraBarra = larguraUtil / dadosPorSemana.length;

  function y(valor: number): number {
    return margemTopo + alturaUtil - (valor / yMax) * alturaUtil;
  }

  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label="Horas comprometidas por semana, por cliente">
      {/* eixo Y: 0, metade, topo */}
      {[0, yMax / 2, yMax].map((marca) => (
        <g key={marca}>
          <line
            x1={margemEsquerda}
            x2={largura - 10}
            y1={y(marca)}
            y2={y(marca)}
            stroke="currentColor"
            strokeOpacity={0.1}
          />
          <text x={0} y={y(marca) + 4} fontSize={10} fill="currentColor" opacity={0.6}>
            {marca.toFixed(0)}h
          </text>
        </g>
      ))}

      {/* barras empilhadas */}
      {dadosPorSemana.map((semana, i) => {
        let acumulado = 0;
        const x = margemEsquerda + i * larguraBarra + larguraBarra * 0.15;
        const w = larguraBarra * 0.7;
        return (
          <g key={semana.rotulo + i}>
            {semana.porTenant
              .filter((t) => t.horas > 0)
              .map((t) => {
                const yTopo = y(acumulado + t.horas);
                const alturaSegmento = y(acumulado) - yTopo;
                acumulado += t.horas;
                return (
                  <rect
                    key={t.tenantId}
                    x={x}
                    y={yTopo}
                    width={w}
                    height={Math.max(alturaSegmento, 0)}
                    fill={corPorTenant.get(t.tenantId)}
                  >
                    <title>
                      {t.horas.toFixed(1)}h
                    </title>
                  </rect>
                );
              })}
            <text
              x={x + w / 2}
              y={altura - margemBaixo + 16}
              fontSize={10}
              textAnchor="middle"
              fill="currentColor"
              opacity={0.6}
            >
              {semana.rotulo}
            </text>
          </g>
        );
      })}

      {/* linha de capacidade */}
      <line
        x1={margemEsquerda}
        x2={largura - 10}
        y1={y(horasPorSemana)}
        y2={y(horasPorSemana)}
        style={{ stroke: "var(--danger)" }}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <text x={largura - 10} y={y(horasPorSemana) - 4} fontSize={10} textAnchor="end" style={{ fill: "var(--danger)" }}>
        capacidade: {horasPorSemana}h
      </text>
    </svg>
  );
}
