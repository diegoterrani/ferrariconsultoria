import PDFDocument from "pdfkit";

import { HEX_POR_NIVEL } from "@/lib/apresentacao/cor-nivel-atencao";
import { nivelAtencao, textoNivelAtencao } from "@/lib/apresentacao/nivel-atencao";

/**
 * Geração do PDF de resultado do diagnóstico (spec seção 6.1: botão "Gerar
 * relatório em PDF" → modal de preview → "Baixar"/"Enviar ao cliente").
 *
 * Biblioteca escolhida: `pdfkit`. Racional (mesmo critério do resto do
 * projeto — "sem dependência nova sem necessidade real", aplicado aqui
 * porque um PDF de verdade NÃO dá pra produzir sem alguma biblioteca):
 *   - Desenha o PDF programaticamente (texto/layout), sem depender de um
 *     navegador headless (Puppeteer/Playwright) renderizando HTML — isso
 *     importa porque a rota roda em função serverless do Vercel (spec
 *     seção 2, mesma restrição que levou a IA do C1 a rodar síncrona em
 *     vez de fila): um Chromium headless adiciona ~300MB+ ao bundle e
 *     segundos de cold start, incompatível com "o que uma ou duas pessoas
 *     conseguem operar sozinhas". `@playwright/test` já é dependência deste
 *     repo, mas só como devDependency para os testes E2E — nunca deve virar
 *     dependência de runtime de uma rota de produção.
 *   - Não tem binário nativo (diferente do engine antigo do Prisma) —
 *     nenhum risco de repetir o problema de rede/proxy documentado no
 *     README para `prisma generate`.
 *   - Maduro (biblioteca desde 2011, licença MIT, sem dependências
 *     transitivas problemáticas) e suficiente para o conteúdo exigido pela
 *     spec: texto formatado em uma página, sem gráficos complexos.
 *
 * Função pura o suficiente para ser testada sem servidor HTTP nem banco:
 * recebe só os dados já resolvidos (a rota em
 * src/app/api/assessments/[id]/relatorio/route.ts busca no banco e monta
 * este input), devolve um Buffer. Nenhuma chamada de rede, nenhum I/O de
 * arquivo.
 */

export interface RelatorioResultadoInput {
  razaoSocial: string;
  cnpj: string;
  score: number;
  benchmarkRotatividadeSetor: number;
  pacoteSugerido: string;
  geradoEm: Date;
}

function formatarCnpj(cnpj: string): string {
  // Defensivo: se algum dia chegar já formatado ou com tamanho inesperado,
  // devolve como veio em vez de lançar — este arquivo não é responsável por
  // validar CNPJ (isso é `src/lib/cnpj.ts`, já rodado antes do dado existir).
  if (!/^\d{14}$/.test(cnpj)) return cnpj;
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function gerarRelatorioResultadoPdf(input: RelatorioResultadoInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const nivel = nivelAtencao(input.score);
    const cor = HEX_POR_NIVEL[nivel];

    doc
      .fontSize(18)
      .fillColor("#3A1414") // wine-deep — identidade visual
      .text("Diagnóstico de exposição trabalhista", { align: "left" })
      .moveDown(0.2)
      .fontSize(11)
      .fillColor("#5B4A43") // ink-soft — identidade visual
      .text(input.razaoSocial)
      .text(`CNPJ ${formatarCnpj(input.cnpj)}`)
      .text(`Gerado em ${input.geradoEm.toLocaleDateString("pt-BR")}`)
      .moveDown(0.6);

    // Friso dourado sob o cabeçalho — mesmo elemento de marca do
    // papel timbrado no documento de identidade visual ("lh-top... border-
    // bottom: 2px solid var(--gold)"). Desenho vetorial simples via
    // `doc.rect`, já disponível no pdfkit — nenhuma dependência nova.
    doc
      .rect(doc.page.margins.left, doc.y, doc.page.width - doc.page.margins.left - doc.page.margins.right, 2)
      .fill("#A87A2A")
      .moveDown(1.1);

    doc
      .fontSize(13)
      .fillColor("#3A1414") // wine-deep — identidade visual
      .text("Score de exposição", { underline: false })
      .moveDown(0.3);

    doc
      .fontSize(36)
      .fillColor(cor)
      .text(`${input.score}`, { continued: true })
      .fontSize(14)
      .fillColor("#5B4A43") // ink-soft — identidade visual
      .text(" / 100")
      .moveDown(0.4);

    // Linguagem obrigatória (spec seção 8.4): nunca "regular/irregular" —
    // mesmo texto exibido na tela de resultado (src/lib/apresentacao/nivel-atencao.ts),
    // única fonte de verdade, nunca duplicado/reescrito aqui.
    doc
      .fontSize(11)
      .fillColor("#271815") // ink — identidade visual
      .text(textoNivelAtencao(input.score))
      .moveDown(1.2);

    doc
      .fontSize(13)
      .fillColor("#3A1414") // wine-deep — identidade visual
      .text("Benchmark do setor")
      .moveDown(0.3)
      .fontSize(11)
      .fillColor("#271815") // ink — identidade visual
      .text(`Rotatividade média do setor: ${input.benchmarkRotatividadeSetor}%/ano`)
      .moveDown(1.2);

    doc
      .fontSize(13)
      .fillColor("#3A1414") // wine-deep — identidade visual
      .text("Recomendação comercial")
      .moveDown(0.3)
      .fontSize(11)
      .fillColor("#271815") // ink — identidade visual
      .text(`Pacote sugerido: ${input.pacoteSugerido}`)
      .moveDown(0.2)
      .fontSize(9)
      .fillColor("#5B4A43") // ink-soft — identidade visual
      .text(
        "Sugestão do sistema — a decisão final é da administradora da Ferrari Consultoria, " +
          "sempre editável antes de ser registrada.",
      );

    doc.end();
  });
}
