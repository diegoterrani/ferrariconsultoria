import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/db";
import { BENCHMARK_ROTATIVIDADE_SETOR } from "@/lib/apresentacao/benchmark-setor";
import { gerarRelatorioResultadoPdf } from "@/lib/relatorio/relatorio-pdf";

type RouteParams = { params: Promise<{ id: string }> };
type RespostasStep1 = { razaoSocial?: string };

const PACOTE_SUGERIDO_PADRAO = "Básico";

/**
 * GET — gera o PDF de resultado do diagnóstico (spec seção 6.1: botão
 * "Gerar relatório em PDF" → modal de preview → "Baixar"/"Enviar ao
 * cliente"). Rota GET (não POST): é leitura/derivação de dado já
 * persistido, sem efeito colateral — nada é criado ou alterado no banco só
 * de gerar o PDF, então não precisa do padrão de ação em duas fases usado
 * em `/api/deliverables` (aquela rota *cria* um registro).
 *
 * `?preview=1` → `Content-Disposition: inline`, para o `<iframe>` do modal
 * de preview mostrar o PDF no próprio navegador sem forçar download.
 * Sem o parâmetro → `Content-Disposition: attachment`, para o botão
 * "Baixar". Mesmo PDF, mesma rota, único ponto de verdade — nunca duas
 * implementações de geração que poderiam divergir.
 *
 * "Enviar ao cliente" (a segunda opção do modal, spec 6.1) não está
 * implementado nesta rota nem em nenhuma outra: não existe campo de e-mail
 * do cliente no modelo `Tenant` (schema seção 5) nem serviço de envio de
 * e-mail configurado — `EMAIL_SERVER`/`EMAIL_FROM` em `.env.example` são
 * placeholders herdados do provider de magic link do Auth.js, nunca
 * configurados nem usados em `src/lib/auth.ts` (só credenciais autenticam
 * nesta fatia). Construir isso de verdade depende do portal do cliente
 * (módulo A1-A3, Prioridade 3 do PRD) definir de onde vem o e-mail e qual o
 * canal oficial — mesmo princípio de honestidade de escopo já aplicado ao
 * "enviado" do C1 (registro manual, sem envio automático real) e ao
 * faturamento do B6 (cobrança manual, sem gateway). A UI reflete isso com
 * o botão desabilitado e tooltip explicando o motivo, nunca fingindo que a
 * ação funciona.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const preview = new URL(request.url).searchParams.get("preview") === "1";

  const dados = await withTenantContext(
    { role: session.user.role, tenantId: session.user.tenantId },
    async (tx) => {
      const assessment = await tx.assessment.findUnique({
        where: { id },
        include: { tenant: true },
      });
      if (!assessment) return { assessment: null };

      const ultimoLead = await tx.pipelineLead.findFirst({
        where: { assessmentId: id },
        orderBy: { updatedAt: "desc" },
      });

      return { assessment, pacoteSugerido: ultimoLead?.pacoteSugerido ?? null };
    },
  );

  if (!dados.assessment) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }

  const { assessment, pacoteSugerido } = dados;

  // Mesma checagem da tela de resultado (page.tsx): sem score calculado
  // não existe o que colocar no relatório. 409, não 404 — o assessment
  // existe, só não está pronto ainda.
  if (assessment.status !== "concluido" || assessment.scoreExposicao === null) {
    return NextResponse.json(
      { error: "Diagnóstico ainda não calculado — não há resultado para gerar relatório." },
      { status: 409 },
    );
  }

  const respostas = assessment.respostas as { step1?: RespostasStep1 };
  const razaoSocial = respostas.step1?.razaoSocial ?? assessment.tenant.razaoSocial;

  let pdf: Buffer;
  try {
    pdf = await gerarRelatorioResultadoPdf({
      razaoSocial,
      cnpj: assessment.tenant.cnpj,
      score: assessment.scoreExposicao,
      benchmarkRotatividadeSetor: BENCHMARK_ROTATIVIDADE_SETOR,
      pacoteSugerido: pacoteSugerido ?? PACOTE_SUGERIDO_PADRAO,
      geradoEm: new Date(),
    });
  } catch (erro) {
    // Mesmo princípio de fail-fast do C1 (src/lib/ai-provider.ts): erro
    // explícito em vez de devolver um PDF corrompido ou uma página em
    // branco sem explicação.
    const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido.";
    console.error("[relatorio-pdf] Falha ao gerar PDF", { assessmentId: id, erro: mensagem });
    return NextResponse.json({ error: `Falha ao gerar o PDF: ${mensagem}` }, { status: 502 });
  }

  const nomeArquivo = `diagnostico-${assessment.tenant.cnpj}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${nomeArquivo}"`,
      "Content-Length": String(pdf.byteLength),
      // Relatório com dado de negócio do tenant — nunca em cache
      // compartilhado (proxy/CDN), só no navegador do usuário autenticado.
      "Cache-Control": "private, no-store",
    },
  });
}
