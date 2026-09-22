import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";

import { LABELS_TIPO, type TipoEntregavel } from "@/lib/entregaveis/templates";
import { tabelaCabecalho, tabelaContainer, tabelaLinha, textoSecundario } from "@/lib/ui/classes";

import { GerarEntregavelModal } from "../../entregaveis/gerar-entregavel-modal";
import { EditarPacote } from "./editar-pacote";

type RouteParams = { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> };

const ABAS = [
  { valor: "dados", rotulo: "Dados do cliente" },
  { valor: "horas", rotulo: "Histórico de horas" },
  { valor: "faturamento", rotulo: "Faturamento" },
  { valor: "entregaveis", rotulo: "Entregáveis" },
] as const;
type Aba = (typeof ABAS)[number]["valor"];

const ATIVIDADE_LABEL: Record<string, string> = {
  entrega: "Entrega",
  prospeccao: "Prospecção",
  administrativo: "Administrativo",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
};

const DELIVERABLE_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  aprovado: "Aprovado",
  enviado: "Enviado",
};

/**
 * /carteira/[id] — página (não modal: tem abas, spec seção 6.2 diz
 * explicitamente "página — tem abas"). Abas por query string (`?aba=`) em
 * vez de estado de cliente: mantém a página inteira Server Component,
 * sem JS extra só pra alternar conteúdo estático.
 */
export default async function ClienteDetalhePage({ params, searchParams }: RouteParams) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "staff") redirect("/");

  const { id } = await params;
  const { aba: abaParam } = await searchParams;
  const aba: Aba = ABAS.some((a) => a.valor === abaParam) ? (abaParam as Aba) : "dados";

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  type Tenant = {
    id: string;
    razaoSocial: string;
    cnpj: string;
    porte: string;
    segmento: string;
    pacoteContratado: string | null;
    status: string;
  };
  type TimeEntry = { id: string; atividade: string; duracaoMinutos: number; data: Date };
  type Invoice = { id: string; competencia: string; valor: unknown; status: string };
  type Deliverable = { id: string; titulo: string; tipo: string; status: string; createdAt: Date };

  // Cast explícito pelo mesmo motivo documentado em carteira/page.tsx e
  // (app)/layout.tsx: client Prisma stub neste sandbox (ver README).
  const { tenant, timeEntries, invoices, deliverables } = (await withTenantContext(ctx, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id } });
    if (!tenant) return { tenant: null, timeEntries: [], invoices: [], deliverables: [] };

    const timeEntries = await tx.timeEntry.findMany({
      where: { tenantId: id },
      orderBy: { data: "desc" },
      take: 100,
    });
    const invoices = await tx.invoice.findMany({
      where: { tenantId: id },
      orderBy: { competencia: "desc" },
    });
    const deliverables = await tx.deliverable.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: "desc" },
    });
    return { tenant, timeEntries, invoices, deliverables };
  })) as {
    tenant: Tenant | null;
    timeEntries: TimeEntry[];
    invoices: Invoice[];
    deliverables: Deliverable[];
  };

  if (!tenant) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <Link href="/carteira" className="text-xs text-ink-soft hover:underline">
          ← Carteira
        </Link>
        <h1 className="text-xl font-semibold text-ink">{tenant.razaoSocial}</h1>
        <p className={textoSecundario}>{tenant.cnpj}</p>
      </div>

      <nav className="flex gap-1 border-b border-line text-sm">
        {ABAS.map((a) => (
          <Link
            key={a.valor}
            href={`/carteira/${id}?aba=${a.valor}`}
            className={`-mb-px border-b-2 px-3 py-2 ${
              aba === a.valor
                ? "border-wine-deep font-medium text-ink"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>

      {aba === "dados" && (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-ink-soft">Porte</dt>
              <dd className="capitalize">{tenant.porte}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">Segmento</dt>
              <dd className="capitalize">{tenant.segmento}</dd>
            </div>
          </dl>
          <EditarPacote tenantId={tenant.id} pacoteAtual={tenant.pacoteContratado} statusAtual={tenant.status} />
        </div>
      )}

      {aba === "horas" && (
        <div className={tabelaContainer}>
          {timeEntries.length === 0 ? (
            <p className="p-4 text-sm text-ink-soft">Nenhum registro de horas ainda.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className={tabelaCabecalho}>
                <tr>
                  <th className="px-4 py-2 font-medium">Data</th>
                  <th className="px-4 py-2 font-medium">Atividade</th>
                  <th className="px-4 py-2 font-medium">Duração</th>
                </tr>
              </thead>
              <tbody>
                {timeEntries.map((entry) => (
                  <tr key={entry.id} className={tabelaLinha}>
                    <td className="px-4 py-2">{new Date(entry.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                    <td className="px-4 py-2">{ATIVIDADE_LABEL[entry.atividade] ?? entry.atividade}</td>
                    <td className="px-4 py-2">
                      {Math.floor(entry.duracaoMinutos / 60)}h{String(entry.duracaoMinutos % 60).padStart(2, "0")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {aba === "faturamento" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-ink-soft">
            Gerar novas cobranças ou marcar como paga/atrasada acontece em{" "}
            <Link href="/carteira/faturamento" className="text-wine underline">
              Carteira → Faturamento
            </Link>
            .
          </p>
          <div className={tabelaContainer}>
            {invoices.length === 0 ? (
              <p className="p-4 text-sm text-ink-soft">Nenhuma cobrança registrada ainda.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className={tabelaCabecalho}>
                  <tr>
                    <th className="px-4 py-2 font-medium">Competência</th>
                    <th className="px-4 py-2 font-medium">Valor</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className={tabelaLinha}>
                      <td className="px-4 py-2">{inv.competencia}</td>
                      <td className="px-4 py-2">
                        {Number(inv.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="px-4 py-2">{INVOICE_STATUS_LABEL[inv.status] ?? inv.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {aba === "entregaveis" && (
        <div className="flex flex-col gap-4">
          <div>
            <GerarEntregavelModal tenantId={tenant.id} />
          </div>
          <div className={tabelaContainer}>
            {deliverables.length === 0 ? (
              <p className="p-4 text-sm text-ink-soft">Nenhum entregável gerado ainda.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className={tabelaCabecalho}>
                  <tr>
                    <th className="px-4 py-2 font-medium">Título</th>
                    <th className="px-4 py-2 font-medium">Tipo</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {deliverables.map((d) => (
                    <tr key={d.id} className={tabelaLinha}>
                      <td className="px-4 py-3">
                        <Link href={`/entregaveis/${d.id}`} className="text-wine underline">
                          {d.titulo}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{LABELS_TIPO[d.tipo as TipoEntregavel] ?? d.tipo}</td>
                      <td className="px-4 py-3">{DELIVERABLE_STATUS_LABEL[d.status] ?? d.status}</td>
                      <td className="px-4 py-3">{new Date(d.createdAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
