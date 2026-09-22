import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { nivelAtencao, textoNivelAtencao } from "@/lib/apresentacao/nivel-atencao";
import { VAR_POR_NIVEL } from "@/lib/apresentacao/cor-nivel-atencao";
import { BENCHMARK_ROTATIVIDADE_SETOR } from "@/lib/apresentacao/benchmark-setor";
import { cartao, textoSecundario } from "@/lib/ui/classes";

import { ResultadoInterativo } from "./resultado-interativo";

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
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
        <h1 className="text-xl font-semibold">Diagnóstico ainda não calculado</h1>
        <p className={textoSecundario}>
          Este diagnóstico está em rascunho. Volte ao wizard para concluir os 3 passos.
        </p>
      </div>
    );
  }

  const respostas = assessment.respostas as { step1?: RespostasStep1 };
  const nomeEmpresa = respostas.step1?.razaoSocial ?? assessment.tenant.razaoSocial;
  const score = assessment.scoreExposicao;
  const nivel = nivelAtencao(score);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      <div>
        <p className={textoSecundario}>{nomeEmpresa}</p>
        <h1 className="text-xl font-semibold">Resultado do diagnóstico</h1>
      </div>

      <section className={`${cartao} flex flex-col items-center gap-3 p-6`}>
        <Gauge score={score} nivel={nivel} />
        <p className="max-w-sm text-center text-sm text-ink">
          {textoNivelAtencao(score)}
        </p>
      </section>

      <section className={`${cartao} p-4`}>
        <h2 className="text-sm font-medium text-ink-soft">Benchmark do setor</h2>
        <p className="mt-1 text-sm">
          Rotatividade média do setor: <strong>{BENCHMARK_ROTATIVIDADE_SETOR}%/ano</strong>
        </p>
      </section>

      <ResultadoInterativo assessmentId={assessment.id} tenantId={assessment.tenantId} />
    </div>
  );
}

function Gauge({ score, nivel }: { score: number; nivel: "baixo" | "moderado" | "elevado" }) {
  // Cor semântica da identidade visual (sálvia/ouro/alerta), fonte única em
  // src/lib/apresentacao/cor-nivel-atencao.ts — via `var(--sage)` etc., o
  // selo acompanha o modo claro/escuro do navegador sozinho, sem lógica
  // extra aqui (a variável CSS é que troca — ver src/app/globals.css).
  const cor = VAR_POR_NIVEL[nivel];
  // Selo circular simples via conic-gradient — sem lib de gráfico nova só
  // pra isto (spec pede "gauge ou selo", não especifica biblioteca).
  return (
    <div
      className="flex h-32 w-32 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${cor} ${score * 3.6}deg, var(--surface-2) 0deg)`,
      }}
      role="img"
      aria-label={`Score de exposição: ${score} de 100, nível de atenção ${nivel}`}
    >
      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-surface">
        <span className="text-2xl font-semibold text-ink">{score}</span>
        <span className="text-[10px] text-ink-soft">de 100</span>
      </div>
    </div>
  );
}
