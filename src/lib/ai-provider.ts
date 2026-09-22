import OpenAI from "openai";

import { LABELS_TIPO } from "@/lib/entregaveis/templates";

/**
 * Camada de abstração para IA generativa (módulo C1).
 *
 * Fonte: especificacao_plataforma_dev.md, seção 2 — "a abstração própria
 * existe para não travar a plataforma a um único fornecedor — trocar de
 * provedor no futuro deve significar reescrever um arquivo, não o produto
 * inteiro." Nenhum outro módulo deve importar o SDK de IA diretamente —
 * sempre via este arquivo.
 *
 * Provedor: OpenRouter, endpoint compatível com a API de Chat Completions
 * da OpenAI (`https://openrouter.ai/api/v1`, confirmado em
 * openrouter.ai/docs/quickstart). Modelo padrão `anthropic/claude-sonnet-5`
 * — mesmo modelo da Anthropic usado antes, agora roteado via OpenRouter em
 * vez da API nativa da Anthropic (troca decidida por já existir uma
 * credencial OpenRouter disponível; ver histórico de decisão desta sessão).
 *
 * Por que trocar de SDK e não só de URL: a Anthropic Messages API
 * (`@anthropic-ai/sdk`, `client.messages.create`) e a Chat Completions API
 * da OpenAI (`client.chat.completions.create`) têm formatos de
 * request/response incompatíveis (blocos de `content` vs. `choices[0]
 * .message.content`; `usage.input_tokens` vs. `usage.prompt_tokens`). A
 * OpenRouter documenta de forma estável e completa o endpoint compatível
 * com a OpenAI (openrouter.ai/docs/api_reference) — o atalho
 * `ANTHROPIC_BASE_URL=https://openrouter.ai/api` só é documentado para o
 * runtime do Claude Code/Claude Agent SDK, não para uso direto do
 * `@anthropic-ai/sdk` como este arquivo fazia; por isso a troca de
 * dependência em vez de reaproveitar o SDK antigo com uma URL diferente.
 *
 * Dependência: `openai` (SDK oficial da OpenAI, mesmo padrão de qualidade
 * do `@anthropic-ai/sdk` que substitui — tipado, mantido pelo fornecedor
 * do formato de API usado). `@anthropic-ai/sdk` foi removido do
 * package.json: nenhum outro módulo o importava (verificado antes desta
 * mudança).
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
 * Cliente único e lazy: `new OpenAI()` valida a chave só na primeira
 * chamada real, não no import do módulo — uma rota que importa este arquivo
 * sem nunca chamar `gerarEntregavel` (ex.: durante o build do Vercel) não
 * falha por falta de OPENROUTER_API_KEY.
 *
 * `HTTP-Referer`/`X-OpenRouter-Title`: headers de atribuição documentados
 * em openrouter.ai/docs/app-attribution — não afetam a chamada em si
 * (a API funciona sem eles), só a exibição de uso/ranking no painel da
 * OpenRouter. Incluídos porque são gratuitos e não têm efeito colateral.
 */
let cliente: OpenAI | undefined;

function obterCliente(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY ausente — necessária para o módulo C1 (geração de entregáveis, via OpenRouter). " +
        "Configurar como variável de ambiente no Vercel (Production e Preview) e em .env.local " +
        "para desenvolvimento; nunca commitar o valor. Ver .env.example.",
    );
  }
  cliente ??= new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://ferrariconsultoria.com.br",
      "X-OpenRouter-Title": "Plataforma Ferrari Consultoria",
    },
  });
  return cliente;
}

export function createAiProvider(): AiProvider {
  return {
    async gerarEntregavel(input) {
      const client = obterCliente();
      // Configurável por env para trocar de modelo sem deploy de código
      // (ex.: revisão de custo/qualidade) — anthropic/claude-sonnet-5 é o
      // padrão: mesmo modelo usado antes da troca de provedor, no formato
      // de slug exigido pela OpenRouter (confirmado em openrouter.ai/anthropic).
      const model = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-5";

      let resposta;
      try {
        resposta = await client.chat.completions.create({
          model,
          max_tokens: 4096,
          messages: [
            { role: "system", content: construirSystemPrompt() },
            { role: "user", content: construirUserPrompt(input) },
          ],
        });
      } catch (erro) {
        // Nunca engolir o erro original — spec do usuário exige tratamento
        // de erro robusto e explicável, não um catch silencioso. Erros da
        // API (rate limit, chave inválida, timeout, modelo indisponível na
        // OpenRouter) já vêm tipados pelo SDK; preservamos a causa para
        // debug em produção.
        throw new Error(
          `Falha ao gerar entregável via IA (tipo=${input.tipo}, template=${input.templateBaseId}): ${
            erro instanceof Error ? erro.message : String(erro)
          }`,
          { cause: erro },
        );
      }

      const textoGerado = resposta.choices[0]?.message?.content?.trim() ?? "";

      if (!textoGerado) {
        throw new Error(
          `IA retornou resposta sem conteúdo de texto (tipo=${input.tipo}, finish_reason=${resposta.choices[0]?.finish_reason}).`,
        );
      }

      // Log estruturado de uso — spec seção 12: "custo por chamada deve ser
      // monitorado desde o dia 1 (é a única linha de custo variável por
      // cliente atendido)". Sem infra de observabilidade dedicada no MVP
      // (1-3 clientes); grep por "[ai-provider:uso]" nos logs do Vercel
      // já cobre a necessidade real de monitorar custo nesta escala. Chaves
      // do log mantidas (inputTokens/outputTokens) para não quebrar
      // qualquer busca/alerta já configurado sobre esses logs, mesmo com a
      // troca de nome dos campos na resposta da API (prompt_tokens/
      // completion_tokens, nomenclatura da Chat Completions).
      console.log("[ai-provider:uso]", {
        model,
        tipo: input.tipo,
        templateBaseId: input.templateBaseId,
        inputTokens: resposta.usage?.prompt_tokens,
        outputTokens: resposta.usage?.completion_tokens,
      });

      return {
        conteudo: `${AVISO_RASCUNHO}\n\n${textoGerado}`,
        aprovadoAutomaticamente: false,
      };
    },
  };
}
