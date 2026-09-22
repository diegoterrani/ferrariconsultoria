import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";

import { tabelaCabecalho, tabelaContainer, tabelaLinha, textoSecundario } from "@/lib/ui/classes";

import { GerarCobrancasButton } from "./gerar-cobrancas-button";
import { StatusSelect } from "./status-select";

type InvoiceRow = {
  id: string;
  competencia: string;
  valor: unknown;
  status: string;
  tenant: { id: string; razaoSocial: string };
};

/**
 * /carteira/faturamento — lista de cobranças do mês corrente e histórico
 * (spec seção 6.2). "Gerar cobranças do mês" e a marcação manual de
 * pago/pendente/atrasado vivem aqui; a aba de faturamento em
 * /carteira/[id] só linka pra cá (evita duplicar a ação em dois lugares).
 */
export default async function FaturamentoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "staff") redirect("/");

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };

  const invoices = (await withTenantContext(ctx, (tx) =>
    tx.invoice.findMany({
      include: { tenant: { select: { id: true, razaoSocial: true } } },
      orderBy: [{ competencia: "desc" }],
    }),
  )) as InvoiceRow[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Faturamento</h1>
        <GerarCobrancasButton />
      </div>

      {invoices.length === 0 ? (
        <p className={textoSecundario}>Nenhuma cobrança registrada ainda.</p>
      ) : (
        <div className={tabelaContainer}>
          <table className="w-full text-left text-sm">
            <thead className={tabelaCabecalho}>
              <tr>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Competência</th>
                <th className="px-4 py-2 font-medium">Valor</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className={tabelaLinha}>
                  <td className="px-4 py-3">
                    <Link href={`/carteira/${inv.tenant.id}`} className="font-medium hover:underline">
                      {inv.tenant.razaoSocial}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{inv.competencia}</td>
                  <td className="px-4 py-3">
                    {Number(inv.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusSelect invoiceId={inv.id} statusAtual={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
