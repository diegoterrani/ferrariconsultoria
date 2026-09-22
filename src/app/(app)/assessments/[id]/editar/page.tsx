import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";

import { Wizard } from "../../novo/wizard";

type Step1 = {
  razaoSocial: string;
  cnpj: string;
  porte: "pequeno" | "medio" | "grande" | "";
  numColaboradores: string;
  unidades: string[];
  segmento: "restaurante" | "hotel" | "outro" | "";
};
type Step2 = {
  rotatividadePercebida: string;
  historicoFiscalizacao: boolean | null;
  historicoFiscalizacaoDetalhe: string;
  rhFormalizado: boolean | null;
};
type Respostas = { step1?: Step1; step2?: Step2 };

/**
 * /assessments/[id]/editar — retomar um rascunho de diagnóstico (auditoria
 * de UX, set/2026 — ver comentário em `wizard.tsx` para o racional
 * completo). Se o diagnóstico já foi concluído, não há o que retomar:
 * redireciona pro resultado em vez de reabrir um wizard sem sentido pra
 * aquele estado — mesma decisão de scope da rota de resultado (que faz o
 * caminho inverso quando ainda está em rascunho).
 */
export default async function EditarAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "staff") redirect("/");

  const { id } = await params;

  const assessment = await withTenantContext(
    { role: session.user.role, tenantId: session.user.tenantId },
    (tx) => tx.assessment.findUnique({ where: { id } }),
  );

  if (!assessment) notFound();
  if (assessment.status !== "rascunho") redirect(`/assessments/${id}/resultado`);

  const respostas = assessment.respostas as Respostas;
  if (!respostas.step1) notFound(); // não deveria existir rascunho sem passo 1 — defensivo, não caminho esperado.

  return (
    <Wizard
      assessmentIdInicial={id}
      passoInicial={respostas.step2 ? 3 : 2}
      step1Inicial={respostas.step1}
      step2Inicial={respostas.step2}
    />
  );
}
