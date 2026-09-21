import Anthropic from "@anthropic-ai/sdk";

import { LABELS_TIPO } from "@/lib/entregaveis/templates";

/**
 * Camada de abstração para IA generativa (módulo C1).
 *
 * Fonte: especificacao_plataforma_dev.md, seção 2 — "a abstração própria
 * existe para não travar a plataforma a um único fornecedor — trocar de
 * provedor no futuro deve significar reescrever um arquivo, não o produto
 * inteiro." Nenhum outro módulo deve importar `@anthropic-ai/sdk`
 * diretamente — sempre via este arquivo.
 *
 * Dependência: @anthropic-ai/sdk (^0.127.0). Justificativa: SDK oficial,
 * tipado, mantido pelo fornecedor da API já escolhida na spec (seção 2,
 * "qualidade de geração em português"); é a única dependência nova deste
 * módulo — não há alternativa sem SDK que não signifique reimplementar
 * chamada HTTP + streaming + tratamento de erro por conta própria.
 */

export interface GeracaoEntregavelInput {
  tipo: "descricao_cargo" | "politica_interna" | "material_onboarding";
  templateBaseId: string;
  /** Nome do template — só para compor o prompt, não é uma busca no banco. */
  templateNome: string;
  /** Briefing do template (spec C1.1) — o ponto de partida da geração. */
  templateBriefing: string;
  /** Respostas do assessment (B1.1) usadas para personalizar o rascunho — spec C1.2.a. */
  contextoAssessment?: Record<string, unknown>;
}

export interface GeracaoEntregavelOutput {
  conteudo: string;
  /** Nunca true automaticamente — revisão humana é obrigatória (spec 8.3). */
  aprovadoAutomaticamente: false;
}

export interface AiProvider {
  gerarEntregavel(input: GeracaoEntregavelInput): Promise<GeracaoEntregavelOutput>;
}

/**
 * Regra de linguagem (spec 8.4) aplicada aqui por analogia: o documento
 * gerado nunca pode ser lido como uma peça jurídica pronta ou uma garantia
 * de conformidade — é um rascunho de trabalho. O aviso é o primeiro nível
 * de defesa; o segundo é a máquina de estados (spec 8.3), que bloqueia o
 * envio ao cliente antes da aprovação humana explícita — ver
 * src/app/api/deliverables/[id]/route.ts.
 */
const AVISO_RASCUNHO =
  "> **Rascunho gerado por IA — requer revisão humana antes de qualquer envio ao cliente.** " +
  "Este texto é um ponto de partida, não uma peça jurídica finalizada; ajuste conforme a " +
  "realidade do estabelecimento e a orientação jurídica cabível antes de aprovar.";

function construirSystemPrompt(): string {
  return [
    "Você é um assistente de redação para uma consultoria de RH Estratégico e DP " +
      "Operacional brasileira, especializada em gastronomia e hotelaria (restaurantes, " +
      "hotéis, grupos gastronômicos de 40-200 colaboradores).",
    "Escreva sempre em português do Brasil, em tom profissional e direto, adequado para " +
      "uso interno de RH — nunca em tom de marketing.",
    "Nunca afirme ou implique conformidade legal automática, certificação ou garantia de " +
      "regularidade trabalhista — isso é decisão da consultoria e do cliente, não da IA. " +
      "Use formulações como 'ponto de atenção' ou 'sugestão a validar', nunca 'isso garante " +
      "conformidade' ou equivalente.",
    "Personalize o conteúdo com o contexto do estabelecimento fornecido (segmento, porte, " +
      "regime de jornada, política de gorjetas), mas não invente dado que não foi informado.",
    "Responda em markdown simples (títulos com #, listas com -), sem preâmbulo ou texto " +
      "fora do documento pedido.",
  ].join("\n");
}

function construirUserPrompt(input: GeracaoEntregavelInput): string {
  const partes = [
    `Gere um rascunho de ${LABELS_TIPO[input.tipo].toLowerCase()} a partir do seguinte briefing:`,
    input.templateBriefing,
  ];

  if (input.contextoAssessment && Object.keys(input.contextoAssessment).length > 0) {
    partes.push(
      "",
      "Contexto do estabelecimento (assessment já preenchido pelo cliente — use só o que " +
        "for relevante, não repita tudo literalmente):",
      JSON.stringify(input.contextoAssessment, null, 2),
    );
  }

  return partes.join("\n");
}

/**
 * Cliente único e lazy: `new Anthropic()` valida a chave só na primeira
 * chamada real, não no import do módulo — uma rota que importa este arquivo
 * sem nunca chamar `gerarEntregavel` (ex.: durante o build do Vercel) não
 * falha por falta de ANTHROPIC_API_KEY.
 */
let cliente: Anthropic | undefined;

function obterCliente(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY ausente — necessária para o módulo C1 (geração de entregáveis). " +
        "Configurar como variável de ambiente no Vercel (Production e Preview) e em .env.local " +
        "para desenvolvimento; nunca commitar o valor. Ver .env.example.",
    );
  }
  cliente ??= new Anthropic({ apiKey });
  return cliente;
}

export function createAiProvider(): AiProvider {
  return {
    async gerarEntregavel(input) {
      const client = obterCliente();
      // Configurável por env para trocar de modelo sem deploy de código
      // (ex.: revisão de custo/qualidade) — claude-sonnet-5 é o padrão
      // recomendado pela documentação da Anthropic para geração de texto
      // em português com boa relação custo/qualidade.
      const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

      let resposta;
      try {
        resposta = await client.messages.create({
          model,
          max_tokens: 4096,
          system: construirSystemPrompt(),
          messages: [{ role: "user", content: construirUserPrompt(input) }],
        });
      } catch (erro) {
        // Nunca engolir o erro original — spec do usuário exige tratamento
        // de erro robusto e explicável, não um catch silencioso. Erros da
        // API da Anthropic (rate limit, chave inválida, timeout) já vêm
        // tipados pelo SDK; preservamos a causa para debug em produção.
        throw new Error(
          `Falha ao gerar entregável via IA (tipo=${input.tipo}, template=${input.templateBaseId}): ${
            erro instanceof Error ? erro.message : String(erro)
          }`,
          { cause: erro },
        );
      }

      const textoGerado = resposta.content
        .filter((bloco): bloco is Anthropic.TextBlock => bloco.type === "text")
        .map((bloco) => bloco.text)
        .join("\n")
        .trim();

      if (!textoGerado) {
        throw new Error(
          `IA retornou resposta sem conteúdo de texto (tipo=${input.tipo}, stop_reason=${resposta.stop_reason}).`,
        );
      }

      // Log estruturado de uso — spec seção 12: "custo por chamada deve ser
      // monitorado desde o dia 1 (é a única linha de custo variável por
      // cliente atendido)". Sem infra de observabilidade dedicada no MVP
      // (1-3 clientes); grep por "[ai-provider:uso]" nos logs do Vercel
      // já cobre a necessidade real de monitorar custo nesta escala.
      console.log("[ai-provider:uso]", {
        model,
        tipo: input.tipo,
        templateBaseId: input.templateBaseId,
        inputTokens: resposta.usage.input_tokens,
        outputTokens: resposta.usage.output_tokens,
      });

      return {
        conteudo: `${AVISO_RASCUNHO}\n\n${textoGerado}`,
        aprovadoAutomaticamente: false,
      };
    },
  };
}
