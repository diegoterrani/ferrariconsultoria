import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { nivelAtencao, textoNivelAtencao } from "@/lib/apresentacao/nivel-atencao";

import { ResultadoInterativo } from "./resultado-interativo";

// Benchmark estático (spec seção 6.1: "dado estático, atualizável só por
// quem tem acesso admin"). Fica em código nesta fatia — vira campo editável
// via UI admin quando essa tela existir; não é escopo desta.
const BENCHMARK_ROTATIVIDADE_SETOR = 77.6;

type RespostasStep1 = { razaoSocial?: string };

export default async function ResultadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const assessment = await withTenantContext(
    { role: session.user.role, tenantId: session.user.tenantId },
    (tx) => tx.assessment.findUnique({ where: { id }, include: { tenant: true } }),
  );

  if (!assessment) notFound();

  if (assessment.status !== "concluido" || assessment.scoreExposicao === null) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-10">
        <h1 className="text-xl font-semibold">Diagnóstico ainda não calculado</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Este diagnóstico está em rascunho. Volte ao wizard para concluir os 3 passos.
        </p>
      </main>
    );
  }

  const respostas = assessment.respostas as { step1?: RespostasStep1 };
  const nomeEmpresa = respostas.step1?.razaoSocial ?? assessment.tenant.razaoSocial;
  const score = assessment.scoreExposicao;
  const nivel = nivelAtencao(score);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-10">
      <div>
        <p className="text-sm text-neutral-500">{nomeEmpresa}</p>
        <h1 className="text-xl font-semibold">Resultado do diagnóstico</h1>
      </div>

      <section className="flex flex-col items-center gap-3 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <Gauge score={score} nivel={nivel} />
        <p className="max-w-sm text-center text-sm text-neutral-700 dark:text-neutral-300">
          {textoNivelAtencao(score)}
        </p>
      </section>

      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-medium text-neutral-500">Benchmark do setor</h2>
        <p className="mt-1 text-sm">
          Rotatividade média do setor: <strong>{BENCHMARK_ROTATIVIDADE_SETOR}%/ano</strong>
        </p>
      </section>

      <ResultadoInterativo assessmentId={assessment.id} />
    </main>
  );
}

function Gauge({ score, nivel }: { score: number; nivel: "baixo" | "moderado" | "elevado" }) {
  const cor =
    nivel === "baixo" ? "#16a34a" : nivel === "moderado" ? "#d97706" : "#dc2626";
  // Selo circular simples via conic-gradient — sem lib de gráfico nova só
  // pra isto (spec pede "gauge ou selo", não especifica biblioteca).
  return (
    <div
      className="flex h-32 w-32 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${cor} ${score * 3.6}deg, #e5e5e5 0deg)`,
      }}
      role="img"
      aria-label={`Score de exposição: ${score} de 100, nível de atenção ${nivel}`}
    >
      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white dark:bg-neutral-950">
        <span className="text-2xl font-semibold">{score}</span>
        <span className="text-[10px] text-neutral-500">de 100</span>
      </div>
    </div>
  );
}
