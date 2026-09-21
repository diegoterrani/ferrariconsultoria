import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";

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

  // Cast explícito pelo mesmo motivo documentado em carteira/page.tsx e
  // (app)/layout.tsx: client Prisma stub neste sandbox (ver README).
  const { tenant, timeEntries, invoices } = (await withTenantContext(ctx, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id } });
    if (!tenant) return { tenant: null, timeEntries: [], invoices: [] };

    const timeEntries = await tx.timeEntry.findMany({
      where: { tenantId: id },
      orderBy: { data: "desc" },
      take: 100,
    });
    const invoices = await tx.invoice.findMany({
      where: { tenantId: id },
      orderBy: { competencia: "desc" },
    });
    return { tenant, timeEntries, invoices };
  })) as { tenant: Tenant | null; timeEntries: TimeEntry[]; invoices: Invoice[] };

  if (!tenant) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <Link href="/carteira" className="text-xs text-neutral-500 hover:underline">
          ← Carteira
        </Link>
        <h1 className="text-xl font-semibold">{tenant.razaoSocial}</h1>
        <p className="text-sm text-neutral-500">{tenant.cnpj}</p>
      </div>

      <nav className="flex gap-1 border-b border-neutral-200 text-sm dark:border-neutral-800">
        {ABAS.map((a) => (
          <Link
            key={a.valor}
            href={`/carteira/${id}?aba=${a.valor}`}
            className={`-mb-px border-b-2 px-3 py-2 ${
              aba === a.valor
                ? "border-neutral-900 font-medium dark:border-white"
                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
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
              <dt className="text-neutral-500">Porte</dt>
              <dd className="capitalize">{tenant.porte}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Segmento</dt>
              <dd className="capitalize">{tenant.segmento}</dd>
            </div>
          </dl>
          <EditarPacote tenantId={tenant.id} pacoteAtual={tenant.pacoteContratado} statusAtual={tenant.status} />
        </div>
      )}

      {aba === "horas" && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          {timeEntries.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">Nenhum registro de horas ainda.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-2 font-medium">Data</th>
                  <th className="px-4 py-2 font-medium">Atividade</th>
                  <th className="px-4 py-2 font-medium">Duração</th>
                </tr>
              </thead>
              <tbody>
                {timeEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
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
          <p className="text-xs text-neutral-500">
            Gerar novas cobranças ou marcar como paga/atrasada acontece em{" "}
            <Link href="/carteira/faturamento" className="underline">
              Carteira → Faturamento
            </Link>
            .
          </p>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            {invoices.length === 0 ? (
              <p className="p-4 text-sm text-neutral-500">Nenhuma cobrança registrada ainda.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800">
                  <tr>
                    <th className="px-4 py-2 font-medium">Competência</th>
                    <th className="px-4 py-2 font-medium">Valor</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
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
        <p className="text-sm text-neutral-500">
          Módulo C1 (geração de entregáveis por IA) ainda não implementado — esta aba fica pronta pra quando ele
          existir.
        </p>
      )}
    </div>
  );
}
