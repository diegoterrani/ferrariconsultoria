import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { PACOTES, isPacoteValido } from "@/lib/carteira/pacotes";
import { inicioFimMesCorrente } from "@/lib/carteira/periodo";

/**
 * /carteira — tabela de clientes ativos (spec seção 6.2): nome, pacote,
 * horas consumidas/contratadas no mês (barra de progresso, amarela >80%,
 * vermelha >100%), status. Só admin/staff acessa (client_owner não tem
 * módulos do Grupo B — spec seção 3), então esta é uma checagem de defesa
 * em profundidade, igual ao layout do grupo (app).
 */
export default async function CarteiraPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "staff") redirect("/");

  const ctx = { role: session.user.role, tenantId: session.user.tenantId };
  const { inicio, fim } = inicioFimMesCorrente();

  type TenantRow = {
    id: string;
    razaoSocial: string;
    pacoteContratado: string | null;
    status: string;
  };
  type HorasAgregadas = { tenantId: string; _sum: { duracaoMinutos: number | null } };

  // Cast explícito no retorno: neste ambiente de sandbox o client Prisma é
  // um stub degenerado (`PrismaClient = any` — ver README, "Limitação
  // conhecida...") que zera qualquer inferência daqui em diante — sem o
  // cast, `.map`/`Map<K,V>` abaixo colapsam pra `unknown` e a aritmética de
  // horas quebra o typecheck local (não é erro de lógica, é o mesmo limite
  // já documentado; o client real do Vercel tipa isto corretamente).
  const [tenants, horasPorTenant] = (await withTenantContext(ctx, async (tx) => {
    const tenants = await tx.tenant.findMany({ orderBy: { razaoSocial: "asc" } });
    const agregado = await tx.timeEntry.groupBy({
      by: ["tenantId"],
      where: { data: { gte: inicio, lt: fim } },
      _sum: { duracaoMinutos: true },
    });
    return [tenants, agregado] as const;
  })) as [TenantRow[], HorasAgregadas[]];

  const minutosPorTenant = new Map<string, number>(
    horasPorTenant.map((h): [string, number] => [h.tenantId, h._sum.duracaoMinutos ?? 0]),
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Carteira</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/carteira/capacidade" className="hover:underline">
            Capacidade
          </Link>
          <Link href="/carteira/pipeline" className="hover:underline">
            Pipeline
          </Link>
          <Link href="/carteira/faturamento" className="hover:underline">
            Faturamento
          </Link>
        </nav>
      </div>

      {tenants.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum cliente cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Pacote</th>
                <th className="px-4 py-2 font-medium">Horas no mês</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => {
                const minutos = minutosPorTenant.get(tenant.id) ?? 0;
                const horasConsumidas = minutos / 60;
                const pacote = isPacoteValido(tenant.pacoteContratado) ? tenant.pacoteContratado : null;
                const horasContratadas = pacote ? PACOTES[pacote].horasIncluidas : null;

                return (
                  <tr key={tenant.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                    <td className="px-4 py-3">
                      <Link href={`/carteira/${tenant.id}`} className="font-medium hover:underline">
                        {tenant.razaoSocial}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {tenant.pacoteContratado ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <BarraDeHoras horasConsumidas={horasConsumidas} horasContratadas={horasContratadas} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tenant.status} />
                    </td>
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

function BarraDeHoras({
  horasConsumidas,
  horasContratadas,
}: {
  horasConsumidas: number;
  horasContratadas: number | null;
}) {
  if (horasContratadas === null) {
    return (
      <span className="text-xs text-neutral-500">
        {horasConsumidas.toFixed(1)}h — sem horas mensais contratadas
      </span>
    );
  }

  const percentual = (horasConsumidas / horasContratadas) * 100;
  // Limiares da própria spec (seção 6.2): amarelo acima de 80%, vermelho
  // acima de 100%.
  const cor = percentual > 100 ? "bg-red-500" : percentual > 80 ? "bg-amber-500" : "bg-neutral-900 dark:bg-white";

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-neutral-600 dark:text-neutral-400">
        {horasConsumidas.toFixed(1)}h / {horasContratadas}h
      </span>
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full ${cor}`} style={{ width: `${Math.min(percentual, 100)}%` }} />
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  risco_churn: "Risco de churn",
  encerrado: "Encerrado",
};

function StatusBadge({ status }: { status: string }) {
  const cor =
    status === "ativo"
      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
      : status === "risco_churn"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400";

  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cor}`}>{STATUS_LABEL[status] ?? status}</span>;
}
